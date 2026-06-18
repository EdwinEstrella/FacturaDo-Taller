# Tasks: Cleanup Current Unused Variable Lint Warnings

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 30-90 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Implementation Tasks

### 1. RED: Refresh and record current lint warning baseline

- Run `npm run lint` before editing.
- Record each `@typescript-eslint/no-unused-vars` warning in the apply notes with file path, line/column, symbol name, and message.
- Confirm the warning set is limited to likely cleanup targets:
  - `components/layout/app-sidebar.tsx`
  - `electron/main.js`
  - `electron/db-manager.js`
  - Any additional concrete paths reported by the command
- If lint reports non-unused-vars errors or a much larger warning set, pause for scope review before editing.

### 2. RED: Classify each warning before changing code

For every warning from Task 1, classify it as one of:

- unused import/require
- unused local or destructured value
- unused function
- unused parameter
- unused catch parameter
- obsolete `eslint-disable` suppression

Verification checklist before edits:

- For imports/requires, confirm removing the binding does not remove needed module side effects.
- For locals, confirm deleted initializers have no side effects; otherwise preserve the expression behavior.
- For parameters, confirm whether React props, Electron IPC handlers, callbacks, or exported APIs require the parameter position/shape.
- For functions, confirm no export, lifecycle hook, IPC registration, callback, dynamic reference, or documented contract depends on the function.

### 3. GREEN: Clean up `components/layout/app-sidebar.tsx`

- Resolve unused-vars warnings around `AppSidebar` props or local suppressions only.
- If `isMobile` or another prop is unused, choose the smallest behavior-preserving option:
  - keep the public prop type accepted when callers still pass it, but avoid binding unused values; or
  - remove it from the component contract only after confirming no callers pass it.
- Remove the local `@typescript-eslint/no-unused-vars` disable only after the underlying warning is gone.
- Verify no sidebar routes, labels, permissions, visual state, or navigation behavior changed.

### 4. GREEN: Clean up `electron/main.js`

- Remove the file-wide unused-vars suppression only when all revealed warnings in this file have targeted fixes.
- Remove unused Electron/Node/helper bindings, callback parameters, locals, and catch parameters according to the classification from Task 2.
- Preserve all IPC channel names and return payload shapes, especially:
  - `get-config`
  - `save-config`
  - `test-connection`
  - `create-database`
  - `run-migrations`
  - `restart-app`
- Preserve Electron lifecycle behavior for `ready`, `window-all-closed`, and `activate`.
- Do not alter command strings, environment variables, app paths, or window configuration except for unused-symbol cleanup.

### 5. GREEN: Clean up `electron/db-manager.js`

- Remove the file-wide unused-vars suppression only when all revealed warnings in this file have targeted fixes.
- Remove unused `require` bindings, locals, optional parameters, or catch parameters only when they are not part of exported behavior.
- Preserve exported CommonJS function names and expected payloads for:
  - `createDatabase`
  - `testConnection`
  - `runMigrations`
- Do not change SQL statements, Prisma command execution, connection setup, logging semantics, or error propagation semantics beyond unused catch parameter removal where safe.

### 6. TRIANGULATE: Re-run lint and address any newly revealed warnings

- Run `npm run lint` after Tasks 3-5.
- If removing suppressions reveals additional `@typescript-eslint/no-unused-vars` warnings in the same files, repeat Tasks 2-5 for those concrete warnings.
- If warnings appear in new files, add them to the apply notes and handle only if they are current unused-vars cleanup within this change scope.
- Stop and request a scope decision if lint reveals unrelated rule failures or broad cross-cutting cleanup.

### 7. REFACTOR: Review final diff for scope and behavior preservation

- Inspect the diff and confirm it contains only:
  - unused import/require cleanup
  - unused local/destructured value cleanup
  - safe unused parameter or catch parameter cleanup
  - obsolete unused-vars suppression removal
- Confirm the diff does not change route lists, role checks, SQL, IPC channel strings, returned object shapes, command strings, environment variables, UI branches, or build/package configuration.
- Keep total changed lines below the 400-line review budget; if the diff unexpectedly approaches that limit, stop before expanding scope.

### 8. VERIFY: Run required verification commands

- Run `npm run lint` and require exit `0` with zero warnings and zero errors.
- Run `npx tsc --noEmit` and require exit `0`.
- Confirm the watched diagnostic `argument of type 'any' is not assignable to parameter of type 'never'` does not appear; if it appears, treat it as a regression/newly reproduced issue and do not accept it silently.
- Run `npm run build` when feasible.
- If build fails, capture command output and classify the blocker with evidence as cleanup-related or unrelated/pre-existing/environmental/config-specific.

### 9. Document apply/verify evidence

- Record the baseline warning list, final command results, and any build blocker evidence in the apply/verification phase artifact.
- Note exact files changed and confirm no pre-existing `.gitignore` or `.pi/` changes were included in this cleanup.
- Rollback boundary: revert only the files edited for unused-vars cleanup if verification or review identifies a behavior dependency.
