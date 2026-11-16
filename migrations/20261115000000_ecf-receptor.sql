-- e-CF receptor (DGII inbound services on facturado.lat/{RNC}/fe/...): consumed seeds, access tokens,
-- received e-CF and received commercial approvals. Port of cyberbistro 20261017160000_ecf_receptor.sql +
-- 20261017170000_ecf_receptor_hardening.sql for a single company (no tenant column).
-- Tokens, signer identities and signed XML live here, so NOTHING is granted to anon/authenticated:
-- only the server (admin key) reads and writes these tables.

-- 1. Single-use seeds. Seeds are stateless (HMAC); a row exists only once a seed is CONSUMED.
CREATE TABLE IF NOT EXISTS public."EcfReceptorSeed" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "seedHash" text NOT NULL UNIQUE CHECK ("seedHash" ~ '^[0-9a-f]{64}$'),
  "expiresAt" timestamptz NOT NULL,
  "consumedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "EcfReceptorSeed_expires_idx" ON public."EcfReceptorSeed" ("expiresAt");

-- 2. Short-lived bearer tokens issued after a signed seed is validated. Only the hash is stored.
CREATE TABLE IF NOT EXISTS public."EcfReceptorToken" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tokenHash" text NOT NULL UNIQUE CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  -- Comma separated VATDO-/IDCDO- identities asserted by the certificate that authenticated.
  "subjectIds" text,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "EcfReceptorToken_expires_idx" ON public."EcfReceptorToken" ("expiresAt");

-- 3. Received e-CF and the ARECF returned to the sender. XML is kept only for accepted documents.
CREATE TABLE IF NOT EXISTS public."EcfReceivedDocument" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "emisorRnc" text NOT NULL,
  "compradorRnc" text NOT NULL,
  encf text NOT NULL,
  "tipoEcf" text,
  estado smallint NOT NULL CHECK (estado IN (0, 1)),
  "motivoNoRecibido" smallint CHECK ("motivoNoRecibido" IN (1, 2, 3, 4)),
  xml text,
  "xmlSha256" text NOT NULL CHECK ("xmlSha256" ~ '^[0-9a-f]{64}$'),
  "arecfXml" text NOT NULL,
  "signerIds" text,
  "signerSerial" text,
  "signerRncMismatch" boolean NOT NULL DEFAULT false,
  "receivedAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ((estado = 1) = ("motivoNoRecibido" IS NOT NULL)),
  CHECK (estado = 1 OR xml IS NOT NULL)
);
-- One accepted document per (emisor, eNCF): the basis of the "duplicate" (code 3) rule.
CREATE UNIQUE INDEX IF NOT EXISTS "EcfReceivedDocument_accepted_uidx"
  ON public."EcfReceivedDocument" ("emisorRnc", encf) WHERE estado = 0;
-- Repeated identical rejected submissions collapse into one audit row.
CREATE UNIQUE INDEX IF NOT EXISTS "EcfReceivedDocument_rejected_uidx"
  ON public."EcfReceivedDocument" ("xmlSha256", "motivoNoRecibido") WHERE estado = 1;
CREATE INDEX IF NOT EXISTS "EcfReceivedDocument_received_idx"
  ON public."EcfReceivedDocument" ("receivedAt" DESC);

-- 4. Received commercial approvals (ACECF): latest per (emisor, eNCF, buyer).
CREATE TABLE IF NOT EXISTS public."EcfReceivedApproval" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "emisorRnc" text NOT NULL,
  "compradorRnc" text NOT NULL,
  encf text NOT NULL,
  estado smallint NOT NULL CHECK (estado IN (1, 2)),
  "detalleMotivoRechazo" text,
  xml text NOT NULL,
  "signerIds" text,
  "signerSerial" text,
  "signerRncMismatch" boolean NOT NULL DEFAULT false,
  "receivedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("emisorRnc", encf, "compradorRnc")
);
CREATE INDEX IF NOT EXISTS "EcfReceivedApproval_received_idx"
  ON public."EcfReceivedApproval" ("receivedAt" DESC);

-- 5. Lockdown: server-side only.
ALTER TABLE public."EcfReceptorSeed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EcfReceptorToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EcfReceivedDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EcfReceivedApproval" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."EcfReceptorSeed" FROM anon, authenticated;
REVOKE ALL ON TABLE public."EcfReceptorToken" FROM anon, authenticated;
REVOKE ALL ON TABLE public."EcfReceivedDocument" FROM anon, authenticated;
REVOKE ALL ON TABLE public."EcfReceivedApproval" FROM anon, authenticated;
