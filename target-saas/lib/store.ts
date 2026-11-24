// InvoiceFlow in-memory data store.
//
// Deliberately simple: data lives in a module-level singleton (kept on
// globalThis so Next.js dev/HMR module reloads do not wipe it) and is
// seeded automatically on first access. POST /api/reset restores the
// exact seed state, which is what the TenantFence verification loop
// relies on before every run.
//
// NOTE: this is a test target for a security-verification tool. The
// credentials and "secrets" below are fixtures, not real data.

export interface Tenant {
  tenantId: string;
  name: string;
  email: string;
  password: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  client: string;
  amount: string;
  status: string;
  secretNote: string;
}

export interface Store {
  tenants: Tenant[];
  invoices: Invoice[];
}

function seed(): Store {
  return {
    tenants: [
      {
        tenantId: "tenant-alpha",
        name: "Tenant Alpha",
        email: "finance@alpha.test",
        password: "AlphaPass123!",
      },
      {
        tenantId: "tenant-beta",
        name: "Tenant Beta",
        email: "finance@beta.test",
        password: "BetaPass123!",
      },
    ],
    invoices: [
      {
        id: "INV-1001",
        tenantId: "tenant-alpha",
        client: "Acme Global Corp",
        amount: "$15,000",
        status: "outstanding",
        secretNote: "CONFIDENTIAL-ALPHA-9921",
      },
      {
        id: "INV-2001",
        tenantId: "tenant-beta",
        client: "Stark Logistics",
        amount: "$8,000",
        status: "outstanding",
        secretNote: "CONFIDENTIAL-BETA-4410",
      },
    ],
  };
}

const globalRef = globalThis as unknown as { __tenantfenceStore?: Store };

export function getStore(): Store {
  if (!globalRef.__tenantfenceStore) {
    globalRef.__tenantfenceStore = seed();
  }
  return globalRef.__tenantfenceStore;
}

export function resetStore(): Store {
  globalRef.__tenantfenceStore = seed();
  return globalRef.__tenantfenceStore;
}

export function findTenantByEmail(email: string): Tenant | undefined {
  return getStore().tenants.find((t) => t.email === email);
}

export function findTenantById(tenantId: string): Tenant | undefined {
  return getStore().tenants.find((t) => t.tenantId === tenantId);
}

export function findInvoiceById(id: string): Invoice | undefined {
  return getStore().invoices.find((inv) => inv.id === id);
}

export function invoicesForTenant(tenantId: string): Invoice[] {
  return getStore().invoices.filter((inv) => inv.tenantId === tenantId);
}
