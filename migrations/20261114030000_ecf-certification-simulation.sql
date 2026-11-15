-- DGII step 4 (simulation): guard so a tenant-issued e-NCF is never stored twice across test-set and
-- simulation runs. Port of cyberbistro 20261018160000_ecf_certification_simulation for a single tenant.
-- Adds "environment" and "runType" to submissions (denormalized from the run by the trigger below).

ALTER TABLE public."EcfCertificationSubmission"
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS "runType" text NOT NULL DEFAULT 'test_set';

UPDATE public."EcfCertificationSubmission" s
SET environment = r.environment,
    "runType" = r."runType"
FROM public."EcfCertificationRun" r
WHERE r.id = s."runId"
  AND (s.environment IS DISTINCT FROM r.environment OR s."runType" IS DISTINCT FROM r."runType");

ALTER TABLE public."EcfCertificationSubmission" ALTER COLUMN environment SET NOT NULL;

ALTER TABLE public."EcfCertificationSubmission"
  DROP CONSTRAINT IF EXISTS "EcfCertificationSubmission_environment_check",
  ADD CONSTRAINT "EcfCertificationSubmission_environment_check" CHECK (environment IN ('test', 'certification')),
  DROP CONSTRAINT IF EXISTS "EcfCertificationSubmission_runType_check",
  ADD CONSTRAINT "EcfCertificationSubmission_runType_check"
    CHECK ("runType" IN ('test_set', 'commercial_approval', 'simulation'));

-- A simulation e-NCF (signed e-CF: kinds ecf and portal_upload; an RFCE shares the e-NCF of its E32 and
-- is excluded) is unique per environment among simulation runs. Test-set runs keep the DGII workbook
-- numbers and may be re-run with the same workbook, so they are not unique among themselves; the trigger
-- rejects a simulation row that reuses a test-set e-NCF and a test-set row that reuses a simulation
-- e-NCF. Commercial approval runs hold the DGII emitter's e-NCF and are ignored.
CREATE UNIQUE INDEX IF NOT EXISTS "EcfCertificationSubmission_simulation_encf_key"
  ON public."EcfCertificationSubmission" (environment, encf)
  WHERE "runType" = 'simulation' AND kind IN ('ecf', 'portal_upload');

CREATE INDEX IF NOT EXISTS "EcfCertificationSubmission_encf_idx"
  ON public."EcfCertificationSubmission" (environment, encf);

CREATE OR REPLACE FUNCTION public.ecf_certification_submission_issued_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  SELECT r.environment, r."runType" INTO NEW.environment, NEW."runType"
  FROM public."EcfCertificationRun" r WHERE r.id = NEW."runId";
  IF NEW."runType" IS NULL THEN
    RAISE EXCEPTION 'EcfCertificationRun % does not exist', NEW."runId" USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW."runType" IN ('test_set', 'simulation') AND NEW.kind IN ('ecf', 'portal_upload') AND EXISTS (
    SELECT 1 FROM public."EcfCertificationSubmission" s
    WHERE s.environment = NEW.environment
      AND s.encf = NEW.encf
      AND s.kind IN ('ecf', 'portal_upload')
      AND s."runType" IN ('test_set', 'simulation')
      AND s."runType" <> NEW."runType"
  ) THEN
    RAISE EXCEPTION 'e-NCF % was already issued', NEW.encf USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.ecf_certification_submission_issued_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ecf_certification_submission_issued_guard ON public."EcfCertificationSubmission";
CREATE TRIGGER ecf_certification_submission_issued_guard
  BEFORE INSERT ON public."EcfCertificationSubmission"
  FOR EACH ROW EXECUTE FUNCTION public.ecf_certification_submission_issued_guard();
