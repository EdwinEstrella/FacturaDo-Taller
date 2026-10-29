# Lists default to last 7 days

## Objective
Invoice and quote lists load only the last 7 days by default so the app opens fast.

## Problem / Why
Both lists loaded the whole current month on open (invoices with client, items, work order and dispatch joins), which is slow.

## Scope
- actions/filter-actions.ts: `week` period = rolling last 7 days.
- app/(dashboard)/invoices/page.tsx: default period `week`, label "7 días".
- actions/quote-actions.ts: default range last 7 days; optional `month`; server-side `search` across full history.
- app/(dashboard)/quotes/page.tsx: default last 7 days, month picker and full history stay optional, debounced server search.

## Constraints
- Search always covers the whole history.
- No native popups. UI copy in Spanish (existing project language).
- TDD: off (no test runner configured); checks = `npx tsc --noEmit`, `npm run lint` on changed files.

## Tasks
- [x] T1 Default last-7-days window for invoices and quotes, with full-history search (route: delegated to agy, 4 files)

## Acceptance
- Opening Facturas/Cotizaciones queries only createdAt >= today-6 days 00:00.
- Typing a search returns matches from any date.
- Month and "Todo" options still work.

## Progress
