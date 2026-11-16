// SERVER ONLY. XML signing / verification for the inbound e-CF receptor.
// Port of cyberbistro supabase/functions/ecf-receptor/security.ts on Node packages: the vendored dgii-ecf
// Signature for DGII-compatible signing, xml-crypto + @xmldom/xmldom for independent verification of
// incoming signed XML, node-forge for the certificate chain.
import { DOMParser } from "@xmldom/xmldom";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import Signature from "../../ecf/Signature/Signature";
import { extractSubjectIdentities, hasForbiddenXml, type SubjectIdentities } from "./protocol";

export interface SigningMaterial {
  key: string;
  cert: string;
}

export interface VerifyResult {
  valid: boolean;
  /** Short, non-sensitive reason when invalid (for logs only). */
  reason?: string;
  /**
   * How the signer was trusted, set only when valid: "anchor" chains to a trusted CA; "pinned" is an exact
   * match of a pinned certification-environment signer, which the caller must restrict to non-production tenants.
   */
  trust?: "anchor" | "pinned";
  /** Identities asserted by the (trusted) signer certificate. Empty unless valid. */
  companyIds: string[];
  personIds: string[];
  serial: string | null;
}

const NO_IDENTITY: Pick<SubjectIdentities, "companyIds" | "personIds" | "serial"> = { companyIds: [], personIds: [], serial: null };

export interface XmlSecurity {
  sign(material: SigningMaterial, xml: string, rootElement: string): string;
  verify(xml: string, now: Date): VerifyResult;
}

const DSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const MAX_CHAIN_DEPTH = 4;
const MAX_EMBEDDED_CERTIFICATES = 5;

function pemFromBase64Der(base64: string): string {
  const body = base64.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

export function sign(material: SigningMaterial, xml: string, rootElement: string): string {
  return new Signature(material.key, material.cert).signXml(xml, rootElement);
}

type Certificate = forge.pki.Certificate;

function parseCertificates(pems: readonly string[]): Certificate[] {
  const certificates: Certificate[] = [];
  for (const pem of pems) {
    for (const block of pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? []) {
      try {
        certificates.push(forge.pki.certificateFromPem(block));
      } catch {
        // An unreadable entry must never widen trust; skip it.
      }
    }
  }
  return certificates;
}

function isCa(cert: Certificate): boolean {
  const constraints = cert.getExtension("basicConstraints") as { cA?: boolean } | null;
  return constraints?.cA === true;
}

function validAt(cert: Certificate, now: Date): boolean {
  return now >= cert.validity.notBefore && now <= cert.validity.notAfter;
}

function sameCertificate(a: Certificate, b: Certificate): boolean {
  return forge.pki.certificateToPem(a) === forge.pki.certificateToPem(b);
}

function issuedBy(child: Certificate, parent: Certificate): boolean {
  try {
    return parent.verify(child);
  } catch {
    return false;
  }
}

/**
 * Chain of trust to the configured anchors. Anchors may be roots or intermediates (subscriber
 * certificates are issued by intermediates and the XML only carries the leaf). Self-signed
 * certificates, CA certificates used as leaf, expired links and unknown issuers are rejected.
 * Revocation (OCSP/CRL) is NOT checked.
 */
export function chainsToAnchors(leaf: Certificate, extras: Certificate[], anchors: Certificate[], now: Date): string | null {
  if (anchors.length === 0) return "empty trust store";
  if (isCa(leaf)) return "signer certificate is a CA";
  let current = leaf;
  const pool = [...extras];
  for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
    if (!validAt(current, now)) return "certificate outside validity period";
    if (depth > 0 && anchors.some((anchor) => sameCertificate(anchor, current))) return null;
    const anchor = anchors.find((candidate) => !sameCertificate(candidate, current) && validAt(candidate, now) && issuedBy(current, candidate));
    if (anchor) return null;
    const intermediate = pool.find((candidate) => isCa(candidate) && !sameCertificate(candidate, current) && issuedBy(current, candidate));
    if (!intermediate) return "issuer is not trusted";
    pool.splice(pool.indexOf(intermediate), 1);
    current = intermediate;
  }
  return "chain too long";
}

function attributesOf(cert: Certificate) {
  return cert.subject.attributes.map((attribute) => ({
    type: attribute.type as string | undefined,
    shortName: attribute.shortName as string | undefined,
    name: attribute.name as string | undefined,
    value: attribute.value as unknown,
  }));
}

export function createXmlSecurity(options: { trustedCaPems: readonly string[]; pinnedSignerPems?: readonly string[] }): XmlSecurity {
  const anchors = parseCertificates(options.trustedCaPems);
  const pinnedSigners = parseCertificates(options.pinnedSignerPems ?? []);

  function verify(xml: string, now: Date): VerifyResult {
    const fail = (reason: string): VerifyResult => ({ valid: false, reason, ...NO_IDENTITY });
    try {
      if (hasForbiddenXml(xml)) return fail("forbidden XML construct");
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const signatures = doc.getElementsByTagNameNS(DSIG_NS, "Signature");
      if (signatures.length !== 1) return fail("expected exactly one Signature");
      const signatureNode = signatures[0];
      const certNodes = signatureNode.getElementsByTagNameNS(DSIG_NS, "X509Certificate");
      const certs = Array.from({ length: certNodes.length }, (_, index) => certNodes[index].textContent?.trim() ?? "").filter(Boolean);
      if (certs.length === 0) return fail("missing X509Certificate");
      if (certs.length > MAX_EMBEDDED_CERTIFICATES) return fail("too many embedded certificates");
      const leafPem = pemFromBase64Der(certs[0]);
      const leaf = forge.pki.certificateFromPem(leafPem);
      const extras = certs.slice(1).map((base64) => forge.pki.certificateFromPem(pemFromBase64Der(base64)));

      let trust: "anchor" | "pinned" = "anchor";
      const chainError = chainsToAnchors(leaf, extras, anchors, now);
      if (chainError) {
        // A pin only ever replaces trust in the LEAF itself; any other failure (CA as signer, expiry) stays fatal.
        const pinned = chainError === "issuer is not trusted" && !isCa(leaf) && validAt(leaf, now) && pinnedSigners.some((pin) => sameCertificate(pin, leaf));
        if (!pinned) return fail(chainError);
        trust = "pinned";
      }

      const verifier = new SignedXml({ publicCert: leafPem });
      verifier.loadSignature(signatureNode);
      const references = verifier.getReferences();
      if (references.length !== 1 || (references[0].uri ?? "") !== "") return fail("reference must cover the whole document");
      if (!verifier.checkSignature(xml)) return fail("signature mismatch");
      return { valid: true, trust, ...extractSubjectIdentities(attributesOf(leaf)) };
    } catch {
      return fail("verification error");
    }
  }

  return { sign, verify };
}
