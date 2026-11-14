-- Progress of the 15-step DGII e-CF certification wizard (Ajustes > Facturacion electronica).
-- Single-tenant: exactly one row. Reads are public to the app; writes go through the RPC.

CREATE TABLE IF NOT EXISTS public."EcfCertificationProgress" (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "currentStep" integer NOT NULL DEFAULT 1 CHECK ("currentStep" BETWEEN 1 AND 15),
  "completedSteps" integer[] NOT NULL DEFAULT '{}'
    CHECK ("completedSteps" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]),
  "updatedBy" text,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public."EcfCertificationProgress" (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public."EcfCertificationProgress" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."EcfCertificationProgress" FROM anon, authenticated;
GRANT SELECT ON TABLE public."EcfCertificationProgress" TO anon, authenticated;

DROP POLICY IF EXISTS ecfcertificationprogress_app_select ON public."EcfCertificationProgress";
CREATE POLICY ecfcertificationprogress_app_select ON public."EcfCertificationProgress"
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.save_ecf_certification_progress(
  p_current_step integer,
  p_completed_steps integer[],
  p_updated_by text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_completed integer[];
BEGIN
  IF p_current_step IS NULL OR p_current_step < 1 OR p_current_step > 15 THEN
    RAISE EXCEPTION 'ECF_PROGRESS_INVALID: current step must be between 1 and 15'
      USING ERRCODE = '22023';
  END IF;

  IF p_completed_steps IS NULL
     OR NOT (p_completed_steps <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]) THEN
    RAISE EXCEPTION 'ECF_PROGRESS_INVALID: completed steps must be between 1 and 15'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT s ORDER BY s), '{}')
  INTO v_completed
  FROM unnest(p_completed_steps) AS s;

  UPDATE public."EcfCertificationProgress"
  SET "currentStep" = p_current_step,
      "completedSteps" = v_completed,
      "updatedBy" = p_updated_by,
      "updatedAt" = now()
  WHERE id = 1;

  RETURN json_build_object('ok', true, 'current_step', p_current_step, 'completed_steps', v_completed);
END;
$$;

REVOKE ALL ON FUNCTION public.save_ecf_certification_progress(integer, integer[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_ecf_certification_progress(integer, integer[], text) TO anon, authenticated;
