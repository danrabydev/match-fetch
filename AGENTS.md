# Agent contract

Read this before changing code. Shared source of truth: https://github.com/danrabydev/agent-notes/blob/main/common/coding-standards.md

- Planning board: https://github.com/users/danrabydev/projects/8 (All work, filter by Group=Packages)
- Status path: Todo → Need info → Implementation → Code review → QA → Cyber → Ready for release → Released
- QA then Cyber before merge (a QA fix must not skip the security pass).
- Every change must have an All work item and go through Packages weekly grooming before Implementation. No orphan work.
- Do not link to users/danrabydev/projects/2 through /6.

No secrets in git, docs examples, or command/args.

## TypeScript library

- pnpm. Do not convert the lockfile.
- Source in `src/` is ESM only: no `require` or `module.exports`. The tsdown build dual-emits ESM and CJS in `dist/`; do not drop CJS exports. `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. Target ES2022, module ESNext, moduleResolution bundler.
- No `any`. No `as` except a documented interop edge. No `!` unless the line above proved it.
- Named exports. Exhaustive unions. `unknown` at the boundary, narrow before use.
- Behavior change needs a test in `tests/`. Offline unless Dan asked for a live check.
- Keep the published surface stable. Stay aligned with `@danrabydev/match` types and names.
