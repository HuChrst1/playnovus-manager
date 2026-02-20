export const REPORT_TARGET_SCOPES = [
  "GLOBAL",
  "HOME",
  "APPROVISIONNEMENT",
  "VENTES",
  "STOCK",
  "CATALOGUE",
  "HISTORIQUE_STOCK",
] as const;

export type ReportTargetScope = (typeof REPORT_TARGET_SCOPES)[number];

export const REPORT_TARGET_SCOPE_LABELS: Record<ReportTargetScope, string> = {
  GLOBAL: "Global",
  HOME: "Accueil",
  APPROVISIONNEMENT: "Approvisionnement",
  VENTES: "Ventes",
  STOCK: "Stock",
  CATALOGUE: "Catalogue",
  HISTORIQUE_STOCK: "Historique stock",
};

export const REPORT_CATEGORIES = ["BUG", "FEATURE", "IMPROVEMENT"] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  BUG: "Bug",
  FEATURE: "Fonctionnalite",
  IMPROVEMENT: "Amelioration",
};

export const REPORT_STATUSES = ["OPEN", "RESOLVED", "IGNORED"] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: "Ouvert",
  RESOLVED: "Regle",
  IGNORED: "Ignore",
};

export const REPORT_CLOSED_STATUSES = ["RESOLVED", "IGNORED"] as const;
export type ReportClosedStatus = (typeof REPORT_CLOSED_STATUSES)[number];

export function isReportTargetScope(value: unknown): value is ReportTargetScope {
  return typeof value === "string" && REPORT_TARGET_SCOPES.includes(value as ReportTargetScope);
}

export function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === "string" && REPORT_CATEGORIES.includes(value as ReportCategory);
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === "string" && REPORT_STATUSES.includes(value as ReportStatus);
}

export function isReportClosedStatus(value: unknown): value is ReportClosedStatus {
  return typeof value === "string" && REPORT_CLOSED_STATUSES.includes(value as ReportClosedStatus);
}
