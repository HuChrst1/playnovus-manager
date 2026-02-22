export const DEFAULT_SUPPLIER_OPTIONS = [
  "Particulier",
  "Brocante",
  "DEFI",
  "VINTED",
  "LEBONCOIN",
  "EBAY",
  "PLAYMOBIL (OFFICIEL)",
] as const;

const BLOCKED_SUPPLIER_KEYS = new Set(["fixture remote"]);

export function supplierOptionKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
}

export function isSupplierOptionBlocked(value: string): boolean {
  return BLOCKED_SUPPLIER_KEYS.has(supplierOptionKey(value));
}

export function dedupeSupplierOptions(
  values: readonly (string | null | undefined)[]
): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const rawValue of values) {
    const value = (rawValue ?? "").trim();
    if (!value || isSupplierOptionBlocked(value)) continue;

    const key = supplierOptionKey(value);
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}

export function buildSupplierOptionsFromDb(
  dbValues: readonly (string | null | undefined)[]
): string[] {
  return dedupeSupplierOptions([...DEFAULT_SUPPLIER_OPTIONS, ...dbValues]);
}
