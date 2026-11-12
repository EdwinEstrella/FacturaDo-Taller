# Monthly Payment-Code Licensing Gate

## Objective
Implement a monthly payment licensing gate that enforces subscription renewal (monthly fee of **RD$5,000.00**) on the 11th of each month (America/Santo_Domingo time) with a 3-day grace period. On the 11th at 09:00 America/Santo_Domingo (cron `0 13 * * *` UTC), the system generates an activation code and emails it to the application owner via Resend. The first billed cycle begins in December 2026; November 2026 is seeded as `PAID`. When the client settles their monthly fee, the owner provides the code, which the client enters into a dialog to unlock the application until the subsequent 11th.

## State Rules
All license states are determined server-side using the PostgreSQL database clock in the `America/Santo_Domingo` time zone:
- **`OK`**: Latest cycle is `PAID` or no cycle exists yet. Application is fully operational.
- **`GRACE`**: Latest cycle is `PENDING` and `today <= grace_until` (`grace_until = due_date + 3 days`, i.e., 14th of the month). A non-blocking warning banner is displayed above page content, and an open-on-launch modal alert opens automatically on mount (unless dismissed for the session); application remains fully usable.
- **`LOCKED`**: Latest cycle is `PENDING` and `today > grace_until` (15th of the month onwards). Access is completely blocked by a full-screen lock view; navigation and sidebar are removed; only the code redemption dialog and logout action are accessible. Shows "Monto pendiente: RD$5,000.00".

## Scope
- **T1 — Database & Edge Function**:
  - `migrations/20261112120000_license-payment-cycles.sql`:
    - Enable `pgcrypto` extension.
    - Create `"LicenseCycle"` table with camelCase columns (`period`, `"dueDate"`, `"graceUntil"`, `amount`, `"codeHash"`, `status`, `"failedAttempts"`, `"lastFailedAt"`, `"paidAt"`, `"paidBy"`, `"createdAt"`).
    - Added `amount numeric(12,2) NOT NULL DEFAULT 5000 CHECK (amount > 0)`.
    - Enable RLS, revoke direct access from `anon` and `authenticated`.
    - RPC `license_status()`: `SECURITY DEFINER` returning `{ state, period, due_date, grace_until, days_left, amount }`. Amount is numeric in `GRACE` and `LOCKED`, and `NULL` in `OK`.
    - RPC `redeem_license_code(p_code, p_user)`: `SECURITY DEFINER` handling code normalization, row-level locking (`FOR UPDATE`), 15-minute rate limiting after 5 consecutive failures, hash verification, and atomic state updates.
    - Seed the current month (November 2026) as `PAID` with default amount to ensure zero downtime upon migration; billing activates December 2026.
  - `insforge-functions/license-cycle.ts`:
    - Top-level constant `MONTHLY_FEE_DOP = 5000` as the single source of truth for the monthly price, stored per cycle.
    - Edge function handler targeting Deno runtime, imported via `npm:@insforge/sdk`.
    - Exports default async function handler only (no `Deno.serve` block or legacy `SUPABASE_*` / `process.env` branches).
    - Admin DB client instantiated with reserved project secrets `INSFORGE_BASE_URL` and `API_KEY` (admin key bypassing RLS).
    - Required env validation checking `RESEND_API_KEY`, `LICENSE_FROM_EMAIL`, `LICENSE_NOTIFY_EMAIL`, `INSFORGE_BASE_URL`, and `API_KEY`.
    - Skip execution before day 11 (`before_due_day`).
    - Pre-check for existing cycle for the period.
    - Unbiased rejection-sampling code generation (8 alphanumeric characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, displayed as `XXXX-XXXX`).
    - Insertion of pending cycle record including `amount: MONTHLY_FEE_DOP`; on insert error, re-selects the period to robustly detect concurrent cycle creation (`cycle_exists`).
    - HTML entity escaping via `escapeHtml()` helper for interpolated values in the email body.
    - Currency formatting with `Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" })` yielding `RD$5,000.00`.
    - Display of `Monto: RD$5,000.00` in both plain text and HTML emails sent via Resend.
    - Idempotency key scoped with cycle period and code hash prefix (`license-cycle-${period}-${codeHash.slice(0, 12)}`).
    - Email dispatch via Resend REST API to `LICENSE_NOTIFY_EMAIL` from `LICENSE_FROM_EMAIL` (using `mail.azokia.com`).
    - Atomic rollback (deletion of newly inserted cycle record) if email sending fails.
    - Excluded from Next.js toolchain via `tsconfig.json` (`exclude`) and `eslint.config.mjs` (`globalIgnores`).
- **T2 — Server Actions & Client UI**:
  - `actions/license-actions.ts`:
    - `LicenseStatusResult` includes `amount?: number`.
    - `getLicenseStatus()`: queries `license_status()`, safely coerces `payload.amount` with `Number()`, fails open (`{ state: "OK" }`) on unexpected database errors to prevent spurious client lockouts.
    - `redeemPaymentCode(code)`: requires authentication, validates input length, invokes `redeem_license_code()`, translates error codes to user-friendly Spanish messages (informal "tú" register), and calls `revalidatePath("/", "layout")` on success.
  - `lib/utils.ts`:
    - Existing `formatCurrency` from `lib/utils.ts` is reused (outputs `RD$5,000.00`) and no new helper was added.
  - `components/modules/license/license-open-alert.tsx`:
    - Open-on-launch internal modal dialog using Radix UI/shadcn dialog components.
    - Opens automatically on mount when `license.state === "GRACE"` and not previously dismissed this session.
    - Per-period dismissal flag stored in `sessionStorage` under `license-alert-dismissed-<period>`, wrapped in try/catch to remain functional if storage is blocked.
    - Body copy indicates subscription cost (`RD$5,000.00`), due date (11/MM), and grace deadline (DD/MM).
    - Buttons: "Pegar código de pago" (closes alert and opens `PaymentCodeDialog` without stacking dialogs) and "Recordármelo luego" (sets dismissal flag and closes).
  - `components/modules/license/payment-code-dialog.tsx`:
    - Internal modal dialog using Radix UI/shadcn dialog components (strictly no native browser popups).
    - Auto-focus uppercase code input, clipboard paste helper, pending state indicator, and inline error reporting.
    - Close timer tracked via `useRef` and cleanly cleared in effect cleanup on unmount or when `open` becomes false.
  - `components/modules/license/license-grace-banner.tsx`:
    - Warning banner indicating pending amount when available (`Pago pendiente (RD$5,000.00): te quedan N días de gracia (hasta el DD/MM).`) and triggering the code redemption dialog.
  - `components/modules/license/license-lock-screen.tsx`:
    - Full-screen barrier displayed when license state is `LOCKED`, displaying "Monto pendiente: RD$5,000.00", provider contact notice, payment code dialog trigger, and logout action.
    - Uses consistent informal "tú" copy register.
  - Integration into `app/(dashboard)/layout.tsx` and `components/layout/dashboard-shell.tsx`:
    - Evaluate license state server-side.
    - If `LOCKED`, return `LicenseLockScreen` passing `license.amount`.
    - If `GRACE`, pass license data to `DashboardShell` to render both `LicenseGraceBanner` and `LicenseOpenAlert`.
    - Keep active shift status logic unchanged.

## Constraints
- Artifacts (code, comments, SQL, identifiers) in English.
- UI copy visible to end users in Spanish matching existing application conventions (informal "tú" register).
- No native popups (`alert`, `confirm`, `prompt`, native `<select>`); strictly internal modal dialogs to preserve Electron window focus.
- No writes to production during development (no CLI migrations, deployments, secrets, or schedules created).
- No Git commits created (staged and committed by orchestrator/reviewer).
- Type-check via `npx tsc --noEmit`, lint via `npx eslint <changed files>`, and production build verification via `npm run build -- --webpack`.

## Acceptance Criteria
- [x] Current cycle (November 2026) seeded as `PAID` with default amount; first billed cycle begins December 2026.
- [x] Amount column `amount numeric(12,2) NOT NULL DEFAULT 5000 CHECK (amount > 0)` in `"LicenseCycle"`.
- [x] `license_status()` returns `amount` in `GRACE` and `LOCKED` states and `NULL` in `OK`.
- [x] Edge function defines `MONTHLY_FEE_DOP = 5000` and emails `Monto: RD$5,000.00` in plain text and HTML.
- [x] Open-on-launch alert (`LicenseOpenAlert`) opens automatically on mount in `GRACE` state unless dismissed this session.
- [x] Alert transitions directly to `PaymentCodeDialog` without dialog stacking.
- [x] Session dismissal persisted in `sessionStorage` under `license-alert-dismissed-<period>`.
- [x] Grace banner displays formatted amount `(RD$5,000.00)`.
- [x] Lock screen accepts optional `amount` prop and renders "Monto pendiente: RD$5,000.00".
- [x] Server-side calculation strictly bound to `America/Santo_Domingo` time zone.
- [x] Days 11 to 14 show grace banner and open alert; day 15 locks the application.
- [x] Transient database errors in `getLicenseStatus` fail open (`state: "OK"`).
- [x] Zero native browser dialogs; consistent informal "tú" register.

## Round 3 Review Updates
- **Amount configuration & schema**:
  - Added `amount numeric(12,2) NOT NULL DEFAULT 5000 CHECK (amount > 0)` to `"LicenseCycle"`.
  - Added `"amount"` field to `license_status()` output payloads.
  - Added `MONTHLY_FEE_DOP = 5000` constant in `insforge-functions/license-cycle.ts` inserted during cycle creation.
  - Included `Monto: RD$5,000.00` in both text and HTML Resend notifications.
  - Added `amount?: number` to `LicenseStatusResult` and mapped it safely in `getLicenseStatus()`.
  - Existing `formatCurrency` from `lib/utils.ts` is reused (outputs `RD$5,000.00`) and no new helper was added.
- **Open-on-launch alert modal**:
  - Implemented `components/modules/license/license-open-alert.tsx` opening on mount when `state === "GRACE"` and not dismissed this session.
  - Session dismissal tracked under `license-alert-dismissed-<period>` in `sessionStorage` with try/catch error guards.
  - Seamless handover to `PaymentCodeDialog` ensuring only one modal is ever open at a time.
- **Grace banner & Lock screen display**:
  - `LicenseGraceBanner` includes `(RD$5,000.00)` in notice copy.
  - `LicenseLockScreen` accepts `amount?: number` and renders prominent badge `Monto pendiente: RD$5,000.00`.
  - `app/(dashboard)/layout.tsx` passes `amount={license.amount}` to lock screen.
- **Schedule specification**:
  - Updated scheduled daily cron to `0 13 * * *` UTC (= 09:00 America/Santo_Domingo).

## Checks
- `npx tsc --noEmit` — Pending verification.
- `npx eslint actions/license-actions.ts app/(dashboard)/layout.tsx components/layout/dashboard-shell.tsx components/modules/license/license-grace-banner.tsx components/modules/license/license-lock-screen.tsx components/modules/license/license-open-alert.tsx components/modules/license/payment-code-dialog.tsx lib/utils.ts` — Pending verification.
- `npm run build -- --webpack` — Pending verification.

## Deployment (needs user OK, NOT done)
The following deployment steps are planned for execution upon user confirmation:

### Pre-Deploy Checklist
- [ ] Confirm database migration is ready to run.
- [ ] Confirm Resend domain `mail.azokia.com` is verified and active.
- [ ] Smoke-test: verify that the function's admin client (`createClient({ baseUrl, anonKey: API_KEY })`) can read and insert in `"LicenseCycle"` (bypassing RLS on a table with no policies).

### Deployment Procedure
1. Apply the database migration:
   ```bash
   insforge db query < migrations/20261112120000_license-payment-cycles.sql
   ```
2. Configure required InsForge secrets:
   - Note: `INSFORGE_BASE_URL` and `API_KEY` already exist as reserved InsForge project secrets (do **NOT** add or overwrite them).
   - Add only the missing external secrets:
     ```bash
     insforge secrets add RESEND_API_KEY "<key>"
     insforge secrets add LICENSE_FROM_EMAIL "FacturaDo <billing@mail.azokia.com>"
     insforge secrets add LICENSE_NOTIFY_EMAIL "azokiallc@gmail.com"
     ```
3. Deploy the edge function:
   ```bash
   insforge functions deploy license-cycle --file insforge-functions/license-cycle.ts --name "License Cycle Automation" --description "Monthly licensing payment code generator and notifier"
   ```
4. Create the daily cron schedule:
   ```bash
   insforge schedules create --name "license-cycle-daily" --cron "0 13 * * *" --url "<INSFORGE_BASE_URL>/functions/license-cycle" --method "POST" --headers '{"Content-Type":"application/json"}'
   ```
   *(Note: 13:00 UTC corresponds to 09:00 AM America/Santo_Domingo. The real base URL must be read from the linked project via `insforge secrets get INSFORGE_BASE_URL`, or `insforge current`/`metadata` before creating the schedule).*
5. Perform a smoke test by manually invoking the function:
   ```bash
   insforge functions invoke license-cycle --method POST
   ```
   - Before day 11, verify it responds with `{ "skipped": "before_due_day" }`.
   - On/after day 11, verify cycle creation and receipt of notification email.
