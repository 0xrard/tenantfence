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

- **Tahap 1 (this commit):** target SaaS + ownership contract. The
  invoice detail endpoint intentionally ships with the classic missing
  ownership check, so the fence has something real to catch.
- **Tahap 2 (next):** the TenantFence orchestrator — Kane CLI run
  generation from the manifest, verdict collection, and the auto-patch
  loop that fixes the authorization hole and re-verifies until the
  fence holds.
