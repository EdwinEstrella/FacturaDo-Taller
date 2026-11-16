-- Migration: ECF invoice issuance hook, snapshot column and legacy NCF bypass
-- File prepared only; NOT applied to production without explicit user authorization.

-- ---------------------------------------------------------------------------
-- 1. Add snapshot column to EcfDocument
-- ---------------------------------------------------------------------------
ALTER TABLE public."EcfDocument"
  ADD COLUMN IF NOT EXISTS snapshot jsonb;

-- ---------------------------------------------------------------------------
-- 2. Atomic RPC: enqueue e-CF document and outbox job for an invoice
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_invoice_ecf(
  p_invoice_id uuid,
  p_ecf_type text,
  p_snapshot jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_ecf_enabled boolean;
  v_invoice_exists boolean;
  v_existing_doc_id uuid;
  v_reservation json;
  v_encf text;
  v_expires_on date;
  v_doc_id uuid;
BEGIN
  -- 1. Verify e-CF issuance is globally enabled
  SELECT "ecfEnabled" INTO v_ecf_enabled
  FROM public."FiscalConfig"
  WHERE id = 1;

  IF NOT coalesce(v_ecf_enabled, false) THEN
    RAISE EXCEPTION 'ECF_DISABLED: electronic invoicing is disabled'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Verify e-CF type is valid for standard sales
  IF p_ecf_type NOT IN ('E31', 'E32') THEN
    RAISE EXCEPTION 'INVALID_ECF_TYPE: expected E31 or E32, got %', p_ecf_type
      USING ERRCODE = '22023';
  END IF;

  -- 3. Verify invoice exists
  SELECT EXISTS(SELECT 1 FROM public."Invoice" WHERE id = p_invoice_id)
  INTO v_invoice_exists;

  IF NOT v_invoice_exists THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND: invoice % not found', p_invoice_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 4. Reject if invoice already has an EcfDocument (idempotent rejection)
  SELECT id INTO v_existing_doc_id
  FROM public."EcfDocument"
  WHERE "invoiceId" = p_invoice_id;

  IF FOUND THEN
    RAISE EXCEPTION 'ECF_ALREADY_ISSUED: invoice % already has e-CF document %', p_invoice_id, v_existing_doc_id
      USING ERRCODE = '23505';
  END IF;

  -- 5. Reserve next sequence number atomically
  v_reservation := public.reserve_encf(p_ecf_type);
  v_encf := v_reservation->>'encf';
  v_expires_on := (v_reservation->>'expires_on')::date;

  -- 6. Insert EcfDocument row
  INSERT INTO public."EcfDocument" (
    "invoiceId",
    "ecfType",
    encf,
    "sequenceExpiresOn",
    status,
    snapshot
  )
  VALUES (
    p_invoice_id,
    p_ecf_type,
    v_encf,
    v_expires_on,
    'queued',
    p_snapshot
  )
  RETURNING id INTO v_doc_id;

  -- 7. Insert FiscalOutbox job
  INSERT INTO public."FiscalOutbox" (
    "ecfDocumentId",
    operation,
    status,
    "idempotencyKey"
  )
  VALUES (
    v_doc_id,
    'submit',
    'queued',
    'submit:' || v_doc_id::text
  );

  -- 8. Mirror e-NCF on the commercial invoice
  UPDATE public."Invoice"
  SET ncf = v_encf,
      "hasNcf" = true,
      "updatedAt" = now()
  WHERE id = p_invoice_id;

  -- 9. Return issuance summary
  RETURN json_build_object(
    'ecfDocumentId', v_doc_id,
    'encf', v_encf,
    'expiresOn', v_expires_on
  );
END;
$$;

-- Access control: admin client only (SECURITY DEFINER), NEVER grant to PUBLIC, anon, or authenticated
REVOKE ALL ON FUNCTION public.enqueue_invoice_ecf(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Replace assign_ncf_for_taxed_invoice() trigger function
-- When FiscalConfig.ecfEnabled is true and NEW.ncf IS NULL,
-- set "hasNcf" := false and return without touching NCF_B01.
-- All other paths remain identical.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_ncf_for_taxed_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_ncf text;
  v_next_ncf text;
  v_ecf_enabled boolean;
BEGIN
  IF NEW.ncf IS NOT NULL THEN
    NEW."hasNcf" := true;
    RETURN NEW;
  END IF;

  SELECT "ecfEnabled" INTO v_ecf_enabled
  FROM public."FiscalConfig"
  WHERE id = 1;

  IF coalesce(v_ecf_enabled, false) THEN
    NEW."hasNcf" := false;
    RETURN NEW;
  END IF;

  IF coalesce(nullif(NEW.tax, ''), '0')::numeric <= 0 THEN
    NEW."hasNcf" := false;
    RETURN NEW;
  END IF;

  SELECT value
  INTO v_ncf
  FROM public."Setting"
  WHERE key = 'NCF_B01'
  FOR UPDATE;

  IF v_ncf IS NULL OR v_ncf !~ '^B01[0-9]{8}$' THEN
    RAISE EXCEPTION 'La secuencia NCF B01 no esta configurada correctamente';
  END IF;

  v_next_ncf := 'B01' || lpad(((substring(v_ncf FROM 4))::bigint + 1)::text, 8, '0');

  NEW.ncf := v_ncf;
  NEW."hasNcf" := true;

  UPDATE public."Setting"
  SET value = v_next_ncf,
      "updatedAt" = now()
  WHERE key = 'NCF_B01';

  RETURN NEW;
END;
$$;
