# Task 0.7: CI/CD Skeleton

## Context

`/.github/workflows/ci.yml` currently validates lint, typecheck, formatting, token/claims guards, and Rust checks, but does not run a test command, workspace build, or preview deployment. The repository has no test runner or package-level `test` scripts; `turbo.json` already declares a `test` task. Tauri is configured for `nsis` and `deb` bundles. Vercel is configured with `apps/web` as the project root and `sin1` region.

Existing worktree changes are out of scope and must not be reverted. Keep workflow changes compatible with Node `>=22.12.0`, pnpm `12.4.2`, and the existing lockfile.

## Decisions

- Add a dependency-free native smoke test using Node's built-in `node:test`; this makes the CI `test` stage real without prematurely selecting the Fase 7 test framework.
- Keep the main CI workflow as one required verification pipeline with separate named jobs or clear steps for `lint`, `typecheck`, `test`, and `build`; preserve existing guards and Rust checks.
- Build the web and desktop workspace through existing root scripts. Do not make production web build depend on runtime credentials; if current Next build requires env, provide only non-secret inert CI values or document the required GitHub variables rather than weakening checks.
- Deploy previews explicitly with Vercel CLI from the `apps/web` project root. Run only for pull requests, after verification succeeds, using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` GitHub secrets. Do not expose secrets to fork pull requests; skip the deployment when the secrets are unavailable or the PR is from a fork.
- Add a separate Tauri workflow triggered by `workflow_dispatch` and `v*` tags. Use a matrix for `windows-latest` (`nsis`) and `ubuntu-latest` (`deb`); do not build installers on every PR. Upload artifacts for manual runs and attach bundles to a GitHub Release for version tags.
- Use least-privilege workflow permissions. Release jobs get `contents: write`; preview jobs only need read access. Pin action major versions consistently with the existing repository style.

## Implementation

1. Add a minimal test file under the repository test area (for example `tests/smoke.test.mjs`) using `node:test` and `node:assert/strict`. Assert stable repository invariants that do not require network, credentials, a browser, or Rust, such as the workspace manifest, required root scripts, and Tauri bundle targets. Keep the test small and deterministic.
2. Add the root `test` script (`node --test`) in `package.json`. Do not add a test script to every package; the root command is the CI contract while feature/unit/integration/E2E coverage remains Fase 7.
3. Update `.github/workflows/ci.yml`:
   - retain checkout, pnpm setup, Node setup, frozen install, Turbo cache, existing guards, format check, and Rust validation;
   - add explicit `Test` (`pnpm test`) and `Build` (`pnpm build`) stages;
   - ensure the build stage has the minimum harmless environment required by current build tooling, while keeping secrets out of PR jobs;
   - use job/step names that make `lint`, `typecheck`, `test`, and `build` independently visible in GitHub Checks;
   - keep concurrency cancellation for a branch/PR ref;
   - add a PR-only `preview` job dependent on successful verification, guarded by same-repository PR plus the three Vercel secrets. Install/use the existing Vercel CLI through pnpm without editing the lockfile. Pull preview settings, build/deploy from `apps/web`, and publish the resulting URL as a job summary/output. Avoid deploying fork code with repository secrets.
4. Add `.github/workflows/tauri.yml`:
   - triggers: `workflow_dispatch` with optional ref input, and `push` tags matching `v*`;
   - matrix metadata for Windows NSIS and Ubuntu `.deb`;
   - checkout the requested ref, install pnpm `12.4.2`, Node 22, Rust stable, and Linux Tauri system libraries on Ubuntu;
   - install workspace dependencies with `pnpm install --frozen-lockfile`;
   - invoke the existing desktop Tauri build command with the matrix target (`nsis` or `deb`), allowing the Tauri config to remain the single source of bundle targets;
   - cache pnpm, Cargo, and target data where supported;
   - upload generated installer files as uniquely named artifacts on every successful matrix run;
   - on version tags only, create/update a GitHub Release and attach the matrix installer files. Use `contents: write` only for the release step/job. Keep signing explicitly out of scope for this draft; document that signing secrets/certificates belong to Task 8.3.
5. Update `docs/PHASE-0.md` Task 0.7 status with the workflow/test deliverables, verification commands, and intentional boundaries (native smoke test only, unsigned draft installers, Vercel secrets required for preview, no release on PR).
6. If the workflow syntax or YAML formatting is covered by the repository formatter, run the formatter check and fix only files touched by this task. Do not rewrite generated Tauri files or unrelated pre-existing changes.

## Validation

- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm format:check`
- `cargo fmt --all --check` in `apps/desktop/src-tauri`
- `cargo clippy --all-targets -- -D warnings` in `apps/desktop/src-tauri`
- `cargo check --all-targets` in `apps/desktop/src-tauri`
- Parse/validate both workflow YAML files with a YAML parser or CI lint tool available in the environment.
- Confirm the Tauri matrix paths match actual bundle output (`.exe`/NSIS on Windows and `.deb` on Ubuntu), and confirm release upload is restricted to `v*` tags.
- Confirm preview deployment cannot run for fork PRs and does not print token values.

## Risks and boundaries

- Current workspace has no feature tests; the smoke test proves wiring/invariants only, not business behavior.
- Vercel preview requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`; missing secrets should produce a clearly skipped preview, not a failed verification pipeline.
- GitHub-hosted Linux runners need the Tauri GTK/WebKit/AppIndicator/Rsvg dependencies already listed in the Rust CI job.
- Installer signing, notarization, publishing metadata, auto-update signing, and production Vercel environment provisioning remain Task 8.3/Task 0.9 work.
