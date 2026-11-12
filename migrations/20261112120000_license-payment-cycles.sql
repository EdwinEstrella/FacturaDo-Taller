-- Enable pgcrypto extension for sha256 digest hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create LicenseCycle table
CREATE TABLE IF NOT EXISTS public."LicenseCycle" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period text UNIQUE NOT NULL,
  "dueDate" date NOT NULL,
  "graceUntil" date NOT NULL,
  "codeHash" text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID')),
  "failedAttempts" integer NOT NULL DEFAULT 0,
  "lastFailedAt" timestamptz,
  "paidAt" timestamptz,
  "paidBy" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS licensecycle_period_idx ON public."LicenseCycle" (period DESC);
CREATE INDEX IF NOT EXISTS licensecycle_status_idx ON public."LicenseCycle" (status);

-- Enable RLS and revoke table access from client roles
ALTER TABLE public."LicenseCycle" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."LicenseCycle" FROM anon, authenticated;

-- RPC to inspect the current license status (evaluated server-side in America/Santo_Domingo)
CREATE OR REPLACE FUNCTION public.license_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_today date;
  v_cycle record;
  v_days_left integer;
BEGIN
  v_today := (now() AT TIME ZONE 'America/Santo_Domingo')::date;

  SELECT *
  INTO v_cycle
  FROM public."LicenseCycle"
  ORDER BY period DESC
  LIMIT 1;

  IF v_cycle IS NULL OR v_cycle.status = 'PAID' THEN
    RETURN json_build_object(
      'state', 'OK',
      'period', NULL,
      'due_date', NULL,
      'grace_until', NULL,
      'days_left', NULL
    );
  END IF;

  v_days_left := (v_cycle."graceUntil" - v_today)::integer;

  IF v_today <= v_cycle."graceUntil" THEN
    RETURN json_build_object(
      'state', 'GRACE',
      'period', v_cycle.period,
      'due_date', v_cycle."dueDate",
      'grace_until', v_cycle."graceUntil",
      'days_left', v_days_left
    );
  ELSE
    RETURN json_build_object(
      'state', 'LOCKED',
      'period', v_cycle.period,
      'due_date', v_cycle."dueDate",
      'grace_until', v_cycle."graceUntil",
      'days_left', v_days_left
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.license_status() TO anon, authenticated;

-- RPC to redeem a payment code
CREATE OR REPLACE FUNCTION public.redeem_license_code(
  p_code text,
  p_user text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_normalized text;
  v_cycle record;
  v_hash text;
  v_new_attempts integer;
BEGIN
  -- Normalize code: uppercase and strip non-alphanumeric characters
  v_normalized := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));

  SELECT *
  INTO v_cycle
  FROM public."LicenseCycle"
  WHERE status = 'PENDING'
  ORDER BY period DESC
  LIMIT 1
  FOR UPDATE;

  IF v_cycle IS NULL THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'NO_PENDING',
      'period', NULL
    );
  END IF;

  -- 15-minute lockout if >= 5 failed attempts
  IF v_cycle."failedAttempts" >= 5 AND v_cycle."lastFailedAt" > now() - interval '15 minutes' THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'TOO_MANY_ATTEMPTS',
      'period', v_cycle.period
    );
  END IF;

  v_hash := encode(digest(v_normalized, 'sha256'), 'hex');

  IF v_hash <> v_cycle."codeHash" THEN
    -- Mismatch: increment failure counter (reset to 1 if last failure was > 15m ago)
    IF v_cycle."lastFailedAt" IS NULL OR v_cycle."lastFailedAt" <= now() - interval '15 minutes' THEN
      v_new_attempts := 1;
    ELSE
      v_new_attempts := v_cycle."failedAttempts" + 1;
    END IF;

    UPDATE public."LicenseCycle"
    SET "failedAttempts" = v_new_attempts,
        "lastFailedAt" = now()
    WHERE id = v_cycle.id;

    RETURN json_build_object(
      'ok', false,
      'error', 'INVALID_CODE',
      'period', v_cycle.period
    );
  END IF;

  -- Successful match: mark cycle as PAID and reset attempts
  UPDATE public."LicenseCycle"
  SET status = 'PAID',
      "paidAt" = now(),
      "paidBy" = p_user,
      "failedAttempts" = 0
  WHERE id = v_cycle.id;

  RETURN json_build_object(
    'ok', true,
    'error', NULL,
    'period', v_cycle.period
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_license_code(text, text) TO anon, authenticated;

-- Seed the current monthly cycle as PAID to avoid unexpected lockouts upon migration
INSERT INTO public."LicenseCycle" (
  period,
  "dueDate",
  "graceUntil",
  "codeHash",
  status,
  "failedAttempts",
  "paidAt",
  "paidBy",
  "createdAt"
)
VALUES (
  to_char(now() AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM'),
  ((to_char(now() AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM') || '-11')::date),
  ((to_char(now() AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM') || '-11')::date + 3),
  encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'),
  'PAID',
  0,
  now(),
  'SEED',
  now()
)
ON CONFLICT (period) DO NOTHING;
