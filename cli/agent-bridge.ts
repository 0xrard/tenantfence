// TenantFence agent bridge — turns a verified finding into a patch task
// for an AI coding agent (Muse), then waits for the patch to land.
//
// Outputs:
//   artifacts/evidence/finding-bundle.json  — structured evidence
//   artifacts/evidence/muse-patch-prompt.md — self-contained patch brief
//
// Execution modes:
//   * AGENT_CMD set   → the command is spawned with the prompt on stdin.
//   * AGENT_CMD unset → watch mode: the bridge watches the vulnerable
//     route file and returns as soon as its content changes, printing
//     exactly what the human/agent must do (patch, commit, push).

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { RunVerdict, SecurityFinding } from "./types";

export const ROUTE_REL_PATH = path.join(
  "target-saas",
  "app",
  "api",
  "invoices",
  "[id]",
  "route.ts"
);

export interface FindingBundle {
  generatedAt: string;
  targetUrl: string;
  commitSha: string | null;
  routeFile: string;
  findings: SecurityFinding[];
}

async function readRouteSource(repoRoot: string): Promise<string> {
  try {
    return await fs.readFile(path.join(repoRoot, ROUTE_REL_PATH), "utf8");
  } catch {
    return "// (route source could not be read from this working copy)";
  }
}

export function buildPatchPrompt(
  bundle: FindingBundle,
  routeSource: string
): string {
  const perFinding = bundle.findings
    .map(
      (x) => `### ${x.resourceId} — owned by \`${x.ownerTenantId}\`

- Accessor (attacker in this test): **${x.accessorEmail}** (\`${x.accessorTenantId}\`)
- API probe result: HTTP **${x.httpStatus ?? "n/a"}** on \`GET /api/invoices/${x.resourceId}\` with the accessor's session cookie
- Sensitive markers leaked: ${
        x.leakedMarkers.map((m) => `\`${m}\``).join(", ") ||
        "(endpoint returned a non-403 status)"
      }
- Observed via: ${x.observedVia.join(", ") || "status only"}${
        x.evidencePaths.length
          ? `\n- Kane CLI evidence:\n${x.evidencePaths.map((p) => `  - ${p}`).join("\n")}`
          : ""
      }`
    )
    .join("\n\n");

  return `# TenantFence patch task — fix CROSS_TENANT_DATA_EXPOSURE

TenantFence (Kane CLI + HTTP probe evidence) has PROVEN a cross-tenant
data exposure in the InvoiceFlow target app. Your job: apply the smallest
correct authorization fix so the closed loop can re-verify.

## What was proven

Target: ${bundle.targetUrl} (commit ${bundle.commitSha ?? "unknown"})

${perFinding}

Full structured bundle: \`artifacts/evidence/finding-bundle.json\`.

## The vulnerable file

\`${ROUTE_REL_PATH.split(path.sep).join("/")}\` currently authenticates the
caller but never checks that the invoice belongs to the caller's tenant:

\`\`\`ts
${routeSource}
\`\`\`

## Required fix

In the \`GET\` handler, after loading the invoice and before returning it:

1. Compare \`invoice.tenantId\` with the authenticated caller's tenant id
   (\`tenant.tenantId\` from \`getSessionTenant(req)\` in the current code).
2. If they differ, return **HTTP 403** with a JSON body such as
   \`{ "error": "Forbidden" }\`. Do not include any invoice fields.
3. Keep the existing behavior otherwise: 401 when logged out, 404 when
   the invoice does not exist, 200 with the invoice for its owner.

Do not change any other file. Do not rename routes or alter the session
mechanism. After saving the change, commit and push so Vercel redeploys —
TenantFence is polling \`/api/health\` for the new commit SHA and will
re-run the full verification automatically.
`;
}

export async function writeFindingBundle(args: {
  repoRoot: string;
  targetUrl: string;
  commitSha: string | null;
  verdict: RunVerdict;
}): Promise<{ bundle: FindingBundle; bundlePath: string; promptPath: string }> {
  const bundle: FindingBundle = {
    generatedAt: new Date().toISOString(),
    targetUrl: args.targetUrl,
    commitSha: args.commitSha,
    routeFile: ROUTE_REL_PATH.split(path.sep).join("/"),
    findings: args.verdict.findings,
  };
  const evidenceDir = path.join(args.repoRoot, "artifacts", "evidence");
  await fs.mkdir(evidenceDir, { recursive: true });
  const bundlePath = path.join(evidenceDir, "finding-bundle.json");
  await fs.writeFile(bundlePath, JSON.stringify(bundle, null, 2), "utf8");

  const routeSource = await readRouteSource(args.repoRoot);
  const promptPath = path.join(evidenceDir, "muse-patch-prompt.md");
  await fs.writeFile(promptPath, buildPatchPrompt(bundle, routeSource), "utf8");

  return { bundle, bundlePath, promptPath };
}

function hashContent(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Hand the finding to the coding agent and wait until the route file's
 * content actually changes. Resolves true when a change was observed.
 */
export async function handOffToAgent(args: {
  repoRoot: string;
  promptPath: string;
  watchTimeoutMs?: number;
}): Promise<boolean> {
  const routePath = path.join(args.repoRoot, ROUTE_REL_PATH);
  let beforeHash = "";
  try {
    beforeHash = hashContent(await fs.readFile(routePath, "utf8"));
  } catch {
    beforeHash = "";
  }

  const agentCmd = process.env.AGENT_CMD;
  if (agentCmd) {
    console.log(`[bridge] AGENT_CMD is set — invoking: ${agentCmd}`);
    const prompt = await fs.readFile(args.promptPath, "utf8");
    await new Promise<void>((resolve) => {
      const child = spawn(agentCmd, {
        cwd: args.repoRoot,
        shell: true,
        env: process.env,
        stdio: ["pipe", "inherit", "inherit"],
      });
      child.on("close", () => resolve());
      child.on("error", () => resolve());
      child.stdin.write(prompt);
      child.stdin.end();
    });
    // After an automated agent run, still confirm the file changed.
  } else {
    console.log("");
    console.log("┌──────────────────────────────────────────────────────────────┐");
    console.log("│ ACTION REQUIRED — hand the patch task to your coding agent  │");
    console.log("├──────────────────────────────────────────────────────────────┤");
    console.log(`│ 1. Give Muse the file: artifacts/evidence/muse-patch-prompt.md`);
    console.log("│ 2. Let it patch target-saas/app/api/invoices/[id]/route.ts  │");
    console.log("│ 3. git add -A && git commit && git push (Vercel redeploys)  │");
    console.log("│ TenantFence is watching the route file and /api/health.     │");
    console.log("└──────────────────────────────────────────────────────────────┘");
    console.log("");
  }

  const timeoutMs = args.watchTimeoutMs ?? 20 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_000));
    try {
      const now = hashContent(await fs.readFile(routePath, "utf8"));
      if (now !== beforeHash) {
        console.log("[bridge] Route file changed — patch detected.");
        return true;
      }
    } catch {
      // File briefly unreadable (editor save in progress) — keep waiting.
    }
  }
  console.log("[bridge] Timed out waiting for the route file to change.");
  return false;
}
