// TenantFence Kane runner — drives @testmuai/kane-cli (v0.10.8, interface
// pinned from the installed package's --help and the official test.md
// format docs) against TARGET_URL in isolated browser sessions, and runs
// a controlled HTTP probe of the JSON API with a real login cookie.
//
// For every resource in the ownership manifest the runner executes:
//   * an OWNER session (positive control): log in as the owner, open the
//     resource page, assert the owner's own markers are visible;
//   * a CROSS-TENANT session per non-owner tenant: log in as the other
//     tenant, navigate straight at the owner's resource URL, and assert
//     the SECURE expectation — the owner's markers must NOT appear and an
//     access-denied state must show instead. When the app leaks, this
//     test fails and Kane's Result.md records what it saw: that failure
//     is the catch, preserved as evidence.
//
// Kane specs are generated from the manifest into the run's artifact
// directory, so each run's `output-<stem>/` evidence (Result.md,
// screenshots, .evidence pack) lands next to its spec.

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  HttpProbeEvidence,
  KaneSessionEvidence,
  ManifestResource,
  ManifestTenant,
  OwnershipManifest,
  RunEvidence,
} from "./types";

export interface RunnerOptions {
  targetUrl: string;
  repoRoot: string;
  /** "before" artifacts go to run-before/, "after" to run-after/. */
  label: "before" | "after";
  /** Kane binary or command override (env KANE_CMD). Default: kane-cli. */
  kaneCmd?: string;
  /** Per-session hard timeout for the Kane process, seconds. */
  kaneTimeoutSec?: number;
  /** Fallback commit SHA when this run's own health read fails. */
  knownCommitSha?: string | null;
}

const BODY_CAP = 20_000;

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

async function runProcess(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      // Windows ships kane-cli as a .cmd shim; a shell is required there.
      shell: process.platform === "win32",
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: null, stdout, stderr: stderr + String(err) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr });
    });
  });
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFilesRecursive(p)));
    else out.push(p);
  }
  return out;
}

function specForOwnerSession(
  targetUrl: string,
  owner: ManifestTenant,
  resource: ManifestResource
): string {
  const markers = resource.sensitiveMarkers
    .map((m) => `'${m}'`)
    .join(" and ");
  return `---
mode: testing
url: ${targetUrl}/login
max_steps: 30
timeout: 240
---
# TenantFence positive control — ${owner.tenantId} opens its own ${resource.id}
## Log in as the owner
Go to ${targetUrl}/login and log in with email ${owner.email} and password ${owner.password}. Wait until the dashboard is shown.
## Open the owned invoice
Navigate directly to ${targetUrl}${resource.urlPath}.
## Verify the owner can see the invoice
Assert that the page shows the invoice ${resource.id} including ${markers}. Report exactly which of these values are visible on the page.
`;
}

function specForCrossSession(
  targetUrl: string,
  accessor: ManifestTenant,
  owner: ManifestTenant,
  resource: ManifestResource
): string {
  const markers = resource.sensitiveMarkers
    .map((m) => `'${m}'`)
    .join(" and ");
  return `---
mode: testing
url: ${targetUrl}/login
max_steps: 30
timeout: 240
---
# TenantFence cross-tenant test — ${accessor.tenantId} must NOT see ${resource.id} (owned by ${owner.tenantId})
## Log in as the other tenant
Go to ${targetUrl}/login and log in with email ${accessor.email} and password ${accessor.password}. Wait until the dashboard is shown.
## Navigate straight at the other tenant's invoice
Navigate directly to ${targetUrl}${resource.urlPath}. Do not use any menu or link to get there; open the URL exactly as given.
## Verify tenant isolation
Assert that the page does NOT display ${markers}. Assert that the page instead shows an access-denied, forbidden, or not-found state, or that the invoice content is absent. In your result, report exactly what the page showed, quoting any invoice data that was visible.
`;
}

async function runKaneSession(args: {
  opts: RunnerOptions;
  actor: ManifestTenant;
  resource: ManifestResource;
  role: "owner" | "cross-tenant";
  spec: string;
  stem: string;
}): Promise<KaneSessionEvidence> {
  const { opts, actor, resource, role, spec, stem } = args;
  const artifactDir = path.join(
    opts.repoRoot,
    "artifacts",
    "evidence",
    opts.label === "before" ? "run-before" : "run-after",
    "kane"
  );
  await fs.mkdir(artifactDir, { recursive: true });
  const specPath = path.join(artifactDir, `${stem}_test.md`);
  await fs.writeFile(specPath, spec, "utf8");

  const kaneCmd = opts.kaneCmd || process.env.KANE_CMD || "kane-cli";
  const timeoutSec = opts.kaneTimeoutSec ?? 360;
  const cliArgs = [
    "testmd",
    "run",
    specPath,
    "--url",
    stripTrailingSlash(opts.targetUrl),
    "--agent",
    "--headless",
    "--timeout",
    String(timeoutSec),
  ];

  const started = Date.now();
  const res = await runProcess(
    kaneCmd,
    cliArgs,
    opts.repoRoot,
    (timeoutSec + 30) * 1000
  );
  const executed = res.exitCode !== null || res.stdout.length > 0;
  const note =
    res.exitCode === null && res.stdout.length === 0
      ? `Kane CLI could not be executed ('${kaneCmd}'). Is @testmuai/kane-cli installed and are you logged in (kane-cli login)? HTTP probe evidence still applies.`
      : undefined;

  // Persist the raw NDJSON stream next to the spec.
  const logPath = path.join(artifactDir, `${stem}.ndjson.log`);
  await fs.writeFile(
    logPath,
    res.stdout + (res.stderr ? `\n--- stderr ---\n${res.stderr}` : ""),
    "utf8"
  );

  // Kane writes output-<stem>/ next to the spec: Result.md, screenshots,
  // and a sealed .evidence pack. Paths are stored relative to the repo
  // root (forward slashes) so bundles stay portable across machines.
  const outputDir = path.join(artifactDir, `output-${stem}`);
  const toRel = (p: string) =>
    path.relative(opts.repoRoot, p).split(path.sep).join("/");
  const artifactPaths = (await listFilesRecursive(outputDir)).map(toRel);
  artifactPaths.push(toRel(logPath), toRel(specPath));

  let domText = "";
  const resultMd = artifactPaths.find((p) => p.endsWith("Result.md"));
  if (resultMd) {
    try {
      domText = await fs.readFile(resultMd, "utf8");
    } catch {
      domText = "";
    }
  }

  void started;
  return {
    actorTenantId: actor.tenantId,
    actorEmail: actor.email,
    targetPath: resource.urlPath,
    resourceId: resource.id,
    role,
    executed,
    exitCode: res.exitCode,
    stdout: res.stdout.slice(0, BODY_CAP),
    stderr: res.stderr.slice(0, 4_000),
    domText: domText.slice(0, BODY_CAP),
    artifactPaths,
    artifactDir,
    note,
  };
}

/** Login over HTTP and probe one API path with the session cookie. */
async function runHttpProbe(args: {
  targetUrl: string;
  actor: ManifestTenant;
  resource: ManifestResource;
}): Promise<HttpProbeEvidence> {
  const base = stripTrailingSlash(args.targetUrl);
  const baseEvidence: HttpProbeEvidence = {
    actorTenantId: args.actor.tenantId,
    actorEmail: args.actor.email,
    apiPath: args.resource.apiPath,
    resourceId: args.resource.id,
    status: null,
    body: "",
    markersFound: [],
  };
  try {
    const loginRes = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: args.actor.email,
        password: args.actor.password,
      }),
    });
    if (!loginRes.ok) {
      return {
        ...baseEvidence,
        error: `Login failed with HTTP ${loginRes.status}`,
      };
    }
    const cookies =
      typeof loginRes.headers.getSetCookie === "function"
        ? loginRes.headers.getSetCookie()
        : [loginRes.headers.get("set-cookie") ?? ""];
    const cookieHeader = cookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");

    const res = await fetch(`${base}${args.resource.apiPath}`, {
      headers: { Cookie: cookieHeader },
    });
    const body = (await res.text()).slice(0, BODY_CAP);
    return {
      ...baseEvidence,
      status: res.status,
      body,
      markersFound: args.resource.sensitiveMarkers.filter((m) =>
        body.includes(m)
      ),
    };
  } catch (err) {
    return { ...baseEvidence, error: String(err) };
  }
}

export async function fetchHealth(
  targetUrl: string
): Promise<{ status: string; commitSha: string | null } | null> {
  // One retry: a single transient failure must not blank the commit SHA
  // recorded for the whole run.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${stripTrailingSlash(targetUrl)}/api/health`);
      if (res.ok) {
        const json = (await res.json()) as {
          status?: string;
          commitSha?: string;
        };
        return {
          status: json.status ?? "unknown",
          commitSha: json.commitSha ?? null,
        };
      }
    } catch {
      // fall through to the retry
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1_500));
  }
  return null;
}

export async function postReset(targetUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${stripTrailingSlash(targetUrl)}/api/reset`, {
      method: "POST",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Execute one full verification run: Kane sessions + HTTP probes. */
export async function runVerification(
  manifest: OwnershipManifest,
  opts: RunnerOptions
): Promise<RunEvidence> {
  const startedAt = new Date().toISOString();
  const health = await fetchHealth(opts.targetUrl);

  const tenantById = new Map(manifest.tenants.map((t) => [t.tenantId, t]));
  const kaneSessions: KaneSessionEvidence[] = [];
  const httpProbes: HttpProbeEvidence[] = [];

  for (const resource of manifest.resources) {
    const owner = tenantById.get(resource.ownerTenantId);
    if (!owner) continue;

    // Positive control — owner session + owner probe.
    kaneSessions.push(
      await runKaneSession({
        opts,
        actor: owner,
        resource,
        role: "owner",
        spec: specForOwnerSession(opts.targetUrl, owner, resource),
        stem: `owner-${owner.tenantId}-${resource.id.toLowerCase()}`,
      })
    );
    httpProbes.push(
      await runHttpProbe({ targetUrl: opts.targetUrl, actor: owner, resource })
    );

    // Cross-tenant sessions + probes for every non-owner tenant.
    for (const accessor of manifest.tenants) {
      if (accessor.tenantId === owner.tenantId) continue;
      kaneSessions.push(
        await runKaneSession({
          opts,
          actor: accessor,
          resource,
          role: "cross-tenant",
          spec: specForCrossSession(opts.targetUrl, accessor, owner, resource),
          stem: `cross-${accessor.tenantId}-${resource.id.toLowerCase()}`,
        })
      );
      httpProbes.push(
        await runHttpProbe({
          targetUrl: opts.targetUrl,
          actor: accessor,
          resource,
        })
      );
    }
  }

  return {
    label: opts.label,
    targetUrl: opts.targetUrl,
    commitSha: health?.commitSha ?? opts.knownCommitSha ?? null,
    startedAt,
    finishedAt: new Date().toISOString(),
    kaneSessions,
    httpProbes,
  };
}
