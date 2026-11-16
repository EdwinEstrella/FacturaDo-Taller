// SERVER ONLY. Reads what the public receptor received (certification steps 8-11) and probes that the
// public receptor answers. The receptor tables are not granted to the anon key: admin key only.
import { createFiscalAdminClient } from "../admin-client";
import { buildReceptorUrls } from "../shared/receptor-urls";
import type { ReceivedApprovalView, ReceivedDocumentView, ReceptorEvidence } from "../shared/receptor-evidence";

const EVIDENCE_LIMIT = 100;
const PROBE_TIMEOUT_MS = 8000;

function adminDatabase() {
  try {
    return createFiscalAdminClient().database;
  } catch {
    throw new Error("Receptor evidence: server not configured");
  }
}

async function probeSeed(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return response.ok && (await response.text()).includes("<SemillaModel");
  } catch {
    return false;
  }
}

export async function loadReceptorEvidence(companyRnc: string): Promise<ReceptorEvidence> {
  const urls = buildReceptorUrls(companyRnc);
  const probeUrl = `https://${urls.portalField}/fe/autenticacion/api/semilla`;
  const db = adminDatabase();
  const [online, documents, approvals] = await Promise.all([
    urls.ready ? probeSeed(probeUrl) : Promise.resolve(false),
    db
      .from("EcfReceivedDocument")
      .select("id, encf, tipoEcf, emisorRnc, estado, motivoNoRecibido, signerRncMismatch, receivedAt")
      .order("receivedAt", { ascending: false })
      .limit(EVIDENCE_LIMIT),
    db
      .from("EcfReceivedApproval")
      .select("id, encf, emisorRnc, compradorRnc, estado, detalleMotivoRechazo, receivedAt")
      .order("receivedAt", { ascending: false })
      .limit(EVIDENCE_LIMIT),
  ]);
  if (documents.error || approvals.error) throw new Error("Receptor evidence: lookup failed");
  return {
    online,
    probeUrl,
    documents: (documents.data ?? []) as ReceivedDocumentView[],
    approvals: (approvals.data ?? []) as ReceivedApprovalView[],
  };
}
