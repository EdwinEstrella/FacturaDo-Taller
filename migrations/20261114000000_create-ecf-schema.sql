-- Electronic invoicing (DGII e-CF) schema for the single-tenant workshop.
--
-- Next.js server actions only ENQUEUE work (EcfDocument + FiscalOutbox).
-- The always-on fiscal-worker claims jobs, signs XML, talks to DGII and
-- writes results back. Certificates are never stored in this database:
-- only metadata plus a storage key pointing at the encrypted .p12.

-- ---------------------------------------------------------------------------
-- FiscalConfig: single-row issuer configuration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."FiscalConfig" (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "ecfEnabled" boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'test'
    CHECK (environment IN ('test', 'certification', 'production')),
  rnc text,
  "legalName" text,
  "tradeName" text,
  address text,
  municipality text,
  province text,
  "economicActivity" text,
  "issuerBranch" text,
  "issuerEmail" text,
  "rfceThreshold" numeric(14,2) NOT NULL DEFAULT 250000 CHECK ("rfceThreshold" >= 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public."FiscalConfig" (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- EcfSequence: authorized e-NCF ranges, one active range per document type
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."EcfSequence" (
  "ecfType" text PRIMARY KEY CHECK ("ecfType" IN ('E31', 'E32', 'E34')),
  "rangeStart" bigint NOT NULL CHECK ("rangeStart" >= 1),
  "rangeEnd" bigint NOT NULL,
  "nextNumber" bigint NOT NULL,
  "expiresOn" date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ecfsequence_range_check CHECK ("rangeEnd" >= "rangeStart" AND "rangeEnd" <= 9999999999),
  CONSTRAINT ecfsequence_next_check CHECK ("nextNumber" >= "rangeStart" AND "nextNumber" <= "rangeEnd" + 1)
);

-- ---------------------------------------------------------------------------
-- EcfCertificateMetadata: public facts about the custodied .p12
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."EcfCertificateMetadata" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CHECK (environment IN ('test', 'certification', 'production')),
  subject text NOT NULL,
  issuer text NOT NULL,
  "serialNumber" text NOT NULL,
  "validFrom" timestamptz NOT NULL,
  "validUntil" timestamptz NOT NULL,
  -- AES-256-GCM envelopes ("aes256gcm:<iv>:<tag>:<ciphertext>", hex) produced by the app
  -- with ECF_ENCRYPTION_KEY. The key never lives in the database.
  "p12Encrypted" text NOT NULL,
  "passphraseEncrypted" text NOT NULL,
  "isReady" boolean NOT NULL DEFAULT false,
  "lastValidationError" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- One certificate row per environment (the same certificate serves all three).
CREATE UNIQUE INDEX IF NOT EXISTS ecfcertificatemetadata_env_unique_idx
  ON public."EcfCertificateMetadata" (environment);

-- ---------------------------------------------------------------------------
-- EcfBatch: RFCE summary batches (consumer invoices under the threshold)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."EcfBatch" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected', 'retryable_error', 'terminal_error')),
  "dgiiTrackId" text,
  "dgiiStatusCode" text,
  "dgiiStatusMessage" text,
  "lastError" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ecfbatch_status_idx
  ON public."EcfBatch" (status, "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- EcfDocument: one e-CF per invoice or credit note
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."EcfDocument" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceId" uuid REFERENCES public."Invoice"(id) ON DELETE RESTRICT,
  "creditNoteId" uuid REFERENCES public."CreditNote"(id) ON DELETE RESTRICT,
  "ecfType" text NOT NULL CHECK ("ecfType" IN ('E31', 'E32', 'E34')),
  encf text NOT NULL CHECK (encf ~ '^E[0-9]{12}$'),
  "sequenceExpiresOn" date NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'pending_configuration', 'pending_rfce_batch', 'queued', 'signed', 'submitted',
      'accepted', 'rejected', 'retryable_error', 'terminal_error'
    )),
  "certificateMetadataId" uuid REFERENCES public."EcfCertificateMetadata"(id) ON DELETE SET NULL,
  "batchId" uuid REFERENCES public."EcfBatch"(id) ON DELETE SET NULL,
  "xmlHash" text,
  "signedXmlStorageKey" text,
  "dgiiTrackId" text,
  "dgiiSecurityCode" text,
  "dgiiStatusCode" text,
  "dgiiStatusMessage" text,
  "dgiiMessages" jsonb,
  "rfceThresholdUsed" numeric(14,2),
  "rejectionScope" text CHECK ("rejectionScope" IS NULL OR "rejectionScope" IN ('individual', 'batch')),
  "submittedAt" timestamptz,
  "acceptedAt" timestamptz,
  "rejectedAt" timestamptz,
  "lastError" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ecfdocument_single_source_check
    CHECK (("invoiceId" IS NOT NULL)::int + ("creditNoteId" IS NOT NULL)::int = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS ecfdocument_encf_unique_idx ON public."EcfDocument" (encf);
CREATE UNIQUE INDEX IF NOT EXISTS ecfdocument_invoice_unique_idx
  ON public."EcfDocument" ("invoiceId") WHERE "invoiceId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ecfdocument_creditnote_unique_idx
  ON public."EcfDocument" ("creditNoteId") WHERE "creditNoteId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS ecfdocument_status_idx
  ON public."EcfDocument" (status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS ecfdocument_batch_idx
  ON public."EcfDocument" ("batchId") WHERE "batchId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- FiscalOutbox: durable job queue claimed by the fiscal-worker
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."FiscalOutbox" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ecfDocumentId" uuid NOT NULL REFERENCES public."EcfDocument"(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('submit', 'poll_status', 'resubmit')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'blocked_configuration', 'processing', 'retryable_error', 'terminal_error', 'done')),
  "idempotencyKey" text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "nextAttemptAt" timestamptz NOT NULL DEFAULT now(),
  "lockedBy" text,
  "lockedAt" timestamptz,
  "errorMessage" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fiscaloutbox_runnable_idx
  ON public."FiscalOutbox" ("nextAttemptAt", "createdAt")
  WHERE status IN ('queued', 'retryable_error', 'processing');
CREATE INDEX IF NOT EXISTS fiscaloutbox_document_idx
  ON public."FiscalOutbox" ("ecfDocumentId", operation, status);

-- ---------------------------------------------------------------------------
-- EcfDocumentEvent: append-only audit trail of fiscal state changes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."EcfDocumentEvent" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ecfDocumentId" uuid NOT NULL REFERENCES public."EcfDocument"(id) ON DELETE CASCADE,
  "fromStatus" text,
  "toStatus" text NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdBy" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ecfdocumentevent_document_idx
  ON public."EcfDocumentEvent" ("ecfDocumentId", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- Fiscal status mirrored on the commercial documents (read by the UI/printing)
-- ---------------------------------------------------------------------------
ALTER TABLE public."Invoice"
  ADD COLUMN IF NOT EXISTS "fiscalStatus" text,
  ADD COLUMN IF NOT EXISTS "fiscalDocumentId" uuid;

ALTER TABLE public."CreditNote"
  ADD COLUMN IF NOT EXISTS "fiscalStatus" text,
  ADD COLUMN IF NOT EXISTS "fiscalDocumentId" uuid;

CREATE OR REPLACE FUNCTION public.sync_commercial_fiscal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW."invoiceId" IS NOT NULL THEN
    UPDATE public."Invoice"
    SET "fiscalStatus" = NEW.status,
        "fiscalDocumentId" = NEW.id
    WHERE id = NEW."invoiceId";
  END IF;

  IF NEW."creditNoteId" IS NOT NULL THEN
    UPDATE public."CreditNote"
    SET "fiscalStatus" = NEW.status,
        "fiscalDocumentId" = NEW.id
    WHERE id = NEW."creditNoteId";
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ecfdocument_sync_commercial_fiscal_status ON public."EcfDocument";
CREATE TRIGGER ecfdocument_sync_commercial_fiscal_status
AFTER INSERT OR UPDATE OF status ON public."EcfDocument"
FOR EACH ROW
EXECUTE FUNCTION public.sync_commercial_fiscal_status();

-- ---------------------------------------------------------------------------
-- RPC: reserve the next e-NCF of a type (atomic, row-locked)
-- Call it inside the same transaction that inserts the EcfDocument.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_encf(p_ecf_type text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_seq public."EcfSequence"%ROWTYPE;
  v_today date;
  v_encf text;
BEGIN
  v_today := (now() AT TIME ZONE 'America/Santo_Domingo')::date;

  SELECT *
  INTO v_seq
  FROM public."EcfSequence"
  WHERE "ecfType" = p_ecf_type
  FOR UPDATE;

  IF NOT FOUND OR NOT v_seq.active THEN
    RAISE EXCEPTION 'ECF_SEQUENCE_NOT_CONFIGURED: no active % sequence', p_ecf_type
      USING ERRCODE = 'P0002';
  END IF;

  IF v_seq."expiresOn" < v_today THEN
    RAISE EXCEPTION 'ECF_SEQUENCE_EXPIRED: % sequence expired on %', p_ecf_type, v_seq."expiresOn"
      USING ERRCODE = 'P0001';
  END IF;

  IF v_seq."nextNumber" > v_seq."rangeEnd" THEN
    RAISE EXCEPTION 'ECF_SEQUENCE_EXHAUSTED: % sequence has no numbers left', p_ecf_type
      USING ERRCODE = 'P0001';
  END IF;

  v_encf := v_seq."ecfType" || lpad(v_seq."nextNumber"::text, 10, '0');

  UPDATE public."EcfSequence"
  SET "nextNumber" = "nextNumber" + 1,
      "updatedAt" = now()
  WHERE "ecfType" = p_ecf_type;

  RETURN json_build_object(
    'encf', v_encf,
    'expires_on', v_seq."expiresOn"
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: manually re-enqueue a failed document (idempotent while a job is live)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reenqueue_ecf_document(p_ecf_document_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_document public."EcfDocument"%ROWTYPE;
  v_job public."FiscalOutbox"%ROWTYPE;
  v_key text;
BEGIN
  SELECT *
  INTO v_document
  FROM public."EcfDocument"
  WHERE id = p_ecf_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ECF_DOCUMENT_NOT_FOUND: %', p_ecf_document_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_job
  FROM public."FiscalOutbox"
  WHERE "ecfDocumentId" = p_ecf_document_id
    AND operation = 'resubmit'
    AND (
      status IN ('queued', 'retryable_error')
      OR (status = 'processing' AND "lockedAt" >= now() - interval '15 minutes')
    )
  ORDER BY "createdAt" DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'ok', true,
      'idempotent', true,
      'outbox_id', v_job.id,
      'status', v_document.status
    );
  END IF;

  IF v_document.status NOT IN ('rejected', 'retryable_error', 'terminal_error', 'pending_configuration') THEN
    RAISE EXCEPTION 'ECF_NOT_ELIGIBLE: document % cannot be re-enqueued from status %', p_ecf_document_id, v_document.status
      USING ERRCODE = 'P0001';
  END IF;

  v_key := format('manual_reenqueue:%s:%s', p_ecf_document_id, txid_current());

  INSERT INTO public."FiscalOutbox" ("ecfDocumentId", operation, status, "idempotencyKey")
  VALUES (p_ecf_document_id, 'resubmit', 'queued', v_key)
  RETURNING * INTO v_job;

  UPDATE public."EcfDocument"
  SET status = 'queued',
      "lastError" = NULL,
      "dgiiStatusMessage" = 'Reencolado manualmente',
      "updatedAt" = now()
  WHERE id = p_ecf_document_id;

  INSERT INTO public."EcfDocumentEvent" ("ecfDocumentId", "fromStatus", "toStatus", reason, metadata, "createdBy")
  VALUES (
    p_ecf_document_id,
    v_document.status,
    'queued',
    'manual_reenqueue',
    jsonb_build_object('outbox_id', v_job.id, 'idempotency_key', v_key),
    'trusted_rpc'
  );

  RETURN json_build_object(
    'ok', true,
    'idempotent', false,
    'outbox_id', v_job.id,
    'status', 'queued'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: store the (already encrypted) certificate for all environments.
-- The app encrypts p12 + passphrase before calling; the DB never sees plaintext.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_ecf_certificate(
  p_subject text,
  p_issuer text,
  p_serial_number text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_p12_encrypted text,
  p_passphrase_encrypted text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_env text;
BEGIN
  IF p_p12_encrypted IS NULL OR p_p12_encrypted !~ '^aes256gcm:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$'
     OR p_passphrase_encrypted IS NULL OR p_passphrase_encrypted !~ '^aes256gcm:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$' THEN
    RAISE EXCEPTION 'ECF_CERTIFICATE_NOT_ENCRYPTED: certificate material must be an aes256gcm envelope'
      USING ERRCODE = '22023';
  END IF;

  IF p_valid_until <= now() THEN
    RAISE EXCEPTION 'ECF_CERTIFICATE_EXPIRED: certificate is already expired'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_env IN ARRAY ARRAY['test', 'certification', 'production'] LOOP
    INSERT INTO public."EcfCertificateMetadata" (
      environment, subject, issuer, "serialNumber", "validFrom", "validUntil",
      "p12Encrypted", "passphraseEncrypted", "isReady", "lastValidationError"
    )
    VALUES (
      v_env, p_subject, p_issuer, p_serial_number, p_valid_from, p_valid_until,
      p_p12_encrypted, p_passphrase_encrypted, true, NULL
    )
    ON CONFLICT (environment) DO UPDATE
    SET subject = EXCLUDED.subject,
        issuer = EXCLUDED.issuer,
        "serialNumber" = EXCLUDED."serialNumber",
        "validFrom" = EXCLUDED."validFrom",
        "validUntil" = EXCLUDED."validUntil",
        "p12Encrypted" = EXCLUDED."p12Encrypted",
        "passphraseEncrypted" = EXCLUDED."passphraseEncrypted",
        "isReady" = true,
        "lastValidationError" = NULL,
        "updatedAt" = now();
  END LOOP;

  RETURN json_build_object('ok', true, 'subject', p_subject);
END;
$$;

-- ---------------------------------------------------------------------------
-- Access control. Fiscal tables are readable by the app (no secrets in them);
-- writes go through the RPCs above/the fiscal-worker. The certificate table
-- exposes only non-secret columns, so the encrypted material is never
-- selectable with the public anon key.
-- ---------------------------------------------------------------------------
ALTER TABLE public."FiscalConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EcfSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EcfCertificateMetadata" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EcfBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EcfDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FiscalOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EcfDocumentEvent" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."FiscalConfig" FROM anon, authenticated;
REVOKE ALL ON TABLE public."EcfSequence" FROM anon, authenticated;
REVOKE ALL ON TABLE public."EcfCertificateMetadata" FROM anon, authenticated;
REVOKE ALL ON TABLE public."EcfBatch" FROM anon, authenticated;
REVOKE ALL ON TABLE public."EcfDocument" FROM anon, authenticated;
REVOKE ALL ON TABLE public."FiscalOutbox" FROM anon, authenticated;
REVOKE ALL ON TABLE public."EcfDocumentEvent" FROM anon, authenticated;

GRANT SELECT ON TABLE
  public."FiscalConfig",
  public."EcfSequence",
  public."EcfBatch",
  public."EcfDocument",
  public."FiscalOutbox",
  public."EcfDocumentEvent"
TO anon, authenticated;

GRANT SELECT (
  id, environment, subject, issuer, "serialNumber", "validFrom", "validUntil",
  "isReady", "lastValidationError", "createdAt", "updatedAt"
) ON public."EcfCertificateMetadata" TO anon, authenticated;

DROP POLICY IF EXISTS fiscalconfig_app_select ON public."FiscalConfig";
CREATE POLICY fiscalconfig_app_select ON public."FiscalConfig" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS ecfsequence_app_select ON public."EcfSequence";
CREATE POLICY ecfsequence_app_select ON public."EcfSequence" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS ecfbatch_app_select ON public."EcfBatch";
CREATE POLICY ecfbatch_app_select ON public."EcfBatch" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS ecfdocument_app_select ON public."EcfDocument";
CREATE POLICY ecfdocument_app_select ON public."EcfDocument" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS fiscaloutbox_app_select ON public."FiscalOutbox";
CREATE POLICY fiscaloutbox_app_select ON public."FiscalOutbox" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS ecfdocumentevent_app_select ON public."EcfDocumentEvent";
CREATE POLICY ecfdocumentevent_app_select ON public."EcfDocumentEvent" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS ecfcertificatemetadata_app_select ON public."EcfCertificateMetadata";
CREATE POLICY ecfcertificatemetadata_app_select ON public."EcfCertificateMetadata" FOR SELECT TO anon, authenticated USING (true);

REVOKE ALL ON FUNCTION public.reserve_encf(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reenqueue_ecf_document(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_ecf_certificate(text, text, text, timestamptz, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_encf(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reenqueue_ecf_document(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_ecf_certificate(text, text, text, timestamptz, timestamptz, text, text) TO anon, authenticated;
