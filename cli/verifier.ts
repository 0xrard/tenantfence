// TenantFence verifier — compares run evidence against the ownership
// manifest and decides, with proof, whether tenant isolation holds.
//
// Rules (from the Tahap 2 brief):
//  - A cross-tenant access is a CROSS_TENANT_DATA_EXPOSURE when the API
//    probe status is not 403, OR any of the owner's sensitiveMarkers show
//    up in the API body or in the browser session's captured text.
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

    // The HTTP probe is authoritative when present; the browser session is
    // supporting evidence. If neither proves access, the control failed.
    const ok = probeOk || sessionOk;
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

      let statusNotForbidden = false;
      if (probe) {
        const found = markersIn(probe.body, resource.sensitiveMarkers);
        found.forEach((m) => leaked.add(m));
        if (found.length > 0) via.add("api");
        // Per the brief: anything other than a clean 403 on a cross-tenant
        // API probe counts against isolation when the resource exists.
        statusNotForbidden = probe.status !== 403 && probe.status !== null;
      }

      if (session && session.executed) {
        const found = markersIn(
          session.domText || session.stdout,
          resource.sensitiveMarkers
        );
        found.forEach((m) => leaked.add(m));
        if (found.length > 0) via.add("browser");
      }

      const markerLeak = leaked.size > 0;
      if (markerLeak || statusNotForbidden) {
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
