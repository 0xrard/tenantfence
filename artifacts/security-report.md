# TenantFence — Security Verification Report

Target: https://tenantfence.vercel.app
Generated: 2026-11-24T13:18:02.636Z
Final status: **NO_EXPOSURE_DETECTED**

## Run 1 — Before patch

Commit: `27690cc963dfba4f19b406b04eddddf62c8f92bd`

- Positive control OK: tenant-alpha can access INV-1001.
- Positive control OK: tenant-beta can access INV-2001.
- Isolation OK: tenant-beta is denied INV-1001 (HTTP 403, no markers leaked).
- Isolation OK: tenant-alpha is denied INV-2001 (HTTP 403, no markers leaked).
- TENANT_ISOLATION_VERIFIED

## Evidence

- Kane CLI runs: `artifacts/evidence/run-before/kane/` and `artifacts/evidence/run-after/kane/` (specs, NDJSON logs, `output-*/Result.md`, screenshots, sealed `.evidence` packs)
- Structured finding: `artifacts/evidence/finding-bundle.json`
- Patch brief used by the coding agent: `artifacts/evidence/muse-patch-prompt.md`
