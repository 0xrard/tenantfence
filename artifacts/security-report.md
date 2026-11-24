# TenantFence — Security Verification Report

Target: https://tenantfence.vercel.app
Generated: 2026-11-24T12:57:22.662Z
Final status: **EXPOSURE_CONFIRMED_NOT_YET_FIXED**

## Run 1 — Before patch

Commit: `a22e9821b3a9a22ab8c7f1555684b71f351c3aea`

- Positive control OK: tenant-alpha can access INV-1001.
- Positive control OK: tenant-beta can access INV-2001.
- EXPOSURE: tenant-beta reached INV-1001 owned by tenant-alpha (HTTP 200, leaked markers: CONFIDENTIAL-ALPHA-9921, $15,000).
- EXPOSURE: tenant-alpha reached INV-2001 owned by tenant-beta (HTTP 200, leaked markers: CONFIDENTIAL-BETA-4410, $8,000).

### Finding: CROSS_TENANT_DATA_EXPOSURE

- Accessor: finance@beta.test (`tenant-beta`)
- Resource: INV-1001 (owner `tenant-alpha`)
- HTTP status on API probe: 200
- Leaked markers: `CONFIDENTIAL-ALPHA-9921`, `$15,000`
- Observed via: api, browser

### Finding: CROSS_TENANT_DATA_EXPOSURE

- Accessor: finance@alpha.test (`tenant-alpha`)
- Resource: INV-2001 (owner `tenant-beta`)
- HTTP status on API probe: 200
- Leaked markers: `CONFIDENTIAL-BETA-4410`, `$8,000`
- Observed via: api, browser

## Evidence

- Kane CLI runs: `artifacts/evidence/run-before/kane/` and `artifacts/evidence/run-after/kane/` (specs, NDJSON logs, `output-*/Result.md`, screenshots, sealed `.evidence` packs)
- Structured finding: `artifacts/evidence/finding-bundle.json`
- Patch brief used by the coding agent: `artifacts/evidence/muse-patch-prompt.md`
