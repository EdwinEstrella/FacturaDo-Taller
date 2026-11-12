/**
 * Deployed to the InsForge edge function runner, which evaluates this file as CommonJS
 * JavaScript without TypeScript transpilation; therefore it uses module.exports, no type
 * annotations, and loads the SDK with a dynamic await import("npm:@insforge/sdk") inside
 * the handler (a top-level ESM import or export default fails with HTTP 500).
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 30 characters (no I, L, O, 0, 1)
const ALPHABET_LEN = ALPHABET.length;

/** Single place to change the monthly price; it is stored on each cycle. */
const MONTHLY_FEE_DOP = 5000;

/**
 * Escapes characters for safe interpolation into HTML templates.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generates an 8-character payment code using cryptographic rejection sampling to avoid modulo bias.
 * Formatted as XXXX-XXXX.
 */
function generatePaymentCode() {
  const chars = [];
  const buffer = new Uint8Array(16);

  // 256 - (256 % 30) = 240. Values >= 240 are rejected to ensure a uniform distribution.
  while (chars.length < 8) {
    crypto.getRandomValues(buffer);
    for (let i = 0; i < buffer.length && chars.length < 8; i++) {
      const byte = buffer[i];
      if (byte < 240) {
        chars.push(ALPHABET[byte % ALPHABET_LEN]);
      }
    }
  }

  const raw = chars.join("");
  const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return { formatted, raw };
}

/**
 * Computes the current date in America/Santo_Domingo.
 */
function getSantoDomingoDate() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parseInt(parts.find((p) => p.type === "day")?.value || "0", 10);
  const period = `${year}-${month}`;
  return { year, month, day, period };
}

/**
 * Edge function handler executed daily via cron.
 */
module.exports = async function handleLicenseCycleRequest(req) {
  // Check required environment variables and secrets
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const licenseFromEmail = Deno.env.get("LICENSE_FROM_EMAIL");
  const licenseNotifyEmail = Deno.env.get("LICENSE_NOTIFY_EMAIL");
  const insforgeBaseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("API_KEY");

  const missingSecrets = [];
  if (!resendApiKey) missingSecrets.push("RESEND_API_KEY");
  if (!licenseFromEmail) missingSecrets.push("LICENSE_FROM_EMAIL");
  if (!licenseNotifyEmail) missingSecrets.push("LICENSE_NOTIFY_EMAIL");
  if (!insforgeBaseUrl) missingSecrets.push("INSFORGE_BASE_URL");
  if (!apiKey) missingSecrets.push("API_KEY");

  if (missingSecrets.length > 0) {
    return new Response(
      JSON.stringify({ error: `Missing required secret(s): ${missingSecrets.join(", ")}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 1. Compute today in America/Santo_Domingo. If day < 11 -> skip
  const { year, month, day, period } = getSantoDomingoDate();
  if (day < 11) {
    return new Response(
      JSON.stringify({ skipped: "before_due_day", period, day }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Load InsForge SDK dynamically inside CommonJS handler
  const { createClient } = await import("npm:@insforge/sdk");

  // Normalize base URL if scheme is missing (reserved secret INSFORGE_BASE_URL is 'base.azokia.com')
  const normalizedBaseUrl =
    insforgeBaseUrl.startsWith("http://") || insforgeBaseUrl.startsWith("https://")
      ? insforgeBaseUrl
      : `https://${insforgeBaseUrl}`;

  // API_KEY is the project admin key and bypasses RLS; verify with a smoke test after deploy because LicenseCycle has RLS with no policies.
  const insforge = createClient({
    baseUrl: normalizedBaseUrl,
    anonKey: apiKey,
  });

  // 2. Check if a cycle for this period already exists
  const { data: existingCycles, error: checkError } = await insforge.database
    .from("LicenseCycle")
    .select("id, status")
    .eq("period", period);

  if (checkError) {
    console.error("Database query error:", checkError.message);
    return new Response(
      JSON.stringify({ error: "Failed to query existing license cycle" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (existingCycles && existingCycles.length > 0) {
    return new Response(
      JSON.stringify({ skipped: "cycle_exists", period }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Generate random code and sha256 hash
  const { formatted: formattedCode, raw: codeRaw } = generatePaymentCode();
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeRaw));
  const codeHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toLowerCase();

  const dueDate = `${year}-${month}-11`;
  const graceUntil = `${year}-${month}-14`;

  // 4. Insert the pending cycle
  const { error: insertError } = await insforge.database
    .from("LicenseCycle")
    .insert([
      {
        period,
        dueDate,
        graceUntil,
        amount: MONTHLY_FEE_DOP,
        codeHash,
        status: "PENDING",
      },
    ]);

  if (insertError) {
    console.error("Failed to insert license cycle:", insertError.message);
    // On insert error, re-select the period: if a row exists return cycle_exists, otherwise 500
    const { data: verifyExisting } = await insforge.database
      .from("LicenseCycle")
      .select("id")
      .eq("period", period);

    if (verifyExisting && verifyExisting.length > 0) {
      return new Response(
        JSON.stringify({ skipped: "cycle_exists", period }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Failed to record license cycle in database" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 5. Read company name from Setting table (fallback: 'FacturaDo')
  let companyName = "FacturaDo";
  try {
    const { data: settingRows } = await insforge.database
      .from("Setting")
      .select("value")
      .eq("key", "COMPANY_NAME")
      .limit(1);

    if (settingRows && settingRows.length > 0 && settingRows[0]?.value) {
      companyName = settingRows[0].value;
    }
  } catch (err) {
    console.error("Failed to read COMPANY_NAME setting, falling back to default:", err instanceof Error ? err.message : String(err));
  }

  const formattedAmount = new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
  }).format(MONTHLY_FEE_DOP);

  const safeCompanyName = escapeHtml(companyName);
  const safePeriod = escapeHtml(period);
  const safeFormattedCode = escapeHtml(formattedCode);
  const safeFormattedAmount = escapeHtml(formattedAmount);
  const safeMonth = escapeHtml(month);
  const safeYear = escapeHtml(year);

  // 6. Send the email via Resend REST API
  const textBody = `${companyName} — Código de pago mensual (${period})

Período: ${period}
Monto: ${formattedAmount}
Código de pago: ${formattedCode}

Fecha de vencimiento: 11/${month}/${year}
Último día de gracia: 14/${month}/${year}

Envíale este código al cliente cuando confirme su pago.`;

  const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Código de pago ${safePeriod}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 32px;">
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px; font-weight: 600;">FacturaDo — Código de pago</h2>
    <p style="margin-bottom: 24px; color: #475569; font-size: 14px;">
      Nuevo ciclo generado para la empresa <strong>${safeCompanyName}</strong> correspondiente al período <strong>${safePeriod}</strong>.
    </p>

    <div style="background-color: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 24px;">
      <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 1px; display: block; margin-bottom: 8px;">Código de Activación</span>
      <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #0f172a;">${safeFormattedCode}</span>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Monto:</td>
        <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #0f172a;">${safeFormattedAmount}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Vencimiento:</td>
        <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #0f172a;">11/${safeMonth}/${safeYear}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Último día de gracia:</td>
        <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #0f172a;">14/${safeMonth}/${safeYear}</td>
      </tr>
    </table>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; color: #334155; font-size: 14px; font-weight: 500;">
      Envíale este código al cliente cuando confirme su pago.
    </div>
  </div>
</body>
</html>`;

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `license-cycle-${period}-${codeHash.slice(0, 12)}`,
      },
      body: JSON.stringify({
        from: licenseFromEmail,
        to: [licenseNotifyEmail],
        subject: `Código de pago FacturaDo — ${period}`,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text().catch(() => "");
      console.error("Resend API delivery error status:", resendResponse.status, errorText);

      // Rollback: delete the newly inserted cycle row so next day retry has fresh state
      await insforge.database
        .from("LicenseCycle")
        .delete()
        .eq("period", period);

      return new Response(
        JSON.stringify({ error: "Failed to dispatch notification email via Resend" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("Resend fetch exception:", err instanceof Error ? err.message : String(err));
    // Rollback: delete cycle row
    try {
      await insforge.database
        .from("LicenseCycle")
        .delete()
        .eq("period", period);
    } catch {
      // Ignore secondary error during rollback
    }

    return new Response(
      JSON.stringify({ error: "Email delivery network exception" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      period,
      dueDate,
      graceUntil,
      amount: MONTHLY_FEE_DOP,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
