# DGII Electronic Invoicing (e-CF)

## Objective
Port the DGII electronic invoicing module (e-CF, comprobantes fiscales electrónicos: E31, E32, E34) from `cyberbistro` to `FacturaDo-Taller`, adapted for a single-tenant workshop architecture. The target system issues electronic tax receipts according to Dominican Republic General Directorate of Internal Taxes (DGII) specifications.

### Architecture Decision (User-Confirmed)
This architecture supersedes any in-app or client-side runner proposal:
- **Client & Web Application (Next.js App Router):** Server actions only enqueue fiscal jobs into PostgreSQL tables (`EcfDocument` and `FiscalOutbox`). Next.js server actions do NOT sign XML or communicate directly with DGII during the checkout request.
- **Background Fiscal Worker (`fiscal-worker`):** An always-on Node.js daemon running as a dedicated service added to the FacturaDO Docker compose on Dokploy (same proven pattern as cyberbistro's Cloudix stack). The worker claims jobs from `FiscalOutbox` using `SELECT ... FOR UPDATE SKIP LOCKED` over a PostgreSQL connection pool (`worker/fiscal/runFiscalWorker.ts` executed via `tsx`), signs XML documents with RSA-SHA256, uploads signed XML and security codes, submits to DGII endpoints (or RFCE consumer summary), and polls DGII track IDs for final acceptance/rejection.
- **Security & Certificate Custody:** The PKCS#12 digital certificate (`.p12`) and its passphrase remain encrypted (AES-256-GCM) in server-side private storage (`fiscal_certificates` bucket / server directory). Sensitive certificates never travel to cashier/shop desktop PCs running the Electron wrapper.

## Authorized Scope & Explicit Exclusions

### Authorized Scope
- Implementation of all tasks ECF-1 through ECF-9 and operational task ECF-4b.
- Core DGII library vendoring (`dgii-ecf` v1.8.0), database schema migrations, XML mapping, background worker runtime, Next.js server action hooks, thermal 80mm and A4 printed representations with QR codes, fiscal dashboard panel, and onboarding wizard.

### Explicit Exclusions (Hard Boundaries)
- **No Git push:** Never push branches or tags to the remote repository.
- **No Pull Requests:** Do not create or open PRs.
- **No production database writes:** Never execute unverified SQL or direct data mutations against production databases during development.
- **No unapproved migrations:** Database migrations must not be applied to production without explicit user confirmation.
- **No staging unrelated WIP files:** Three working tree files containing prior work (`actions/invoice-actions.ts`, `actions/quote-actions.ts`, `components/modules/invoices/invoice-form.tsx`) must never be committed as part of this feature.

## Constraints
- **Granularity & Sizing:** ~400 authored changed lines per task is a planning heuristic only.
- **Delivery Strategy:** `ask-on-risk`. Total forecast is ~3,700 lines; a commit chaining strategy must be presented to and approved by the user before creating the second commit.
- **Single Working Copy:** No sibling git worktree directories (e.g., no `../FacturaDo-Taller-fiscal`). All work happens within the active repository checkout on branch `feat/electronic-invoicing`.
- **Language & Naming:** All technical artifacts (code, identifiers, SQL, database tables/columns, comments, documentation) must be in English.
- **UI Copy Register:** User-facing UI copy must be in neutral/Dominican Spanish matching existing application conventions (informal "tú" register).
- **Dialogs & Focus:** Strictly no native browser dialogs (`alert`, `confirm`, `prompt`, native `<select>`). All interactions must use internal modal dialogs (Radix UI / shadcn) to prevent focus loss in Electron.

## Test-Driven Development (TDD)
- **Status:** Resolved: OFF (user choice, 2026-11-13).
- **Execution Strategy:** Ordinary functional checks per task (no test runner added; avoids adding Vitest/Jest; throwaway or targeted verification scripts per task).

## Open Questions

| ID | Topic | Description | Status / Impact |
|---|---|---|---|
| **Q1** | **Single-Tenant Config Storage** | Should e-CF settings and sequence ranges be stored as JSON/key-value entries in the existing `Setting` table, or in a dedicated single-row `FiscalConfig` table? | Pending architectural decision. |
| **Q2** | **LicenseCycle vs tenantDebt Gate** | FacturaDo-Taller already features a monthly payment code licensing system (`LicenseCycle` table, `license_status()` RPC, `license-lock-screen.tsx`). Should cyberbistro's `tenantDebt` (WhatsApp contact screen) be harmonized into the existing `LicenseCycle` lock screen or omitted? | **Blocks ECF-9**. |
| **Q3** | **Inbound Receptor Scope** | Is inbound DGII reception (`ecf-receptor` for receiving supplier e-CFs, commercial approvals ARECF/ACECF) required for the workshop initial phase, or is outbound issuance (E31, E32, E34) sufficient? | **Resolved (2026-11-14): IN scope.** DGII certification steps 8-11 require a public receptor. Public domain: `facturado.lat`; URLs registered at DGII are `facturado.lat/{RNC}` (portal appends `/fe/recepcion/api/ecf`, `/fe/aprobacioncomercial/api/ecf`, `/fe/autenticacion/api/[semilla\|validacioncertificado]`). Subdomain/routing to be confirmed when the receptor task starts. |
| **Q4** | **.p12 Provisioning Mode** | Will digital certificates (`.p12`) and their master encryption key be provisioned via environment variables / server storage files, or must a full UI upload wizard with cloud custody be ported? | **Resolved (2026-11-14): option B.** Upload `.p12` in the app + type passphrase, AES-256-GCM custody in server Storage, same as cyberbistro. |

## Tasks & Checklist

Route for all development tasks: `delegated direct` via agy, verified by Claude.

- [x] **ECF-1: Core DGII Library Integration**
  - **Objective:** Port and vendorize `dgii-ecf` (v1.8.0) into FacturaDo-Taller with test coverage for XMLDSig signing, canonicalization, and seed authentication.
  - **Files:** `package.json`, `lib/ecf/` (`P12Reader.ts`, `Signature.ts`, `Digest.ts`, `ECF.ts`, `RestApi.ts`, `restClient.ts`, `Transformer.ts`, `utils/`), test suite.
  - **Estimate:** ~350 authored lines (excluding vendored core files).
  - **Route:** direct inline by Claude (user-authorized override of agy routing, 2026-11-14, until user says to switch back to agy).
  - **Commit Evidence:** `Commit: 2e0d818` (tsc clean, build --webpack OK, throwaway smoke: p12 -> sign -> security code -> validate + tamper rejected).

- [x] **ECF-2: Database Schema & Migrations**
  - **Objective:** Create PostgreSQL tables, constraints, indexes, and sequence allocation triggers for electronic invoicing.
  - **Files:** `migrations/20261114000000_create-ecf-schema.sql` (`EcfDocument`, `FiscalOutbox`, `EcfCertificateMetadata`, `FiscalConfig`, sequence reservation RPCs).
  - **Estimate:** ~320 authored lines (SQL).
  - **Route:** direct inline by Claude (user-authorized, 2026-11-14).
  - **Commit Evidence:** `Commit: c153b0b` (validated on in-memory Postgres/PGlite with stub Invoice/CreditNote: applies twice, sequence reserve/exhausted/expired, doc status sync, unique-per-invoice, re-enqueue idempotency, FK restrict). NOT applied to any real DB. Assumption to confirm at apply time: `CreditNote.id` is uuid (`Invoice.id` confirmed uuid).
  - **APPLIED to production DB 2026-11-14** (user OK) with `insforge db import` for `20261114000000` and `20261114010000` (project oss-project @ base.azokia.com). Verified live with the app's anon key: reads OK, `p12Encrypted`/`select *` on certificates DENIED, direct `EcfDocument` insert DENIED, RPCs validate. `CreditNote.id` confirmed uuid. NOT recorded in `system.migrations` (the license migration `20261112120000` is also applied-but-unlisted, so `insforge db migrations up --all` would re-run it: do not use it blindly).
  - **Design notes:** Q1 resolved as dedicated `FiscalConfig` single-row table + `EcfSequence` per type. RPCs granted to anon/authenticated because `createServerClient` uses the anon key (authorization stays app-level via `requireAuth`). ECF-5 will add the atomic `enqueue` RPC (reserve + EcfDocument + FiscalOutbox + set `Invoice.ncf`).

- [ ] **ECF-3: DGII XML Mapper & Certificate Custody** — *custody DONE (`9f647dd`: `lib/fiscal/{crypto,errors,certificate-custody}.ts`, encrypted p12 + passphrase in `EcfCertificateMetadata`, `store_ecf_certificate` RPC; deviation from cyberbistro: encrypted in DB instead of Storage bucket, avoids creating a prod bucket); XML mapper PENDING (`lib/fiscal/mapper.ts`, port of cyberbistro `worker/fiscal/mapper.ts`).*
  - **Objective:** Map FacturaDo `Invoice` data into DGII-compliant XML schema (E31, E32, E34) and implement AES-256-GCM certificate custody.
  - **Files:** `lib/fiscal/mapper.ts`, `lib/fiscal/crypto.ts`, `lib/fiscal/certificate-custody.ts`.
  - **Estimate:** ~550 authored lines.
  - **Route:** `delegated direct` via agy.
  - **Commit Evidence:** `Commit: [ ]`

- [ ] **ECF-4: Fiscal Worker Service & DGII Transmission Engine**
  - **Objective:** Implement the background fiscal daemon processing outbox jobs, signing XMLs, submitting to DGII, handling RFCE summaries, and polling track IDs.
  - **Files:** `worker/fiscal/runFiscalWorker.ts`, `worker/fiscal/fiscalWorkerRuntime.ts`, `worker/fiscal/fiscalWorker.ts`, `worker/fiscal/dgiiAdapters.ts`, `worker/fiscal/postgresFiscalWorkerRepository.ts`, `worker/fiscal/rfceBatchWorker.ts`.
  - **Estimate:** ~600 authored lines.
  - **Route:** `delegated direct` via agy.
  - **Commit Evidence:** `Commit: [ ]`

- [ ] **ECF-4b: Deploy fiscal-worker service to FacturaDO compose**
  - **Objective:** Deploy the `fiscal-worker` container service into the FacturaDO Docker compose on Dokploy.
  - **Classification:** **Production Operation** (requires explicit user confirmation prior to execution).
  - **Pre-requisite:** Read-only inspection of FacturaDO compose (composeId `HO8bFgiSGDI7T_90xb7Si`, appName `bases-de-datos-facturado-9yrspp`) via Dokploy API (`panel.azokia.com`, token header file `~/.dokploy-token`, token value never printed or logged).
  - **Files:** Dokploy compose configuration for FacturaDO.
  - **Estimate:** Production deployment operation.
  - **Route:** `delegated direct` via agy, verified by Claude.
  - **Commit Evidence:** `Commit: [ ]` (Deployment log / operational verification)

- [ ] **ECF-5: Invoice & Credit Note Lifecycle Hook**
  - **Objective:** Intercept invoice and credit note creation in Next.js server actions to reserve e-NCF and enqueue `EcfDocument` and `FiscalOutbox` entries atomically.
  - **Files:** `actions/invoice-actions.ts`, `actions/credit-note-actions.ts`, `actions/fiscal-actions.ts`.
  - **Estimate:** ~220 authored lines.
  - **Route:** `delegated direct` via agy.
  - **Commit Evidence:** `Commit: [ ]`

- [ ] **ECF-6: Printed Representation & DGII QR Code**
  - **Objective:** Update thermal (80mm) and A4 invoice templates to render e-NCF, sequence expiration dates, 6-digit DGII security code, and verification QR code.
  - **Files:** `components/modules/invoices/invoice-template.tsx`, `components/modules/invoices/invoice-odoo-template.tsx`, `lib/fiscal/qr.ts`.
  - **Estimate:** ~280 authored lines.
  - **Route:** `delegated direct` via agy.
  - **Commit Evidence:** `Commit: [ ]`

- [ ] **ECF-7: Fiscal Management UI Panel**
  - **Objective:** Create the administrative dashboard for e-CF monitoring, displaying document statuses, DGII messages, QR previews, and manual re-enqueue actions.
  - **Files:** `components/modules/fiscal/fiscal-panel.tsx`, `components/modules/fiscal/ecf-qr-modal.tsx`, `app/(dashboard)/fiscal/page.tsx`.
  - **Estimate:** ~450 authored lines.
  - **Route:** `delegated direct` via agy.
  - **Commit Evidence:** `Commit: [ ]`

- [x] **ECF-8a: 15-step certification stepper + certificate upload in Ajustes** (user request 2026-11-14)
  - **Files:** `migrations/20261114010000_ecf-certification-progress.sql`, `lib/fiscal/shared/{certification-steps,receptor-urls}.ts`, `actions/ecf-actions.ts`, `components/modules/fiscal/{certification-stepper,certificate-card,receptor-url-fields}.tsx`, `app/(dashboard)/settings/ecf/page.tsx`, nav + role gating (admin only).
  - **Route:** direct inline by Claude (user-authorized).
  - **Verified:** PGlite checks for the progress table/RPC; helper script (15 steps, restore/advance, RNC -> `facturado.lat/{RNC}`); `tsc` clean; eslint clean on new files; `npm run build -- --webpack` lists `/settings/ecf`. NOT verified visually (needs the migrations applied + login).
  - **Honest gaps:** steps 1 (XML signing), 2-5, 8-11, 13 show "herramienta automática pendiente" and are confirmed manually until their tools exist (signing needs a server with DB access: planned inside the receptor/worker service).
  - **Commit Evidence:** `Commit: see git log (feat(ecf): add certification stepper)`.

- [ ] **ECF-8b: Remaining wizard tools** — issuer data form (`FiscalConfig`), sequences UI (`EcfSequence`), test-set runner, printed representation runner, in-system XML signing, received-evidence panels.

- [ ] **ECF-10: Inbound receptor service on `facturado.lat`** (Q3 resolved IN scope) — public endpoints `/{RNC}/fe/{autenticacion,recepcion,aprobacioncomercial}/api/...`, routing via the Dokploy compose; feeds steps 8-11 evidence. Production routing/ops need explicit user OK.
  - **Code (done, 2026-11-15):** `lib/fiscal/receptor/{protocol,trusted-cas,security,handler,store,index}.ts` (port of cyberbistro `supabase/functions/ecf-receptor`, single company: answers only for Setting `COMPANY_RNC`; ARECF signed with the stored `certification` certificate), route `app/[rnc]/fe/[...service]/route.ts`, `proxy.ts` bypass for `/{RNC}/fe/`, migration `migrations/20261115000000_ecf-receptor.sql` (EcfReceptorSeed/Token, EcfReceivedDocument/Approval; no anon grants).
  - **Route:** direct inline by Claude (user-authorized "construye lo que se necesita").
  - **Verified:** tsc + eslint clean; in-memory flow with the real company certificate: 15/15 (seed, validacioncertificado, replay/other-RNC 401, no token 401, accepted ARECF signed + verifiable, codes 2/3/4, ACECF stored, 503 without seed secret); PGlite migration checks (idempotent, constraints, 0 public grants); `next build` lists `/[rnc]/fe/[...service]`; `next start` HTTP: seed 200 XML, reception without token 401, dashboard still redirects to /login.
  - **Deployed (user OK 2026-11-15):** migration applied to prod; branch pushed; Dokploy app `FacturaDO-receptor` (project Webs, nixpacks, branch `feat/electronic-invoicing`, autodeploy on push) at `https://facturado.lat` with `ECF_RECEPTOR_ONLY=true`. Live checks: seed 200 XML; reception/approval without token 401; `/`, `/login`, `/invoices`, `/api/auth/login` 404; live seed signed with the company certificate -> `validacioncertificado` 200 token.
  - **Also:** steps 8-11 now show `ReceptorEvidencePanel` (public probe + received e-CF/ACECF) instead of the pending-tool notice (commit 5644f25).
  - **Not verified live:** ARECF signing on the server (needs a real DGII submission; verified locally with the same certificate).
  - **Commit Evidence:** `Commit: see git log (feat(ecf): add inbound e-CF receptor)`.

- [ ] **ECF-8 (legacy umbrella): DGII Onboarding & Certification Wizard**
  - **Objective:** Implement step-by-step wizard for issuer configuration, certificate upload, sequence ranges, and DGII test set validation.
  - **Files:** `components/modules/fiscal/activation-wizard.tsx`, `components/modules/fiscal/certificate-uploader.tsx`, `components/modules/fiscal/test-set-runner.tsx`.
  - **Estimate:** ~800 authored lines.
  - **Route:** `delegated direct` via agy.
  - **Commit Evidence:** `Commit: [ ]`

- [ ] **ECF-9: Tenant Debt / License Harmonization**
  - **Objective:** Resolve alignment between cyberbistro's `tenantDebt` concept and FacturaDo-Taller's active monthly payment code licensing system.
  - **Files:** `components/modules/license/license-lock-screen.tsx`, `lib/tenant-debt.ts` (if applicable).
  - **Estimate:** ~120 authored lines.
  - **Route:** `delegated direct` via agy.
  - **Commit Evidence:** `Commit: [ ]`

## Unrelated Working Tree Changes (WIP Guard)

> [!WARNING]
> The following three files are currently modified in the working tree from earlier in-progress work:
> - `actions/invoice-actions.ts`
> - `actions/quote-actions.ts`
> - `components/modules/invoices/invoice-form.tsx`
>
> **Hard Rule:** These files must NEVER be staged or committed by electronic invoicing tasks. When ECF-5 modifies `actions/invoice-actions.ts`, only the specific e-CF enqueue modifications must be staged, preserving unstaged working tree changes.

## Checks & Verification Evidence

All tasks must pass the following verification gates before commit approval:
- **Type Check:** `npx tsc --noEmit`
- **Linting:** `npx eslint <changed-files>`
- **Production Build:** `npm run build -- --webpack`
- **Functional Verification:** Ordinary functional checks per task (no test runner).

| Verification Gate | Command | Result |
|---|---|---|
| TypeScript compilation | `npx tsc --noEmit` | Pending |
| ESLint check | `npx eslint <files>` | Pending |
| Next.js production build | `npm run build -- --webpack` | Pending |
| Functional verification | Throwaway/targeted script per task | Pending |

## Progress
- **Completed Tasks:** 0 / 10 (9 feature tasks + 1 production deployment task)
- **Forecast Lines:** ~3,690 authored lines across 9 feature tasks
- **Current Branch:** `feat/electronic-invoicing`

## Next Step
Commence execution of **ECF-1: Core DGII Library Integration**.

## Phase 2 — Real invoice issuance

DGII certification is complete. The system is transitioning from certification test-set execution to issuing real e-CF electronic receipts in live operations.

### Product Decisions
- **e-CF Document Selection:** E31 (Factura de Crédito Fiscal) is automatically issued when the client has a registered RNC or Cédula of 9 or 11 digits; otherwise, an E32 (Factura de Consumo) is issued. Credit notes are issued as E34 referencing the original e-CF.
- **"Sin comprobante" Toggle:** A "Sin comprobante" sale issues no e-CF document, leaving inventory and ledger updates intact without reserving fiscal sequences or inserting into outbox queues (implemented in task I2).
- **Global Feature Gating:** Real e-CF generation is globally gated by `FiscalConfig.ecfEnabled` (verified in task I2).
- **Test-Driven Development (TDD):** OFF (using targeted functional check scripts per task, no external test runners).

### Tasks

- [x] **ECF-I1: e-CF XML Mapper for Real Invoices & Credit Notes**
  - **Objective:** Pure XML mapper and DB-independent snapshot types for E31 (crédito fiscal), E32 (consumo), and E34 (credit notes) matching the exact element order of DGII-accepted certification submissions, with deterministic money balancing.
  - **Files:** `lib/fiscal/issuance/types.ts`, `lib/fiscal/issuance/errors.ts`, `lib/fiscal/issuance/mapper.ts`, `scripts/check-issuance-mapper.ts`.
  - **Checks:** `npx tsc --noEmit -p .`, `npx eslint lib/fiscal/issuance scripts/check-issuance-mapper.ts`, `npx tsx scripts/check-issuance-mapper.ts` (XML parsing, element order against accepted DGII submissions, required elements, and financial balancing assertions).
  - **Route:** delegated direct via agy.
  - **Built:** Created `lib/fiscal/issuance/types.ts` (`IssuerSnapshot`, `InvoiceSnapshot`, `CreditNoteSnapshot`, `InvoiceLineSnapshot`, `InvoiceTotalsSnapshot`, `ComputedEcfTotals`, `PaymentMethod`), `lib/fiscal/issuance/errors.ts` (`IssuanceError` extending `FiscalError`), and `lib/fiscal/issuance/mapper.ts` (`buildInvoiceEcfXml`, `buildCreditNoteEcfXml`, `computeEcfTotals`). Round 2 review findings implemented:
    - Global discount proration: pure `computeEcfTotals` prorates global discount proportionally across item lines based on gross amounts, last line absorbing rounding remainder; ITBIS computed on discounted base; returns `fiscalTotals` for task I2 persistence.
    - Shipping heuristic removed: no regex; `shipping > 0` appends exempt service line named `Envío`. Discount applies only across real item lines (`DISCOUNT_EXCEEDS_ITEMS` if discount > items gross sum).
    - Precision consistency: `CantidadItem` rounded to 2 decimals first; `PrecioUnitarioItem` rounded to 4 decimals (DGII Decimal(14,4)); `MontoItem = round2(roundedQty * roundedPrice - DescuentoMonto)`; emitted XML values match rounded values.
    - Removed tautological self-comparisons.
    - Explicit payment model: `payment: { method: "CASH" | "TRANSFER" | "CARD" | "CREDIT"; dueDate?: Date | string | null }`, exhaustive switch with TypeScript `never` check; CREDIT requires `dueDate` (`PAYMENT_DUE_DATE_REQUIRED`).
    - Exempt-only documents omit `<TotalITBIS>` per accepted DGII certification submissions (cited case `133339749E430000000011`).
    - Stored totals guard preserved only for no-discount invoices (tolerance 0.01).
    - Verified all 9 test cases in `scripts/check-issuance-mapper.ts`.

- [ ] **ECF-I2: Issuance Hook on Save & 'Sin comprobante' Toggle**
  - **Objective:** Intercept invoice and credit note save actions (`actions/invoice-actions.ts`, `actions/credit-note-actions.ts`) to reserve e-NCF sequence atomically from `EcfSequence`, build issuance snapshot, generate unsigned XML, and enqueue `EcfDocument` and `FiscalOutbox` jobs, gated by `FiscalConfig.ecfEnabled` and the UI "Sin comprobante" toggle.
  - **Files:** `actions/invoice-actions.ts`, `actions/credit-note-actions.ts`, `components/modules/invoices/invoice-form.tsx`, `lib/fiscal/issuance/enqueue.ts`.
  - **Checks:** Functional script simulating invoice creation with and without e-CF flag, verifying DB rows in `EcfDocument`, `FiscalOutbox`, and `EcfSequence`.
  - **Route:** delegated direct via agy.

- [ ] **ECF-I3: Fiscal Background Worker Daemon**
  - **Objective:** Implement the production fiscal worker loop that claims pending outbox jobs with `FOR UPDATE SKIP LOCKED`, signs unsigned e-CF XML with stored certificate custody, submits to DGII (including RFCE summary generation for E32 below threshold), and polls DGII status tracks.
  - **Files:** `worker/fiscal/runFiscalWorker.ts`, `worker/fiscal/workerRuntime.ts`, `worker/fiscal/dgiiTransmission.ts`.
  - **Checks:** Functional verification script running a cycle against test/sandbox DGII endpoints or mock gateway.
  - **Route:** delegated direct via agy.

- [ ] **ECF-I4: Printed Representations (80mm & A4) with DGII Security Code & QR**
  - **Objective:** Update invoice printing templates for thermal 80mm roll and standard A4 paper to include e-NCF, sequence expiration date, 6-digit DGII security code, and official DGII QR code validation link.
  - **Files:** `components/modules/invoices/invoice-template.tsx`, `components/modules/invoices/invoice-odoo-template.tsx`, `lib/fiscal/qr.ts`.
  - **Checks:** Screenshot/render visual inspection script and QR payload format unit check.
  - **Route:** delegated direct via agy.

- [ ] **ECF-I5: Fiscal Configuration, Sequences UI & Status Dashboard**
  - **Objective:** User interface for configuring issuer fiscal data (`FiscalConfig`), managing sequence ranges and alerts (`EcfSequence`), and monitoring e-CF document transmission status, errors, and manual re-enqueue actions.
  - **Files:** `components/modules/fiscal/fiscal-config-form.tsx`, `components/modules/fiscal/sequence-manager.tsx`, `components/modules/fiscal/fiscal-status-panel.tsx`, `app/(dashboard)/settings/fiscal/page.tsx`.
  - **Checks:** Next.js build compilation and client component render tests.
  - **Route:** delegated direct via agy.

