# Agent contract

Read this before changing code. Shared source of truth: https://github.com/danrabydev/agent-notes/blob/main/common/coding-standards.md

QA then Cyber before merge. No secrets in git, docs examples, or command/args.

## Planning / board

- Use only [All work](https://github.com/users/danrabydev/projects/8), filtered by Group.
- Every item belongs on All work.
- Status path: Todo → Need info → Implementation → Code review → QA → Cyber → Ready for release → Released.
- Complete weekly grooming before anyone begins implementation.

## TypeScript library

- pnpm. Do not convert the lockfile.
- Source in `src/` is ESM only: no `require` or `module.exports`. The tsdown build dual-emits ESM and CJS in `dist/`; do not drop CJS exports. `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. Target ES2022, module ESNext, moduleResolution bundler.
- No `any`. No `as` except a documented interop edge. No `!` unless the line above proved it.
- Named exports. Exhaustive unions. `unknown` at the boundary, narrow before use.
- Behavior change needs a test in `tests/`. Offline unless Dan asked for a live check.
- Keep the published surface stable. Stay aligned with `@danrabydev/match` types and names.
