# TenantFence

**Your AI agent built a multi-tenant SaaS. TenantFence proves no tenant
can see another tenant's data — with Kane CLI, in a real browser.**

Multi-tenant apps fail in one classic way: a missing ownership check
(BOLA/IDOR) lets any logged-in user open another tenant's records by
changing an ID in the URL. TenantFence turns data ownership into a
machine-checkable contract — `specs/ownership.manifest.json` — and uses
[Kane CLI](https://www.testmuai.com/kane-cli/) (TestMu AI) to attack the
running app exactly the way a real user would: log in as Tenant Beta,
open Tenant Alpha's invoice, and report whether Alpha's secrets leak.

Built for the **Kane CLI Online Hackathon** (TestMu AI).

## Repository layout

- `target-saas/` — **InvoiceFlow**, a small multi-tenant invoicing app
  (Next.js App Router + TypeScript + Tailwind CSS). This is the
  verification target.
- `specs/ownership.manifest.json` — the ownership contract: tenants,
  their credentials (test fixtures), the resources each tenant owns, and
  the sensitive markers that must never cross the fence.
- `cli/` — the **TenantFence orchestrator** (TypeScript): generates Kane
  CLI test specs from the manifest, runs them against the deployed app,
  probes the JSON API with real session cookies, verifies the evidence
  against the contract, hands proven findings to an AI coding agent as a
  patch brief, waits for the redeploy, and re-verifies — the closed loop.

## Run the closed loop

Prerequisites: Node 20+, a deployed InvoiceFlow URL, and Kane CLI
installed and logged in (`npm install -g @testmuai/kane-cli`, then
`kane-cli login`).

```bash
npm install
cp .env.example .env   # set TARGET_URL to your deployed app
npm run verify
```

One command runs the whole cycle: reset → Kane browser sessions +
HTTP probes (Run 1, before) → finding bundle
(`artifacts/evidence/finding-bundle.json`) and patch brief
(`artifacts/evidence/muse-patch-prompt.md`) → wait for the patch and
the new Vercel deployment → re-run (Run 2, after) → final audit in
`artifacts/security-report.md` / `.html`. The loop only reports
`TENANT_ISOLATION_VERIFIED` when cross-tenant access is denied (403)
**and** every owner can still open their own invoices.

## Run the target app

```bash
cd target-saas
npm install
npm run dev        # http://localhost:3000
```

Demo accounts (fixtures, also on the login page as quick-fill buttons):

| Tenant | Email | Password |
| ------ | ----- | -------- |
| Alpha | `finance@alpha.test` | `AlphaPass123!` |
| Beta | `finance@beta.test` | `BetaPass123!` |

Useful endpoints: `POST /api/reset` (restore seed data), `GET /api/health`
(deployment commit), `GET /api/me` (current session).

## Status

- **Tahap 1:** target SaaS + ownership contract, deployed live at
  [tenantfence.vercel.app](https://tenantfence.vercel.app). The invoice
  detail endpoint intentionally ships with the classic missing
  ownership check, so the fence has something real to catch.
- **Tahap 2:** the TenantFence orchestrator in `cli/` — manifest-driven
  Kane CLI run generation, HTTP probe cross-check, verdict engine,
  agent bridge (finding bundle + patch prompt, `AGENT_CMD` or
  watch mode), deploy polling via `/api/health`, and the before/after
  security report.
