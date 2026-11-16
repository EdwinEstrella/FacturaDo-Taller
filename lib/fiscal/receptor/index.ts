// SERVER ONLY. Wires the inbound e-CF receptor with the real InsForge store, the stored company
// certificate and the trusted Dominican CAs. Used by app/[rnc]/fe/[...service]/route.ts.
import type { EcfEnvironment } from "../certificate-custody";
import { loadStoredSigningMaterial } from "../stored-certificate";
import { handleReceptorRequest, type ReceptorDeps } from "./handler";
import { createXmlSecurity, type XmlSecurity } from "./security";
import { createInsforgeReceptorStore } from "./store";
import { BUILT_IN_TRUSTED_CAS, DGII_CERTIFICATION_SIGNERS } from "./trusted-cas";

/**
 * Environment whose certificate signs the ARECF. The receptor serves the DGII certification steps 8-11
 * (CerteCF), the same environment the certification runs use; switch it when going to production.
 */
const RECEPTOR_ENVIRONMENT: EcfEnvironment = "certification";

/** Built-in Dominican CAs plus an optional PEM bundle (e.g. DGII certification-environment CAs). */
function trustedCaPems(): string[] {
  const extra = process.env.ECF_RECEPTOR_TRUSTED_CA_PEMS?.trim();
  return [...BUILT_IN_TRUSTED_CAS.map((ca) => ca.pem), ...(extra ? [extra] : [])];
}

/** Pinned DGII certification-environment signers plus an optional PEM bundle, so ops can rotate the pin without a deploy. */
function pinnedSignerPems(): string[] {
  const extra = process.env.ECF_RECEPTOR_PINNED_SIGNER_PEMS?.trim();
  return [...DGII_CERTIFICATION_SIGNERS.map((signer) => signer.pem), ...(extra ? [extra] : [])];
}

let security: XmlSecurity | null = null;

function receptorDeps(): ReceptorDeps {
  security ??= createXmlSecurity({ trustedCaPems: trustedCaPems(), pinnedSignerPems: pinnedSignerPems() });
  return {
    store: createInsforgeReceptorStore(),
    security,
    loadSigningMaterial: () => loadStoredSigningMaterial(RECEPTOR_ENVIRONMENT),
    allowsCertificationSigners: RECEPTOR_ENVIRONMENT !== "production",
    now: () => new Date(),
    // Seeds are HMAC-authenticated with a dedicated server-only secret. Required: without it the
    // receptor answers 503 (fail closed).
    seedSecret: () => process.env.ECF_RECEPTOR_SEED_SECRET?.trim() || undefined,
    // Never log payloads, certificates or secrets: event names and short codes only.
    log: (event, detail) => console.warn(`[ecf-receptor] ${event}`, detail ?? {}),
  };
}

export async function handleEcfReceptor(req: Request): Promise<Response> {
  let deps: ReceptorDeps;
  try {
    deps = receptorDeps();
  } catch {
    console.warn("[ecf-receptor] missing required server configuration");
    return new Response(JSON.stringify({ error: "The receptor is not configured.", code: "NOT_CONFIGURED" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return handleReceptorRequest(req, deps);
}
