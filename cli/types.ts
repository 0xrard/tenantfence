// TenantFence CLI — shared types.
//
// The ownership manifest (specs/ownership.manifest.json) is the contract.
// Everything the verifier concludes is derived from these shapes plus the
// evidence a run actually captured — never from assumptions about the app.

export interface ManifestTenant {
  tenantId: string;
  email: string;
  password: string;
}

export interface ManifestResource {
  id: string;
  type: string;
  ownerTenantId: string;
  urlPath: string;
  apiPath: string;
  sensitiveMarkers: string[];
}

export interface OwnershipManifest {
  version: number;
  app: string;
  description?: string;
  tenants: ManifestTenant[];
  resources: ManifestResource[];
}

/** One Kane CLI browser session (one login, one target page). */
export interface KaneSessionEvidence {
  /** Who was logged in for this session. */
  actorTenantId: string;
  /** Email used to log in. */
  actorEmail: string;
  /** Page the session navigated to (path, e.g. /invoices/INV-1001). */
  targetPath: string;
  /** Resource id the session was aimed at, when applicable. */
  resourceId?: string;
  /** "owner" = positive control, "cross-tenant" = attack session. */
  role: "owner" | "cross-tenant";
  /** Whether the kane binary actually ran. False when unavailable. */
  executed: boolean;
  /** Process exit code, when executed. */
  exitCode: number | null;
  /** Raw stdout captured from the CLI. */
  stdout: string;
  /** Raw stderr captured from the CLI. */
  stderr: string;
  /** Visible page text the run reported, when the CLI exposes it. */
  domText: string;
  /** Artifact files (screenshots, logs) collected for this session. */
  artifactPaths: string[];
  /** Directory this session's artifacts were written to. */
  artifactDir: string;
  /** Human-readable note when the session could not run. */
  note?: string;
}

/** Controlled HTTP probe of the JSON API, using a real login cookie. */
export interface HttpProbeEvidence {
  actorTenantId: string;
  actorEmail: string;
  /** API path probed, e.g. /api/invoices/INV-1001. */
  apiPath: string;
  resourceId: string;
  /** HTTP status the server returned, or null on network failure. */
  status: number | null;
  /** Raw response body (truncated by the runner if huge). */
  body: string;
  /** Sensitive markers found verbatim in the body. */
  markersFound: string[];
  error?: string;
}

/** Everything one verification run (before or after) captured. */
export interface RunEvidence {
  label: "before" | "after";
  targetUrl: string;
  /** commitSha reported by GET /api/health at the start of the run. */
  commitSha: string | null;
  startedAt: string;
  finishedAt: string;
  kaneSessions: KaneSessionEvidence[];
  httpProbes: HttpProbeEvidence[];
}

export type FindingKind = "CROSS_TENANT_DATA_EXPOSURE";

/** A proven cross-tenant exposure, ready to hand to a coding agent. */
export interface SecurityFinding {
  kind: FindingKind;
  /** Tenant that performed the access (the attacker in this test). */
  accessorTenantId: string;
  accessorEmail: string;
  /** Resource that was exposed. */
  resourceId: string;
  /** Tenant that legitimately owns the resource. */
  ownerTenantId: string;
  /** HTTP status observed on the API probe (null if probe failed). */
  httpStatus: number | null;
  /** Sensitive markers proven to have leaked. */
  leakedMarkers: string[];
  /** Where the leak was observed: "api", "browser", or both. */
  observedVia: Array<"api" | "browser">;
  /** Paths of the Kane CLI artifacts backing this finding. */
  evidencePaths: string[];
  detectedAt: string;
}

/** Verdict of one run after comparing evidence against the manifest. */
export interface RunVerdict {
  label: "before" | "after";
  /** True when every owner could still reach their own resource. */
  ownerAccessOk: boolean;
  findings: SecurityFinding[];
  /** True when no exposure was found AND owner access works. */
  isolationVerified: boolean;
  summary: string[];
}
