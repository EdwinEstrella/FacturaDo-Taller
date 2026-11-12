# Monthly Payment-Code Licensing Gate

## Objective
Implement a monthly payment licensing gate that enforces subscription renewal on the 11th of each month (America/Santo_Domingo time) with a 3-day grace period. On the 11th, the system generates an activation code and emails it to the application owner via Resend. When the client settles their monthly fee, the owner provides the code, which the client enters into a dialog to unlock the application until the subsequent 11th.

## State Rules
All license states are determined server-side using the PostgreSQL database clock in the `America/Santo_Domingo` time zone:
- **`OK`**: Latest cycle is `PAID` or no cycle exists yet. Application is fully operational.
- **`GRACE`**: Latest cycle is `PENDING` and `today <= grace_until` (`grace_until = due_date + 3 days`, i.e., 14th of the month). A non-blocking warning banner is displayed above page content; application remains fully usable.
- **`LOCKED`**: Latest cycle is `PENDING` and `today > grace_until` (15th of the month onwards). Access is completely blocked by a full-screen lock view; navigation and sidebar are removed; only the code redemption dialog and logout action are accessible.

## Scope
- **T1 — Database & Edge Function**:
  - `migrations/20261112120000_license-payment-cycles.sql`:
    - Enable `pgcrypto` extension.
    - Create `"LicenseCycle"` table with camelCase columns (`period`, `"dueDate"`, `"graceUntil"`, `"codeHash"`, `status`, `"failedAttempts"`, `"lastFailedAt"`, `"paidAt"`, `"paidBy"`, `"createdAt"`).
    - Enable RLS, revoke direct access from `anon` and `authenticated`.
    - RPC `license_status()`: `SECURITY DEFINER` returning `{ state, period, due_date, grace_until, days_left }`.
    - RPC `redeem_license_code(p_code, p_user)`: `SECURITY DEFINER` handling code normalization, row-level locking (`FOR UPDATE`), 15-minute rate limiting after 5 consecutive failures, hash verification, and atomic state updates.
    - Seed the current month as `PAID` to ensure zero downtime upon migration.
  - `insforge-functions/license-cycle.ts`:
    - Edge function handler targeting Deno runtime, imported via `npm:@insforge/sdk`.
    - Exports default async function handler only (no `Deno.serve` block or legacy `SUPABASE_*` / `process.env` branches).
    - Admin DB client instantiated with reserved project secrets `INSFORGE_BASE_URL` and `API_KEY` (admin key bypassing RLS).
    - Required env validation checking `RESEND_API_KEY`, `LICENSE_FROM_EMAIL`, `LICENSE_NOTIFY_EMAIL`, `INSFORGE_BASE_URL`, and `API_KEY`.
    - Skip execution before day 11 (`before_due_day`).
    - Pre-check for existing cycle for the period.
    - Unbiased rejection-sampling code generation (8 alphanumeric characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, displayed as `XXXX-XXXX`).
    - Insertion of pending cycle record; on insert error, re-selects the period to robustly detect concurrent cycle creation (`cycle_exists`) without brittle error string matching.
    - HTML entity escaping via `escapeHtml()` helper for interpolated values in the email body.
    - Idempotency key scoped with cycle period and code hash prefix (`license-cycle-${period}-${codeHash.slice(0, 12)}`).
    - Email dispatch via Resend REST API to `LICENSE_NOTIFY_EMAIL` from `LICENSE_FROM_EMAIL` (using `mail.azokia.com`).
    - Atomic rollback (deletion of newly inserted cycle record) if email sending fails.
    - Excluded from Next.js toolchain via `tsconfig.json` (`exclude`) and `eslint.config.mjs` (`globalIgnores`).
- **T2 — Server Actions & Client UI**:
  - `actions/license-actions.ts`:
    - `getLicenseStatus()`: queries `license_status()`, fails open (`{ state: "OK" }`) on unexpected database errors to prevent spurious client lockouts.
    - `redeemPaymentCode(code)`: requires authentication, validates input length, invokes `redeem_license_code()`, translates error codes to user-friendly Spanish messages (informal "tú" register), and calls `revalidatePath("/", "layout")` on success.
  - `components/modules/license/payment-code-dialog.tsx`:
    - Internal modal dialog using Radix UI/shadcn dialog components (strictly no native browser popups).
    - Auto-focus uppercase code input, clipboard paste helper, pending state indicator, and inline error reporting.
    - Close timer tracked via `useRef` and cleanly cleared in effect cleanup on unmount or when `open` becomes false.
  - `components/modules/license/license-grace-banner.tsx`:
    - Warning banner indicating remaining grace days and triggering the code redemption dialog.
  - `components/modules/license/license-lock-screen.tsx`:
    - Full-screen barrier displayed when license state is `LOCKED`, providing provider contact notice, payment code dialog trigger, and logout action.
    - Uses consistent informal "tú" copy register ("tu suscripción mensual", "comunícate con el proveedor", "ingresa el código").
  - Integration into `app/(dashboard)/layout.tsx` and `components/layout/dashboard-shell.tsx`:
    - Evaluate license state server-side.
    - If `LOCKED`, return only `LicenseLockScreen`.
    - If `GRACE`, pass license data to `DashboardShell` to render the grace banner above content.
    - Keep active shift status logic unchanged.

## Constraints
- Artifacts (code, comments, SQL, identifiers) in English.
- UI copy visible to end users in Spanish matching existing application conventions (informal "tú" register).
- No native popups (`alert`, `confirm`, `prompt`, native `<select>`); strictly internal modal dialogs to preserve Electron window focus.
- No writes to production during development (no CLI migrations, deployments, secrets, or schedules created).
- No Git commits created (staged and committed by orchestrator/reviewer).
- Type-check via `npx tsc --noEmit`, lint via `npx eslint <changed files>`, and production build verification via `npm run build -- --webpack`.

## Acceptance Criteria
- [x] Current cycle seeded as `PAID` so deploying does not trigger unexpected lockouts.
- [x] Server-side calculation strictly bound to `America/Santo_Domingo` time zone.
- [x] Days 11 to 14 show grace banner with remaining days; day 15 locks the application.
- [x] Code verification hashes match normalized uppercase input (non-alphanumerics stripped).
- [x] Consecutive failed attempts (5 within 15 minutes) trigger temporary lockout without rolling back failure counters.
- [x] Transient database errors in `getLicenseStatus` fail open (`state: "OK"`).
- [x] UI respects dark/light theme and contains zero native browser dialogs.
- [x] All license UI copy consistently uses the informal "tú" register.
- [x] Dialog auto-close timer properly cleaned up on unmount or dialog dismiss.
- [x] Edge function adheres to official InsForge Deno runtime conventions with reserved secret keys.

## Round 2 Review Corrections
- **Edge function runtime conventions**:
  - Rewrote `insforge-functions/license-cycle.ts` using `import { createClient } from "npm:@insforge/sdk"`.
  - Removed `Deno.serve(...)`, `process.env` branches, and references to `SUPABASE_*` / `INSFORGE_URL` / `INSFORGE_SERVICE_ROLE_KEY`.
  - Configured admin client with reserved `INSFORGE_BASE_URL` and `API_KEY`.
  - Replaced error-string sniffing on insert error with a re-select query on `LicenseCycle` for `period` to cleanly identify existing cycles.
  - Added HTML escaping (`escapeHtml()`) for company name and interpolated fields in email markup.
  - Scoped Resend idempotency key to `license-cycle-${period}-${codeHash.slice(0, 12)}`.
  - Excluded `insforge-functions` in `tsconfig.json` (`exclude`) and `eslint.config.mjs` (`globalIgnores`).
- **UI copy register**:
  - Standardized `license-lock-screen.tsx` from formal "usted" to informal "tú" ("tu suscripción mensual", "comunícate con el proveedor", "ingresa el código").
- **Dialog timer lifecycle**:
  - Stored auto-close timeout ID in a ref within `payment-code-dialog.tsx` and registered cleanup on unmount and when `open` becomes false.
- **Deployment & Secret reality alignment**:
  - Documented that `INSFORGE_BASE_URL` and `API_KEY` are existing reserved secrets that must not be added.
  - Added pre-deploy checklist item for smoke-testing admin client table access.

## Checks
- `npx tsc --noEmit` — Clean (0 errors).
- `npx eslint eslint.config.mjs actions/license-actions.ts components/modules/license/license-lock-screen.tsx components/modules/license/license-grace-banner.tsx components/modules/license/payment-code-dialog.tsx app/(dashboard)/layout.tsx components/layout/dashboard-shell.tsx` — Clean (0 errors, 0 warnings).
- `npm run build -- --webpack` — Clean production build.

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
   insforge schedules create --name "license-cycle-daily" --cron "0 14 * * *" --url "https://base.azokia.com/functions/license-cycle" --method "POST" --headers '{"Content-Type":"application/json"}'
   ```
   *(Note: 14:00 UTC corresponds to 10:00 AM America/Santo_Domingo).*
5. Perform a smoke test by manually invoking the function:
   ```bash
   insforge functions invoke license-cycle --method POST
   ```
   - Before day 11, verify it responds with `{ "skipped": "before_due_day" }`.
   - On/after day 11, verify cycle creation and receipt of notification email.
