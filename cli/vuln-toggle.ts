// TenantFence vulnerability toggle — for judges and demo use.
//
// The shipped default of the target app is SAFE (ownership check
// enforced). This toggle re-opens the controlled BOLA/IDOR hole so the
// full detect → patch → re-verify loop can be replayed from a fresh
// clone, and closes it again afterwards.
//
// It writes exactly ONE file, by copying a canonical template:
//   target-saas/app/api/invoices/[id]/route.ts   (the DETAIL route)
// It never touches target-saas/app/api/invoices/route.ts (the LIST
// route) — the two files share a name, so the path is spelled out in
// full here and asserted at runtime.
//
// Usage:
//   tsx cli/vuln-toggle.ts reopen   → install the vulnerable version
//   tsx cli/vuln-toggle.ts patch    → install the patched version
//   tsx cli/vuln-toggle.ts status   → report which version is installed

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cliDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(cliDir, "..");

// The one and only file this tool may write. Note the [id] segment:
// this is the invoice DETAIL route, not the list route.
const TARGET_REL = path.join(
  "target-saas",
  "app",
  "api",
  "invoices",
  "[id]",
  "route.ts"
);
const LIST_REL = path.join("target-saas", "app", "api", "invoices", "route.ts");

const TEMPLATES = {
  vulnerable: path.join(cliDir, "templates", "route.vulnerable.txt"),
  patched: path.join(cliDir, "templates", "route.patched.txt"),
} as const;

type State = "patched" | "vulnerable" | "custom";

async function currentState(targetPath: string): Promise<State> {
  let current: string;
  try {
    current = await fs.readFile(targetPath, "utf8");
  } catch {
    return "custom";
  }
  const patched = await fs.readFile(TEMPLATES.patched, "utf8");
  if (current === patched) return "patched";
  const vulnerable = await fs.readFile(TEMPLATES.vulnerable, "utf8");
  if (current === vulnerable) return "vulnerable";
  return "custom";
}

async function main(): Promise<number> {
  const mode = (process.argv[2] || "status").toLowerCase();
  const targetPath = path.join(repoRoot, TARGET_REL);

  // Safety rail: the resolved target must be the [id] detail route.
  if (!targetPath.includes(`${path.sep}[id]${path.sep}`)) {
    console.error(`Refusing to write unexpected path: ${targetPath}`);
    return 1;
  }

  if (mode === "status") {
    const state = await currentState(targetPath);
    console.log(`Invoice detail route is currently: ${state.toUpperCase()}`);
    console.log(`  file: ${TARGET_REL.split(path.sep).join("/")}`);
    console.log(
      state === "patched"
        ? "  Cross-tenant access is denied (403). Safe default."
        : state === "vulnerable"
          ? "  The controlled IDOR is OPEN — ready for a detection run."
          : "  File differs from both canonical versions (hand-edited?)."
    );
    return 0;
  }

  if (mode !== "reopen" && mode !== "patch") {
    console.error("Usage: vuln-toggle <reopen|patch|status>");
    return 1;
  }

  const want: keyof typeof TEMPLATES =
    mode === "reopen" ? "vulnerable" : "patched";
  const before = await currentState(targetPath);
  const content = await fs.readFile(TEMPLATES[want], "utf8");
  await fs.writeFile(targetPath, content, "utf8");
  const after = await currentState(targetPath);

  console.log(
    `Invoice detail route: ${before.toUpperCase()} → ${after.toUpperCase()}`
  );
  console.log(`  wrote: ${TARGET_REL.split(path.sep).join("/")}`);
  console.log(`  untouched: ${LIST_REL.split(path.sep).join("/")}`);
  if (mode === "reopen") {
    console.log(
      "  The controlled cross-tenant IDOR is open. Run `npm run verify` (live) or `npm run verify:local` (local target) to watch TenantFence catch it."
    );
  } else {
    console.log(
      "  Ownership check enforced (403 cross-tenant). This is the safe shipped default."
    );
  }
  return after === want ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
