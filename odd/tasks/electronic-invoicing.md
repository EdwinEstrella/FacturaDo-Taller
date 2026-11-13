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
- **Status:** Unresolved.
- **Current State:** `package.json` contains no test runner configuration (no Jest, Vitest, or Node test runner scripts).
- **Resolution Requirement:** Test framework and execution strategy must be resolved before executing ECF-1.

## Open Questions

| ID | Topic | Description | Status / Impact |
|---|---|---|---|
| **Q1** | **Single-Tenant Config Storage** | Should e-CF settings and sequence ranges be stored as JSON/key-value entries in the existing `Setting` table, or in a dedicated single-row `FiscalConfig` table? | Pending architectural decision. |
| **Q2** | **LicenseCycle vs tenantDebt Gate** | FacturaDo-Taller already features a monthly payment code licensing system (`LicenseCycle` table, `license_status()` RPC, `license-lock-screen.tsx`). Should cyberbistro's `tenantDebt` (WhatsApp contact screen) be harmonized into the existing `LicenseCycle` lock screen or omitted? | **Blocks ECF-9**. |
| **Q3** | **Inbound Receptor Scope** | Is inbound DGII reception (`ecf-receptor` for receiving supplier e-CFs, commercial approvals ARECF/ACECF) required for the workshop initial phase, or is outbound issuance (E31, E32, E34) sufficient? | Pending scope confirmation (default: outbound only for v1). |
| **Q4** | **.p12 Provisioning Mode** | Will digital certificates (`.p12`) and their master encryption key be provisioned via environment variables / server storage files, or must a full UI upload wizard with cloud custody be ported? | **Blocks ECF-3 / ECF-8**. |

## Tasks & Checklist

Route for all development tasks: `delegated direct` via agy, verified by Claude.

- [ ] **ECF-1: Core DGII Library Integration**
  - **Objective:** Port and vendorize `dgii-ecf` (v1.8.0) into FacturaDo-Taller with test coverage for XMLDSig signing, canonicalization, and seed authentication.
  - **Files:** `package.json`, `lib/ecf/` (`P12Reader.ts`, `Signature.ts`, `Digest.ts`, `ECF.ts`, `RestApi.ts`, `restClient.ts`, `Transformer.ts`, `utils/`), test suite.
  - **Estimate:** ~350 authored lines (excluding vendored core files).
  - **Route:** `delegated direct` via agy.
  - **Commit Evidence:** `Commit: [ ]`

- [ ] **ECF-2: Database Schema & Migrations**
  - **Objective:** Create PostgreSQL tables, constraints, indexes, and sequence allocation triggers for electronic invoicing.
  - **Files:** `migrations/20261114000000_create-ecf-schema.sql` (`EcfDocument`, `FiscalOutbox`, `EcfCertificateMetadata`, `FiscalConfig`, sequence reservation RPCs).
  - **Estimate:** ~320 authored lines (SQL).
  - **Route:** `delegated direct` via agy.
  - **Commit Evidence:** `Commit: [ ]`

- [ ] **ECF-3: DGII XML Mapper & Certificate Custody**
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

- [ ] **ECF-8: DGII Onboarding & Certification Wizard**
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
- **TDD / Unit Tests:** Test runner verification (once resolved).

| Verification Gate | Command | Result |
|---|---|---|
| TypeScript compilation | `npx tsc --noEmit` | Pending |
| ESLint check | `npx eslint <files>` | Pending |
| Next.js production build | `npm run build -- --webpack` | Pending |
| Unit tests | TBD | Pending |

## Progress
- **Completed Tasks:** 0 / 10 (9 feature tasks + 1 production deployment task)
- **Forecast Lines:** ~3,690 authored lines across 9 feature tasks
- **Current Branch:** `feat/electronic-invoicing`

## Next Step
Resolve the TDD runner approach, then commence execution of **ECF-1: Core DGII Library Integration**.
