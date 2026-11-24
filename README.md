# TenantFence

**Your AI agent built a multi-tenant SaaS. TenantFence proves no tenant
can see another tenant's data — with Kane CLI, in a real browser, in a
closed loop that patches the hole and re-verifies.**

Built for the **Kane CLI Online Hackathon** (TestMu AI).

## The problem

Multi-tenant apps fail in one classic way: a missing ownership check
(**BOLA/IDOR**) lets any logged-in user open another tenant's records by
changing an ID in the URL. Unit tests rarely catch it, because the code
is "working" — it returns a perfectly valid invoice, just to the wrong
tenant.

TenantFence turns data ownership into a machine-checkable contract —
`specs/ownership.manifest.json` — and enforces one invariant for every
resource `r` and every user `u`:

```
Owner(r) ≠ Tenant(u)  ⇒  Access(u, r) = Denied (HTTP 403, no data)
```

## The closed loop

```
                ┌──────────────────────────────────────────────┐
                │        specs/ownership.manifest.json         │
                │  tenants · resources · sensitive markers     │
                └───────────────┬──────────────────────────────┘
                                │ generates
                                ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Kane CLI browser sessions (real Chrome, per tenant)       │
   │  owner = positive control · cross-tenant = attack session  │
   └───────────────┬──────────────────────────────┬─────────────┘
                   │ Result.md / evidence         │ session cookie
                   ▼                              ▼
   ┌────────────────────────────────────────────────────────────┐
   │  HTTP probe oracle + verifier                              │
   │  probe status/body vs. the manifest decides, with proof    │
   └───────────────┬──────────────────────────────┬─────────────┘
          exposure │                              │ clean + owners OK
                   ▼                              ▼
   ┌──────────────────────────────┐   ┌───────────────────────────┐
   │  Agent bridge                │   │  TENANT_ISOLATION_        │
   │  finding-bundle.json +       │   │  VERIFIED                 │
   │  muse-patch-prompt.md        │   │  (report .md / .html)     │
   │  → AI coding agent patches   │   └───────────────────────────┘
   │  → push → redeploy → RETEST ─┼──► (loop back to Kane CLI)
   └──────────────────────────────┘
```

One command runs the whole cycle against the deployed app:

```bash
npm run verify
```

## Live demo

**App:** https://tenantfence.vercel.app — InvoiceFlow, a small
multi-tenant invoicing SaaS (Next.js App Router + TypeScript +
Tailwind). The live deployment is the **patched** state: cross-tenant
access is denied.

Demo accounts (test fixtures, also on the login page as quick-fill
buttons):

| Tenant | Email | Password | Owns |
| ------ | ----- | -------- | ---- |
| Alpha | `finance@alpha.test` | `AlphaPass123!` | INV-1001 ($15,000) |
| Beta | `finance@beta.test` | `BetaPass123!` | INV-2001 ($8,000) |

Try it by hand: log in as Beta, then open `/invoices/INV-1001`. You
will be denied — that denial is what TenantFence re-verifies on every
run.

## Real execution evidence (in this repo's history)

These are not mock-ups; they are the commits produced while the loop
actually ran against the live deployment:

- **The catch** — commit
  [`91f7a67`](https://github.com/0xrard/tenantfence/commit/91f7a67):
  Kane CLI browser sessions caught the leak in both directions
  (see `artifacts/evidence/run-before/kane/output-*/Result.md` and the
  sealed `.evidence` packs), and the finding bundle + patch prompt
  were generated.
- **The verified fix** — commit
  [`27690cc`](https://github.com/0xrard/tenantfence/commit/27690cc):
  after the ownership patch, the full run reports
  `TENANT_ISOLATION_VERIFIED` (cross-tenant HTTP 403, no markers
  leaked, owners unaffected).

## Replay the loop yourself (judges)

The shipped default is safe. Re-open the controlled vulnerability,
watch TenantFence catch it, patch it, and re-verify — all locally,
no Vercel account needed:

```bash
npm install                  # orchestrator dependencies (root)
cd target-saas && npm install && cd ..

npm run vuln:reopen          # re-open the controlled IDOR (detail route only)
npm run verify:local         # starts the target locally, runs the full loop
```

`verify:local` will stop at the **ACTION REQUIRED** banner with a
finding bundle and a ready-made patch brief at
`artifacts/evidence/muse-patch-prompt.md`. Hand that file to your AI
coding agent (or apply the one check yourself), and the loop detects
the change, re-runs, and closes with `TENANT_ISOLATION_VERIFIED`.

Restore the safe state at any time:

```bash
npm run vuln:patch           # re-apply the ownership check (403)
npm run vuln:status          # show which version is installed
```

To verify the **live** deployment instead of a local target, copy
`.env.example` to `.env` (it already points at the live URL) and run
`npm run verify`.

## How the verdict stays honest

- **The HTTP probe is the exposure oracle.** It logs in with a real
  session cookie and reads the exact JSON the browser page would
  render. Cross-tenant status ≠ 403 ⇒ exposure, with the leaked
  markers quoted from the response body.
- **Kane's text is never scanned for markers.** The cross-tenant spec
  itself says *"assert the page does NOT display '…'"*, so Kane's
  reports quote the markers even when the page showed nothing — an
  early version of the verifier convicted a correctly patched app
  that way. A failed Kane assertion now only *corroborates* a probe
  conviction. (Fixed in commit `27690cc`; regression-tested.)
- **No certification for a broken app.** `TENANT_ISOLATION_VERIFIED`
  additionally requires every owner to open their own invoices
  (positive controls). A totally broken app cannot pass as "secure".

## Repository layout

- `target-saas/` — **InvoiceFlow**, the verification target
  (Next.js App Router + TypeScript + Tailwind CSS).
- `specs/ownership.manifest.json` — the ownership contract: tenants,
  credentials (fixtures), resources, sensitive markers.
- `cli/` — the TenantFence orchestrator (TypeScript, run with `tsx`):
  `kane-runner.ts` (spec generation, Kane sessions, HTTP probes),
  `verifier.ts` (the oracle), `agent-bridge.ts` (finding bundle +
  patch hand-off), `orchestrator.ts` (the closed loop, incl.
  `--local` mode), `vuln-toggle.ts` (judge replay switch).
- `.github/workflows/tenantfence.yml` — CI template: type-check,
  build, serve, and verify tenant isolation on every PR/push.
- `artifacts/` — run evidence and the final security report
  (`security-report.md` / `.html`).

## Run the target app standalone

```bash
cd target-saas
npm install
npm run dev        # http://localhost:3000
```

Useful endpoints: `POST /api/reset` (restore seed data),
`GET /api/health` (deployment commit), `GET /api/me` (current
session).

## Status

- **Tahap 1:** target SaaS + ownership contract, deployed live.
- **Tahap 2:** the closed-loop orchestrator — loop completed against
  the live deployment, `TENANT_ISOLATION_VERIFIED`.
- **Tahap 3:** judge replay (`vuln:reopen` / `verify:local`), CI
  template, and this README.
