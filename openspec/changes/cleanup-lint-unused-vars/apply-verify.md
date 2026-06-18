# Apply / Verify Report: cleanup-lint-unused-vars

## Status

Implemented and verified.

## Recovery

- Restored `app/(dashboard)/desglose/ventana-tradicional/page.tsx` from `HEAD` after the working copy was found to be fully NUL-byte corrupted.
- Evidence after restore: byte scan reported `69435` bytes, `0` NUL bytes, first bytes `"use client"`.
- Removed corrupted generated cache `.next/` after `npx tsc --noEmit` failed on ignored `.next/types/validator.ts`, which contained only NUL bytes. `.next/` is ignored by `.gitignore`.

## Baseline / Apply Findings

Current lint warnings after restoring the corrupted source file:

- `app/(dashboard)/desglose/ventana-tradicional/page.tsx:659:11` — `handleMandarProduccion` assigned a value but never used.
- `app/(dashboard)/desglose/ventana-tradicional/page.tsx:682:11` — `handleEliminarBreakdown` assigned a value but never used.

Pre-existing working-tree cleanup from prior SDD apply attempt was reviewed and accepted by user as in-scope if verification passed:

- `actions/installation-actions.ts`: converted unused `catch (_error)` bindings to bare `catch`.
- `app/(dashboard)/desglose/historial/page.tsx`: removed unused `decimalToFraction` helper.
- `app/(dashboard)/desglose/ventana-p65/page.tsx`: removed unused `handleMandarProduccion` and `handleEliminarBreakdown` helpers.
- `.gitignore`: added `.atl/` as local Pi runtime state ignore; user explicitly chose to keep it.

Final apply edit in this session:

- `app/(dashboard)/desglose/ventana-tradicional/page.tsx`: removed unused `handleMandarProduccion` and `handleEliminarBreakdown` helpers after confirming they had no references.

## Diff Scope

`git diff --stat` after apply:

```text
 .gitignore                                         |  2 +
 actions/installation-actions.ts                    | 14 +++---
 app/(dashboard)/desglose/historial/page.tsx        | 52 ----------------------
 app/(dashboard)/desglose/ventana-p65/page.tsx      | 28 ------------
 .../desglose/ventana-tradicional/page.tsx          | 27 -----------
 5 files changed, 9 insertions(+), 114 deletions(-)
```

Review budget: below 400 changed lines.

## Verification

Commands run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Results:

- `npm run lint`: passed with zero warnings and zero errors.
- `npx tsc --noEmit`: passed with exit code 0; no output.
- `npm run build`: passed.
  - Next.js 16.1.1 / Turbopack compiled successfully.
  - TypeScript stage passed.
  - Static pages generated successfully: 33/33.

The watched diagnostic `argument of type 'any' is not assignable to parameter of type 'never'` did not appear.

## Notes

- No Electron IPC, SQL, route list, role check, command string, or environment variable changes were made.
- The original expected files `components/layout/app-sidebar.tsx`, `electron/main.js`, and `electron/db-manager.js` did not require edits in the final working tree because current lint passed after the accepted cleanup set.
- Untracked `openspec/` and `.pi/` remain present as SDD/runtime artifacts; `.atl/` is now ignored.
