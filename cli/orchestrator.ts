// TenantFence orchestrator — the closed loop, end to end:
//
//   1. Reset the demo data; record the starting commitSha.
//   2. Run 1 (before): Kane CLI sessions + HTTP probes → verifier.
//   3. If an exposure is proven, hand the evidence bundle to the coding
//      agent via the bridge and wait for the patch to land.
//   4. If the target is remote, poll /api/health until Vercel serves the
//      new commit.
//   5. Run 2 (after): reset, re-run everything, verify the fence holds
//      while owners keep their access.
//   6. Write artifacts/security-report.md and .html.
//
// Exit code 0 only when the final verdict is TENANT_ISOLATION_VERIFIED.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handOffToAgent, writeFindingBundle } from "./agent-bridge";
import {
  fetchHealth,
  postReset,
  runVerification,
} from "./kane-runner";
import type {
  OwnershipManifest,
  RunEvidence,
  RunVerdict,
} from "./types";
import { verifyRun } from "./verifier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/** Minimal .env loader (no dependency): KEY=VALUE lines, no overrides. */
async function loadDotEnv(): Promise<void> {
  try {
    const raw = await fs.readFile(path.join(repoRoot, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env is optional when TARGET_URL is exported in the shell.
  }
}

async function loadManifest(): Promise<OwnershipManifest> {
  const raw = await fs.readFile(
    path.join(repoRoot, "specs", "ownership.manifest.json"),
    "utf8"
  );
  return JSON.parse(raw) as OwnershipManifest;
}

async function saveJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function printVerdict(title: string, verdict: RunVerdict): void {
  console.log("");
  console.log(`=== ${title} ===`);
  for (const line of verdict.summary) console.log(`  ${line}`);
  console.log(
    `  Owner access: ${verdict.ownerAccessOk ? "OK" : "BROKEN"} · ` +
      `Findings: ${verdict.findings.length} · ` +
      `Isolation: ${verdict.isolationVerified ? "VERIFIED" : "NOT VERIFIED"}`
  );
}

async function waitForNewCommit(
  targetUrl: string,
  oldSha: string | null,
  timeoutMs: number
): Promise<string | null> {
  const isLocal = /localhost|127\.0\.0\.1/.test(targetUrl);
  if (isLocal) {
    console.log(
      "[deploy] Local target — assuming the dev server hot-reloads the patch."
    );
    await new Promise((r) => setTimeout(r, 3_000));
    return (await fetchHealth(targetUrl))?.commitSha ?? null;
  }
  console.log(
    `[deploy] Polling /api/health for a new commit (was ${oldSha ?? "?"})…`
  );
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await fetchHealth(targetUrl);
    if (health?.commitSha && oldSha && health.commitSha !== oldSha) {
      console.log(`[deploy] New commit live: ${health.commitSha}`);
      return health.commitSha;
    }
    if (health?.commitSha && !oldSha) return health.commitSha;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  console.log("[deploy] Timed out waiting for the new commit to deploy.");
  return null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildReportMd(args: {
  targetUrl: string;
  before: { evidence: RunEvidence; verdict: RunVerdict };
  after?: { evidence: RunEvidence; verdict: RunVerdict };
}): string {
  const { targetUrl, before, after } = args;
  const finalStatus = after?.verdict.isolationVerified
    ? "TENANT_ISOLATION_VERIFIED"
    : before.verdict.findings.length === 0
      ? "NO_EXPOSURE_DETECTED"
      : "EXPOSURE_CONFIRMED_NOT_YET_FIXED";
  const lines: string[] = [
    "# TenantFence — Security Verification Report",
    "",
    `Target: ${targetUrl}`,
    `Generated: ${new Date().toISOString()}`,
    `Final status: **${finalStatus}**`,
    "",
    "## Run 1 — Before patch",
    "",
    `Commit: \`${before.evidence.commitSha ?? "unknown"}\``,
    "",
    ...before.verdict.summary.map((s) => `- ${s}`),
    "",
  ];
  for (const f of before.verdict.findings) {
    lines.push(
      `### Finding: ${f.kind}`,
      "",
      `- Accessor: ${f.accessorEmail} (\`${f.accessorTenantId}\`)`,
      `- Resource: ${f.resourceId} (owner \`${f.ownerTenantId}\`)`,
      `- HTTP status on API probe: ${f.httpStatus ?? "n/a"}`,
      `- Leaked markers: ${f.leakedMarkers.map((m) => `\`${m}\``).join(", ") || "—"}`,
      `- Observed via: ${f.observedVia.join(", ") || "status only"}`,
      ""
    );
  }
  if (after) {
    lines.push(
      "## Run 2 — After patch",
      "",
      `Commit: \`${after.evidence.commitSha ?? "unknown"}\``,
      "",
      ...after.verdict.summary.map((s) => `- ${s}`),
      "",
      after.verdict.isolationVerified
        ? "Cross-tenant access is denied (403) and every owner keeps full access to their own invoices."
        : "Isolation is NOT fully verified — see the Run 2 summary above.",
      ""
    );
  }
  lines.push(
    "## Evidence",
    "",
    "- Kane CLI runs: `artifacts/evidence/run-before/kane/` and `artifacts/evidence/run-after/kane/` (specs, NDJSON logs, `output-*/Result.md`, screenshots, sealed `.evidence` packs)",
    "- Structured finding: `artifacts/evidence/finding-bundle.json`",
    "- Patch brief used by the coding agent: `artifacts/evidence/muse-patch-prompt.md`",
    ""
  );
  return lines.join("\n");
}

function buildReportHtml(args: {
  targetUrl: string;
  before: { evidence: RunEvidence; verdict: RunVerdict };
  after?: { evidence: RunEvidence; verdict: RunVerdict };
}): string {
  const md = buildReportMd(args);
  const finalStatus = args.after?.verdict.isolationVerified
    ? "TENANT_ISOLATION_VERIFIED"
    : "SEE REPORT";
  const rows = (v: RunVerdict) =>
    v.summary.map((s) => `<li>${esc(s)}</li>`).join("");
  const findings = args.before.verdict.findings
    .map(
      (f) => `<div class="finding">
        <strong>${esc(f.kind)}</strong><br>
        ${esc(f.accessorEmail)} (${esc(f.accessorTenantId)}) reached
        ${esc(f.resourceId)} owned by ${esc(f.ownerTenantId)} —
        HTTP ${f.httpStatus ?? "n/a"}, leaked:
        ${f.leakedMarkers.map((m) => `<code>${esc(m)}</code>`).join(" ") || "—"}
      </div>`
    )
    .join("");
  void md;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>TenantFence — Security Verification Report</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b1220;color:#e5e9f0;margin:0;padding:2rem}
  main{max-width:860px;margin:0 auto}
  h1{font-size:1.6rem} h2{margin-top:2rem;color:#9fd0ff}
  .status{display:inline-block;padding:.35rem .8rem;border-radius:999px;font-weight:700;background:${
    finalStatus === "TENANT_ISOLATION_VERIFIED" ? "#14532d" : "#7f1d1d"
  };color:#fff}
  .finding{background:#1e293b;border:1px solid #7f1d1d;border-radius:.5rem;padding:1rem;margin:.5rem 0}
  code{background:#111827;padding:.1rem .35rem;border-radius:.25rem}
  li{margin:.3rem 0} .muted{color:#94a3b8}
</style></head><body><main>
<h1>TenantFence — Security Verification Report</h1>
<p class="muted">Target: ${esc(args.targetUrl)} · Generated: ${esc(new Date().toISOString())}</p>
<p>Final status: <span class="status">${esc(finalStatus)}</span></p>
<h2>Run 1 — Before patch</h2>
<p class="muted">Commit: <code>${esc(args.before.evidence.commitSha ?? "unknown")}</code></p>
<ul>${rows(args.before.verdict)}</ul>
${findings}
${
  args.after
    ? `<h2>Run 2 — After patch</h2>
<p class="muted">Commit: <code>${esc(args.after.evidence.commitSha ?? "unknown")}</code></p>
<ul>${rows(args.after.verdict)}</ul>`
    : ""
}
<h2>Evidence</h2>
<ul>
<li>Kane CLI artifacts: <code>artifacts/evidence/run-before/kane/</code>, <code>artifacts/evidence/run-after/kane/</code></li>
<li>Finding bundle: <code>artifacts/evidence/finding-bundle.json</code></li>
<li>Patch brief: <code>artifacts/evidence/muse-patch-prompt.md</code></li>
</ul>
</main></body></html>`;
}

async function main(): Promise<number> {
  await loadDotEnv();
  const targetUrl = (process.env.TARGET_URL || "").replace(/\/+$/, "");
  if (!targetUrl) {
    console.error(
      "TARGET_URL is not set. Copy .env.example to .env and set your deployed app URL."
    );
    return 1;
  }
  const manifest = await loadManifest();
  console.log(`TenantFence closed-loop verification → ${targetUrl}`);

  // Step 1 — reset + starting commit.
  await postReset(targetUrl);
  const startHealth = await fetchHealth(targetUrl);
  console.log(`[start] commitSha: ${startHealth?.commitSha ?? "unknown"}`);

  // Step 2 — Run 1 (before).
  const beforeEvidence = await runVerification(manifest, {
    targetUrl,
    repoRoot,
    label: "before",
    knownCommitSha: startHealth?.commitSha ?? null,
  });
  const beforeVerdict = verifyRun(manifest, beforeEvidence);
  await saveJson(
    path.join(repoRoot, "artifacts", "evidence", "run-before", "evidence.json"),
    beforeEvidence
  );
  await saveJson(
    path.join(repoRoot, "artifacts", "evidence", "run-before", "verdict.json"),
    beforeVerdict
  );
  printVerdict("Run 1 — BEFORE patch", beforeVerdict);

  let after: { evidence: RunEvidence; verdict: RunVerdict } | undefined;

  if (beforeVerdict.findings.length === 0) {
    console.log(
      "\nNo cross-tenant exposure detected in Run 1 — nothing to patch."
    );
  } else {
    // Step 3 — hand the evidence to the coding agent.
    const { promptPath } = await writeFindingBundle({
      repoRoot,
      targetUrl,
      commitSha: beforeEvidence.commitSha,
      verdict: beforeVerdict,
    });
    console.log(`\n[bundle] artifacts/evidence/finding-bundle.json`);
    console.log(`[bundle] artifacts/evidence/muse-patch-prompt.md`);
    const changed = await handOffToAgent({ repoRoot, promptPath });
    if (!changed) {
      console.log(
        "Patch not detected — stopping before Run 2. Re-run `npm run verify` after patching."
      );
    } else {
      // Step 4 — wait for the redeploy (remote targets).
      const newSha = await waitForNewCommit(
        targetUrl,
        beforeEvidence.commitSha,
        20 * 60 * 1000
      );
      // Step 5 — Run 2 (after).
      await postReset(targetUrl);
      const afterEvidence = await runVerification(manifest, {
        targetUrl,
        repoRoot,
        label: "after",
        knownCommitSha: newSha,
      });
      const afterVerdict = verifyRun(manifest, afterEvidence);
      await saveJson(
        path.join(repoRoot, "artifacts", "evidence", "run-after", "evidence.json"),
        afterEvidence
      );
      await saveJson(
        path.join(repoRoot, "artifacts", "evidence", "run-after", "verdict.json"),
        afterVerdict
      );
      printVerdict("Run 2 — AFTER patch", afterVerdict);
      after = { evidence: afterEvidence, verdict: afterVerdict };
    }
  }

  // Step 6 — reports.
  const reportArgs = {
    targetUrl,
    before: { evidence: beforeEvidence, verdict: beforeVerdict },
    after,
  };
  await fs.mkdir(path.join(repoRoot, "artifacts"), { recursive: true });
  await fs.writeFile(
    path.join(repoRoot, "artifacts", "security-report.md"),
    buildReportMd(reportArgs),
    "utf8"
  );
  await fs.writeFile(
    path.join(repoRoot, "artifacts", "security-report.html"),
    buildReportHtml(reportArgs),
    "utf8"
  );
  console.log("\n[report] artifacts/security-report.md");
  console.log("[report] artifacts/security-report.html");

  const verified =
    after?.verdict.isolationVerified ??
    (beforeVerdict.findings.length === 0 && beforeVerdict.isolationVerified);
  console.log(
    verified
      ? "\nFINAL: TENANT_ISOLATION_VERIFIED"
      : "\nFINAL: isolation not verified — see the report."
  );
  return verified ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
