# InvoiceFlow — TenantFence Verification Target

**InvoiceFlow** is the multi-tenant invoicing SaaS that TenantFence
verifies: a small Next.js (App Router) + TypeScript + Tailwind app with
two tenants (Alpha and Beta), session-cookie login, and one invoice
detail endpoint whose ownership check is the controlled test surface.

This folder is the *target*, not the product. For the full story —
the ownership contract, the Kane CLI closed loop, the HTTP probe
oracle, and how to replay the catch → patch → re-verify cycle — see
the [project README](../README.md).

## Run it standalone

```bash
npm install
npm run dev        # http://localhost:3000
```

Demo accounts (test fixtures, also on the login page as quick-fill
buttons): `finance@alpha.test` / `AlphaPass123!` (owns INV-1001) and
`finance@beta.test` / `BetaPass123!` (owns INV-2001).

Useful endpoints: `POST /api/reset` (restore seed data),
`GET /api/health` (deployment commit), `GET /api/me` (current session).

> The shipped state is the **patched** one: cross-tenant access to
> `/api/invoices/<id>` returns HTTP 403. The controlled vulnerability
> is re-opened only deliberately, from the repository root, with
> `npm run vuln:reopen`.
