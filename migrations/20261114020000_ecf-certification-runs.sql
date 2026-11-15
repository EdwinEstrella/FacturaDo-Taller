-- DGII certification runs (Set de Pruebas, and later commercial approvals / simulation) and the
-- state of every document submitted in them. Port of cyberbistro ecf_certification_runs/submissions
-- for a single-tenant workshop.
-- Both tables hold signed XML, so NOTHING is granted to anon/authenticated: only the server (admin key)
-- reads and writes them.

CREATE TABLE IF NOT EXISTS public."EcfCertificationRun" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CHECK (environment IN ('test', 'certification')),
  "runType" text NOT NULL DEFAULT 'test_set'
    CHECK ("runType" IN ('test_set', 'commercial_approval', 'simulation')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  "sourceSha256" text NOT NULL CHECK ("sourceSha256" ~ '^[0-9a-f]{64}$'),
  "createdBy" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "EcfCertificationRun_latest_idx"
  ON public."EcfCertificationRun" (environment, "runType", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS public."EcfCertificationSubmission" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" uuid NOT NULL REFERENCES public."EcfCertificationRun"(id) ON DELETE CASCADE,
  "caseId" text NOT NULL,
  encf text NOT NULL CHECK (encf ~ '^E[0-9]{12}$'),
  "tipoEcf" text NOT NULL CHECK ("tipoEcf" ~ '^[0-9]{2}$'),
  kind text NOT NULL CHECK (kind IN ('ecf', 'rfce', 'portal_upload', 'acecf')),
  "sequenceOrder" integer NOT NULL CHECK ("sequenceOrder" >= 0),
  "dependsOnCaseId" text,
  "sourceCaseId" text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'accepted', 'accepted_conditional', 'rejected', 'error', 'ready_for_portal')),
  "trackId" text,
  "dgiiMessages" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "unsignedXml" text NOT NULL,
  "signedXml" text,
  "signedSha256" text,
  "securityCode" text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("runId", "caseId", kind),
  UNIQUE ("runId", "sequenceOrder")
);

CREATE INDEX IF NOT EXISTS "EcfCertificationSubmission_run_idx"
  ON public."EcfCertificationSubmission" ("runId", "sequenceOrder");

ALTER TABLE public."EcfCertificationRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EcfCertificationSubmission" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."EcfCertificationRun" FROM anon, authenticated;
REVOKE ALL ON TABLE public."EcfCertificationSubmission" FROM anon, authenticated;
