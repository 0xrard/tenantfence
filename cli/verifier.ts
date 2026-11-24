// TenantFence verifier — compares run evidence against the ownership
// manifest and decides, with proof, whether tenant isolation holds.
//
// Rules (from the Phase 2 brief):
//  - A cross-tenant access is a CROSS_TENANT_DATA_EXPOSURE when the API
//    probe status is not 403; leaked markers are read from the probe
//    body. Kane session text is never scanned for markers (the test
//    spec itself quotes them); a failed Kane isolation assertion only
//    corroborates a probe conviction as browser-observed.
//  - A run can only be called "verified" when isolation holds AND every
//    owner can still open their own resource (otherwise a totally broken
//    app would false-positive as "secure").

import type {
  OwnershipManifest,
  RunEvidence,
  RunVerdict,
  SecurityFinding,
} from "./types";

function markersIn(text: string, markers: string[]): string[] {
  return markers.filter((m) => text.includes(m));
}

export function verifyRun(
  manifest: OwnershipManifest,
  evidence: RunEvidence
): RunVerdict {
  const summary: string[] = [];
  const findings: SecurityFinding[] = [];

  const tenantById = new Map(manifest.tenants.map((t) => [t.tenantId, t]));

  // --- Owner access (positive control) -------------------------------------
  // An owner "can access" when their API probe returns 200 with at least
  // one of their own markers present, or their browser session shows one.
  let ownerAccessOk = true;
  for (const resource of manifest.resources) {
    const owner = tenantById.get(resource.ownerTenantId);
    if (!owner) continue;

    const probe = evidence.httpProbes.find(
      (p) => p.resourceId === resource.id && p.actorTenantId === owner.tenantId
    );
    const probeOk =
      !!probe &&
      probe.status === 200 &&
      markersIn(probe.body, resource.sensitiveMarkers).length > 0;

    const session = evidence.kaneSessions.find(
      (s) => s.resourceId === resource.id && s.actorTenantId === owner.tenantId
    );
    const sessionOk =
      !!session &&
      session.executed &&
      markersIn(session.domText || session.stdout, resource.sensitiveMarkers)
        .length > 0;

    // The HTTP probe is authoritative when present. The browser session
    // is only a fallback for when the probe could not run at all — its
    // text quotes the markers from the test's own instructions, so it
    // can never be the sole proof of access.
    const ok = probe ? probeOk : sessionOk;
    if (!ok) {
      ownerAccessOk = false;
      summary.push(
        `POSITIVE CONTROL FAILED: owner ${owner.tenantId} could not access ` +
          `their own resource ${resource.id} (probe status: ${
            probe?.status ?? "n/a"
          }). The app may be broken — isolation cannot be certified.`
      );
    } else {
      summary.push(
        `Positive control OK: ${owner.tenantId} can access ${resource.id}.`
      );
    }
  }

  // --- Cross-tenant exposure ------------------------------------------------
  for (const resource of manifest.resources) {
    const owner = tenantById.get(resource.ownerTenantId);
    if (!owner) continue;

    for (const accessor of manifest.tenants) {
      if (accessor.tenantId === resource.ownerTenantId) continue;

      const probe = evidence.httpProbes.find(
        (p) =>
          p.resourceId === resource.id &&
          p.actorTenantId === accessor.tenantId
      );
      const session = evidence.kaneSessions.find(
        (s) =>
          s.resourceId === resource.id &&
          s.actorTenantId === accessor.tenantId
      );

      const leaked = new Set<string>();
      const via = new Set<"api" | "browser">();

      // The HTTP probe is the exposure oracle: it reads the exact JSON
      // the browser page would render. Per the brief, a cross-tenant
      // probe that is not a clean 403 convicts; leaked markers are read
      // from the probe body only.
      //
      // The Kane session's captured text is NEVER scanned for markers:
      // the cross-tenant spec itself names the markers in its assertion
      // ("the page must NOT display '…'"), so Kane's Result.md and
      // NDJSON quote them even when the page showed nothing — scanning
      // that text false-convicts a correctly patched app. Instead, a
      // FAILED Kane isolation assertion (non-zero exit) corroborates a
      // probe conviction as browser-observed.
      let statusNotForbidden = false;
      if (probe) {
        const found = markersIn(probe.body, resource.sensitiveMarkers);
        found.forEach((m) => leaked.add(m));
        if (found.length > 0) via.add("api");
        statusNotForbidden = probe.status !== 403 && probe.status !== null;
        if (statusNotForbidden) via.add("api");
      }

      if (
        statusNotForbidden &&
        session &&
        session.executed &&
        session.exitCode !== null &&
        session.exitCode !== 0
      ) {
        via.add("browser");
      }

      const markerLeak = leaked.size > 0;
      if (statusNotForbidden) {
        const evidencePaths: string[] = [];
        if (session) evidencePaths.push(...session.artifactPaths);
        findings.push({
          kind: "CROSS_TENANT_DATA_EXPOSURE",
          accessorTenantId: accessor.tenantId,
          accessorEmail: accessor.email,
          resourceId: resource.id,
          ownerTenantId: resource.ownerTenantId,
          httpStatus: probe?.status ?? null,
          leakedMarkers: [...leaked],
          observedVia: [...via],
          evidencePaths,
          detectedAt: new Date().toISOString(),
        });
        summary.push(
          `EXPOSURE: ${accessor.tenantId} reached ${resource.id} owned by ` +
            `${resource.ownerTenantId} (HTTP ${probe?.status ?? "n/a"}` +
            (markerLeak
              ? `, leaked markers: ${[...leaked].join(", ")}`
              : ", no 403 returned") +
            `).`
        );
      } else {
        summary.push(
          `Isolation OK: ${accessor.tenantId} is denied ${resource.id} ` +
            `(HTTP ${probe?.status ?? "n/a"}, no markers leaked).`
        );
      }
    }
  }

  const isolationVerified = findings.length === 0 && ownerAccessOk;
  if (isolationVerified) {
    summary.push("TENANT_ISOLATION_VERIFIED");
  }

  return {
    label: evidence.label,
    ownerAccessOk,
    findings,
    isolationVerified,
    summary,
  };
}
