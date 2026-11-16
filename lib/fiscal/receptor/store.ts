// SERVER ONLY. InsForge-backed ReceptorStore. The receptor tables hold tokens and signed XML and are not
// granted to the app's anon key, so this uses the server-side admin key.
import { createFiscalAdminClient } from "../admin-client";
import type { ReceivedApprovalRow, ReceivedDocumentRow, ReceptorStore } from "./handler";

/** Expired seeds/tokens are purged opportunistically once they are this old. */
const PURGE_AFTER_MS = 24 * 3600 * 1000;

function fail(operation: string): never {
  throw new Error(`Receptor store operation failed: ${operation}`);
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "23505" || /duplicate key/i.test(String(error?.message ?? ""));
}

function adminClient() {
  try {
    return createFiscalAdminClient();
  } catch {
    fail("server not configured");
  }
}

export function createInsforgeReceptorStore(): ReceptorStore {
  const db = adminClient().database;

  async function purgeExpired(table: "EcfReceptorSeed" | "EcfReceptorToken", now: Date): Promise<void> {
    // Best effort housekeeping: a failed purge never fails the request.
    await db
      .from(table)
      .delete()
      .lt("expiresAt", new Date(now.getTime() - PURGE_AFTER_MS).toISOString());
  }

  return {
    async companyRnc() {
      const { data, error } = await db.from("Setting").select("value").eq("key", "COMPANY_RNC").limit(1);
      if (error) fail("companyRnc");
      const digits = typeof data?.[0]?.value === "string" ? data[0].value.replace(/\D/g, "") : "";
      return digits || null;
    },

    async consumeSeed(hash, expiresAt, now) {
      // Insert-as-consumed: the unique seedHash makes a second use fail atomically.
      const { error } = await db
        .from("EcfReceptorSeed")
        .insert([{ seedHash: hash, expiresAt: expiresAt.toISOString(), consumedAt: now.toISOString() }]);
      if (isUniqueViolation(error)) return false;
      if (error) fail("consumeSeed");
      await purgeExpired("EcfReceptorSeed", now);
      return true;
    },

    async createToken(hash, expiresAt, subjectIds) {
      const { error } = await db
        .from("EcfReceptorToken")
        .insert([{ tokenHash: hash, expiresAt: expiresAt.toISOString(), subjectIds: subjectIds.join(",") || null }]);
      if (error) fail("createToken");
      await purgeExpired("EcfReceptorToken", new Date());
    },

    async findToken(hash, now) {
      const { data, error } = await db
        .from("EcfReceptorToken")
        .select("subjectIds")
        .eq("tokenHash", hash)
        .gt("expiresAt", now.toISOString())
        .limit(1);
      if (error) fail("findToken");
      const row = data?.[0];
      if (!row) return null;
      const subjectIds = typeof row.subjectIds === "string" ? row.subjectIds.split(",").filter(Boolean) : [];
      return { subjectIds };
    },

    async hasAcceptedDocument(emisorRnc, encf) {
      const { data, error } = await db
        .from("EcfReceivedDocument")
        .select("id")
        .eq("emisorRnc", emisorRnc)
        .eq("encf", encf)
        .eq("estado", 0)
        .limit(1);
      if (error) fail("hasAcceptedDocument");
      return Array.isArray(data) && data.length > 0;
    },

    async insertDocument(row: ReceivedDocumentRow) {
      const { error } = await db.from("EcfReceivedDocument").insert([
        {
          emisorRnc: row.emisorRnc,
          compradorRnc: row.compradorRnc,
          encf: row.encf,
          tipoEcf: row.tipoEcf,
          estado: row.estado,
          motivoNoRecibido: row.motivoNoRecibido,
          xml: row.xml,
          xmlSha256: row.xmlSha256,
          arecfXml: row.arecfXml,
          signerIds: row.signerIds.join(",") || null,
          signerSerial: row.signerSerial,
          signerRncMismatch: row.signerRncMismatch,
        },
      ]);
      if (isUniqueViolation(error)) return "duplicate";
      if (error) fail("insertDocument");
      return "inserted";
    },

    async upsertApproval(row: ReceivedApprovalRow) {
      const { error } = await db.from("EcfReceivedApproval").upsert(
        {
          emisorRnc: row.emisorRnc,
          compradorRnc: row.compradorRnc,
          encf: row.encf,
          estado: row.estado,
          detalleMotivoRechazo: row.detalleMotivoRechazo,
          xml: row.xml,
          signerIds: row.signerIds.join(",") || null,
          signerSerial: row.signerSerial,
          signerRncMismatch: row.signerRncMismatch,
          receivedAt: new Date().toISOString(),
        },
        { onConflict: "emisorRnc,encf,compradorRnc" },
      );
      if (error) fail("upsertApproval");
    },
  };
}
