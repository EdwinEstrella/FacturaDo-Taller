# Technical Design: Cleanup Current Unused Variable Warnings

## Scope

This design covers only the current `@typescript-eslint/no-unused-vars` warnings reported for `cleanup-lint-unused-vars`. It does not change ESLint configuration, TypeScript configuration, application behavior, Electron IPC contracts, routing, database behavior, or build/package settings.

## Inputs Reviewed

- Proposal: `openspec/changes/cleanup-lint-unused-vars/proposal.md`
- Spec: `openspec/changes/cleanup-lint-unused-vars/specs/code-quality/spec.md`
- Lint configuration: `eslint.config.mjs`
- Scripts: `package.json`
- Likely affected code:
  - `components/layout/app-sidebar.tsx`
  - `electron/main.js`
  - `electron/db-manager.js`

## Current Technical Context

- `npm run lint` runs `eslint` with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- The proposal baseline says lint exits successfully but reports 12 warnings, all from `@typescript-eslint/no-unused-vars`.
- `components/layout/app-sidebar.tsx` has a local unused-vars disable before `AppSidebar`, likely protecting an unused `isMobile` prop.
- `electron/main.js` and `electron/db-manager.js` currently disable `@typescript-eslint/no-unused-vars` file-wide, so removing those blanket suppressions may reveal unused imports, callback parameters, catch parameters, or locals.
- The typecheck baseline passed with `npx tsc --noEmit`; the reported `any` to `never` diagnostic is only a regression watch item.

## Design Decisions

1. **Use symbol-level cleanup, not configuration changes.**
   - Remove unused imports, locals, destructured values, parameters, or obsolete eslint-disable comments.
   - Do not relax `@typescript-eslint/no-unused-vars` or add broad ignore patterns.

2. **Preserve public/API-shaped signatures when needed.**
   - For React component props and Electron IPC handlers, do not remove a prop or handler parameter if it is part of an externally consumed contract or positional callback signature.
   - If a signature must keep an intentionally unused parameter, rename it to an underscore-prefixed form only after confirming the active lint rule accepts that pattern. If not accepted, prefer the smallest safe structural change, such as omitting the parameter only when the framework callback does not require its position.

3. **Remove unused catch parameters only when the error value is not behaviorally used.**
   - Convert `catch (error)` / `catch (e)` to bare `catch` only when no logging, message extraction, return payload, or error propagation needs the variable.
   - If the catch block returns or logs `error.message`, keep the parameter.

4. **Treat CommonJS requires conservatively.**
   - Remove unused destructured imports or `require` bindings only when the module import has no required side effect and the binding is not referenced.
   - Do not remove a `require(...)` statement if its execution is needed for side effects; instead remove only the unused binding if possible.

5. **Do not remove functions solely because they are locally unused without call-flow review.**
   - For top-level functions in Electron files, first confirm whether they are referenced by lifecycle hooks, IPC handlers, exports, or callbacks.
   - Only delete an unused function when it is neither exported nor referenced and has no side effects from declaration. Prefer leaving functions in place if they are part of intended future IPC/lifecycle behavior unless they are an actual lint warning and no contract depends on them.

## Planned File-Level Approach

### `components/layout/app-sidebar.tsx`

- Inspect the current lint warning for `AppSidebar` props.
- If `isMobile` is unused and no caller depends on the component accepting it for type compatibility, remove it from the destructuring and prop type.
- If callers pass `isMobile` and the prop contract should remain accepted, keep it in the type but avoid binding it in the function body, e.g. accept props and destructure only `user`, or use an underscore-compatible name if lint permits.
- Remove the local unused-vars eslint-disable only if the warning is resolved without it.

### `electron/main.js`

- Replace the file-wide unused-vars disable with targeted cleanup.
- Candidate cleanup categories:
  - Unused imports/destructured requires such as unused Electron, Node, or helper bindings.
  - Unused locals such as computed paths or config variables that are never read.
  - Unused callback parameters in IPC handlers and promises.
  - Bare catch conversion for catch parameters that are not read.
- Preserve all IPC channel names (`get-config`, `save-config`, `test-connection`, `create-database`, `run-migrations`, `restart-app`) and returned payload shapes.
- Preserve Electron lifecycle behavior for `ready`, `window-all-closed`, and `activate`.

### `electron/db-manager.js`

- Replace the file-wide unused-vars disable with targeted cleanup.
- Candidate cleanup categories:
  - Unused Node requires (`path`, `fs`) if not referenced.
  - Optional parameters that are never used, such as migration schema path parameters, unless part of an exported API contract.
  - Catch parameters only when their message/logging is not used.
- Preserve exported names and return payloads from `createDatabase`, `testConnection`, and `runMigrations`.
- Do not change SQL, Prisma command execution, connection setup, or error propagation semantics.

## Behavior-Preservation Verification Plan

1. **Capture exact lint baseline at apply start.**
   - Run `npm run lint` before editing.
   - Record every `@typescript-eslint/no-unused-vars` warning with file, line, symbol name, and warning text.

2. **Classify each warning before editing.**
   - `unused import/require`: verify no references and no required side effect.
   - `unused local`: verify initializer has no side effects before deletion; if it has side effects, preserve the expression or refactor minimally.
   - `unused function`: verify no exports, callbacks, IPC/lifecycle references, dynamic references, or documented contracts before deletion.
   - `unused parameter`: verify whether callback/framework/API positional compatibility requires it; remove only when safe, otherwise use accepted underscore naming.
   - `unused catch parameter`: convert to bare `catch` only when the parameter is not read.

3. **Review behavior-sensitive contracts manually.**
   - Confirm Electron IPC channel names, handler arity requirements, and returned object shapes remain unchanged.
   - Confirm exported CommonJS functions in `electron/db-manager.js` retain names and expected argument contracts unless the unused parameter is private/optional and not used by callers.
   - Confirm `AppSidebar` still accepts the props used by callers, or that callers do not pass removed props.

4. **Run automated verification after edits.**
   - `npm run lint` must exit 0 with zero warnings and zero errors.
   - `npx tsc --noEmit` must exit 0 and must not introduce the watched `any` to `never` diagnostic.
   - `npm run build` should be run when feasible; if it fails, document output and classify the blocker as unrelated/pre-existing/environmental/config-specific only with evidence.

5. **Diff review for non-behavioral cleanup only.**
   - Review the final diff and confirm it contains only unused-symbol removals/renames and obsolete unused-vars-disable removals.
   - Confirm no route lists, role checks, SQL statements, IPC channel strings, command strings, environment variables, or UI behavior branches changed.

## Rollout and Rollback

- Rollout is a single small cleanup change under the 400 changed-line review budget.
- No migration or feature flag is required.
- Rollback is reverting only the files touched by the cleanup change. If verification reveals behavior dependency on a removed symbol, restore the symbol or choose a signature-preserving underscore/props-rest approach.

## Open Questions / Apply-Phase Checks

- The exact warning list should be refreshed during apply because file-wide suppressions may hide multiple warnings until removed.
- If underscore-prefixed intentionally unused parameters are not accepted by the current lint rule, apply should avoid that strategy and instead use safe omission or minimal structural cleanup.
- If a previously unreproduced TypeScript `any` to `never` diagnostic appears during verification, pause and treat it as a regression/follow-up rather than accepting it in this cleanup baseline.
