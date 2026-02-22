import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClickableRow } from "./ClickableRow";
import { AddSetDialog } from "./AddSetDialog";
import { createSet, deleteSet } from "./actions";
import { DeleteSetButton } from "./DeleteSetButton";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  SortableTableHeader,
  TableCard,
  TableOverflow,
  TablePagination,
} from "@/components/ui/data-table";

export const dynamic = "force-dynamic";

// --------- Config filtres ---------
const VERSION_FILTERS = [
  { key: "ver_unique", label: "Unique", value: "Version Unique" },
  { key: "ver_v1", label: "V1", value: "V1" },
  { key: "ver_v2", label: "V2", value: "V2" },
  { key: "ver_v3", label: "V3", value: "V3" },
  { key: "ver_v4", label: "V4", value: "V4" },
  { key: "ver_v5", label: "V5", value: "V5" },
  { key: "ver_v6", label: "V6", value: "V6" },
  { key: "ver_v7", label: "V7", value: "V7" },
  { key: "ver_v8", label: "V8", value: "V8" },
  { key: "ver_v9", label: "V9", value: "V9" },
  { key: "ver_v10", label: "V10", value: "V10" },
  { key: "ver_v11", label: "V11", value: "V11" },
  { key: "ver_v12", label: "V12", value: "V12" },
  { key: "ver_v13", label: "V13", value: "V13" },
  { key: "ver_v14", label: "V14", value: "V14" },
];

const YEAR_START_MIN = 1974;
const YEAR_START_MAX = 2025;
const YEAR_OPTIONS = Array.from(
  { length: YEAR_START_MAX - YEAR_START_MIN + 1 },
  (_, i) => YEAR_START_MIN + i
);

// ---------- Types complétion ----------
type CompletionStatus = "none" | "low" | "medium" | "high" | "full";

// --------- Types ---------
type SetRow = {
  id: string;
  display_ref: string;
  name: string;
  version: string | null;
  year_start: number | null;
  year_end: number | null;
  theme: string | null;
  image_url: string | null;
  nb_pieces: number | null;

  // champs venant de la vue SQL set_with_completion
  total_parts_needed: number | null;
  total_parts_owned: number | null;
  completion_percent: number | null;
  max_complete_sets: number | null;

  // champ dérivé pour l’UI (couleur de pastille)
  completion_status?: CompletionStatus;
};

type CatalogueSearchParams = {
  page?: string | string[];
  q?: string | string[];
  prod?: string | string[];
  sort?: string | string[];
  dir?: string | string[]; // "asc" | "desc"
  theme?: string | string[];
  theme_mode?: string | string[];
  [key: string]: string | string[] | undefined;
};

type CataloguePageProps = {
  searchParams?: Promise<CatalogueSearchParams>;
};

type SortColumn =
  | "display_ref"
  | "name"
  | "version"
  | "year_start"
  | "year_end"
  | "theme"
  | "completion_percent";

const DEFAULT_SORT_KEY = "completion";
const DEFAULT_DIR = "desc";

function getFirstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function isEnabledFlag(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.includes("1");
  return value === "1";
}

// --------- Page ---------
export default async function CataloguePage({
  searchParams,
}: CataloguePageProps) {
  const pageSize = 50;

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pageParam = getFirstParam(resolvedSearchParams.page);
  const searchQuery = getFirstParam(resolvedSearchParams.q).toString().trim();
  const productionFilter = getFirstParam(resolvedSearchParams.prod).toString().trim();

  const rawThemeParam = resolvedSearchParams.theme;
  const rawThemeModeParam = getFirstParam(resolvedSearchParams.theme_mode).toString().trim();
  const isThemeMultiMode = rawThemeModeParam === "multi" || Array.isArray(rawThemeParam);

  const themeParamValues = (
    Array.isArray(rawThemeParam)
      ? rawThemeParam
      : rawThemeParam
      ? [rawThemeParam]
      : []
  )
    .map((theme) => theme.toString().trim())
    .filter((theme) => theme.length > 0);

  // --------- Gestion du tri ---------
  const sortParamRaw = getFirstParam(resolvedSearchParams.sort).toString() || DEFAULT_SORT_KEY;
  let dir = (getFirstParam(resolvedSearchParams.dir).toString() || DEFAULT_DIR).toLowerCase();
  if (dir !== "asc" && dir !== "desc") dir = DEFAULT_DIR;

  const ALLOWED_SORT_COLUMNS: SortColumn[] = [
    "display_ref",
    "name",
    "version",
    "year_start",
    "year_end",
    "theme",
    "completion_percent",
  ];

  let dbSortColumn: SortColumn = "completion_percent"; // colonne utilisée par Supabase
  let activeSortKey = sortParamRaw; // clé visible dans l'UI (& dans l'URL)

  if (sortParamRaw === "completion") {
    // on mappe la clé "completion" de l'UI sur la colonne SQL "completion_percent"
    dbSortColumn = "completion_percent";
    activeSortKey = "completion";
  } else if (
    (ALLOWED_SORT_COLUMNS as readonly string[]).includes(
      sortParamRaw as SortColumn
    )
  ) {
    dbSortColumn = sortParamRaw as SortColumn;
  } else {
    activeSortKey = DEFAULT_SORT_KEY;
    dbSortColumn = "completion_percent";
  }

  const currentPage = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;

  // Versions sélectionnées (multi-checkbox)
  const selectedVersions: string[] = [];
  for (const v of VERSION_FILTERS) {
    if (isEnabledFlag(resolvedSearchParams[v.key])) {
      selectedVersions.push(v.value);
    }
  }

  // Années de début sélectionnées (multi-checkbox)
  const selectedYears: number[] = [];
  for (const year of YEAR_OPTIONS) {
    const key = `year_${year}`;
    if (isEnabledFlag(resolvedSearchParams[key])) {
      selectedYears.push(year);
    }
  }

  const { data: themesData } = await supabase
    .from("sets_catalog")
    .select("theme")
    .not("theme", "is", null)
    .order("theme", { ascending: true });

  const themeOptions = Array.from(
    new Set(
      (themesData ?? [])
        .map((row) => row.theme?.toString().trim())
        .filter((theme): theme is string => Boolean(theme))
    )
  );
  const themeOptionsSet = new Set(themeOptions);
  const selectedThemes = themeParamValues.filter((theme) => themeOptionsSet.has(theme));
  const legacyThemeFilter =
    !isThemeMultiMode && themeParamValues.length > 0 ? themeParamValues[0] : "";

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  // --------- Requête set_with_completion (vue SQL) ---------
  let query = supabase
    .from("set_with_completion")
    .select(
      "id, display_ref, name, version, year_start, year_end, theme, image_url, total_parts_needed, total_parts_owned, completion_percent, max_complete_sets",
      { count: "exact" }
    );

  if (searchQuery) {
  query = query.or(
    `display_ref.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`
  );
  }

  if (selectedVersions.length > 0) {
  query = query.in("version", selectedVersions);
  }

  if (selectedYears.length > 0) {
  query = query.in("year_start", selectedYears);
  }

  if (productionFilter === "active") {
  query = query.is("year_end", null);
  } else if (productionFilter === "ended") {
  query = query.not("year_end", "is", null);
  }

  if (themeParamValues.length > 0) {
    if (isThemeMultiMode) {
      const canUseExactThemeFilter =
        selectedThemes.length > 0 && selectedThemes.length === themeParamValues.length;

      if (canUseExactThemeFilter) {
        query = query.in("theme", selectedThemes);
      } else {
        query = query.ilike("theme", `%${themeParamValues[0]}%`);
      }
    } else if (legacyThemeFilter) {
      query = query.ilike("theme", `%${legacyThemeFilter}%`);
    }
  }

  let data: SetRow[] | null = null;
  let error: PostgrestError | null = null;
  let count: number | null = null;

  // Tri + pagination 100% côté SQL (y compris sur la complétion)
  const resp = await query
  .order(dbSortColumn, {
    ascending: dir === "asc",
    // Ascendant : les NULL (sets sans BOM) d'abord
    // Descendant : les NULL en bas, on voit les sets complétés en haut
    nullsFirst: dir === "asc",
  })
  .range(from, to);

  data = (resp.data ?? []) as SetRow[];
  error = resp.error;
  count = resp.count ?? data.length;

  const sets = data ?? [];
  const totalCount = count ?? sets.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // --------- Complétion : mapping simple statut/couleur ---------
  const setsWithCompletion: SetRow[] = sets.map((set) => {
  const percent =
    typeof set.completion_percent === "number"
      ? set.completion_percent
      : null;

  let status: CompletionStatus = "none";

  if (percent === null) {
    status = "none";
  } else if (percent >= 100) {
    status = "full";
  } else if (percent >= 80) {
    status = "high";
  } else if (percent >= 50) {
    status = "medium";
  } else {
    status = "low";
  }

  return {
    ...set,
    completion_percent: percent,
    completion_status: status,
  };
  });

// Plus de tri en mémoire : tout est déjà ordonné par SQL
const setsForDisplay: SetRow[] = setsWithCompletion;

  // Pages à afficher dans la pagination (compacte, avec "…")
  let pageNumbers: (number | "dots")[] = [];

  if (totalPages <= 7) {
    pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    const siblings = 1;

    const startPage = Math.max(2, currentPage - siblings);
    const endPage = Math.min(totalPages - 1, currentPage + siblings);

    pageNumbers = [1];

    if (startPage > 2) {
      pageNumbers.push("dots");
    }

    for (let page = startPage; page <= endPage; page++) {
      pageNumbers.push(page);
    }

    if (endPage < totalPages - 1) {
      pageNumbers.push("dots");
    }

    pageNumbers.push(totalPages);
  }

  // Garder les filtres dans la pagination
  const baseParams = new URLSearchParams();
  if (searchQuery) baseParams.set("q", searchQuery);
  if (productionFilter) baseParams.set("prod", productionFilter);
  if (isThemeMultiMode) {
    baseParams.set("theme_mode", "multi");
    for (const theme of selectedThemes) {
      baseParams.append("theme", theme);
    }
  } else if (legacyThemeFilter) {
    baseParams.set("theme", legacyThemeFilter);
  }
  baseParams.set("sort", activeSortKey);
  baseParams.set("dir", dir);

  for (const v of VERSION_FILTERS) {
    if (isEnabledFlag(resolvedSearchParams[v.key])) {
      baseParams.set(v.key, "1");
    }
  }
  for (const year of YEAR_OPTIONS) {
    const key = `year_${year}`;
    if (isEnabledFlag(resolvedSearchParams[key])) {
      baseParams.set(key, "1");
    }
  }

  const makePageHref = (page: number) => {
    const params = new URLSearchParams(baseParams.toString());
    params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/catalogue?${qs}` : "/catalogue";
  };

  const makeSortHref = (columnKey: string) => {
    const params = new URLSearchParams(baseParams.toString());
    params.set("page", "1");

    if (activeSortKey === columnKey) {
      const nextDir = dir === "asc" ? "desc" : "asc";
      params.set("sort", columnKey);
      params.set("dir", nextDir);
    } else {
      params.set("sort", columnKey);
      params.set("dir", "asc");
    }

    const qs = params.toString();
    return qs ? `/catalogue?${qs}` : "/catalogue";
  };

  // Pastille de complétion (fond coloré + texte centré)
  const renderCompletionPill = (set: SetRow) => {
    const raw = typeof set.completion_percent === "number"
      ? Math.round(set.completion_percent)
      : null;

    const percent =
      raw !== null ? Math.min(100, Math.max(0, raw)) : null;

    const status: CompletionStatus = set.completion_status ?? "none";

    let bgClass = "";
    let textClass = "";
    let borderClass = "";

    if (percent === null || status === "none") {
      // Non évalué
      bgClass = "bg-zinc-100";
      textClass = "text-zinc-500";
      borderClass = "border-zinc-200";
    } else if (percent === 100 || status === "full") {
      // 100% : vert fort
      bgClass = "bg-emerald-100";
      textClass = "text-emerald-800";
      borderClass = "border-emerald-200";
    } else if (percent >= 80 || status === "high") {
      // >= 80% : vert léger
      bgClass = "bg-emerald-50";
      textClass = "text-emerald-700";
      borderClass = "border-emerald-200/80";
    } else if (percent >= 50 || status === "medium") {
      // 50–79% : bleu ciel
      bgClass = "bg-sky-50";
      textClass = "text-sky-700";
      borderClass = "border-sky-200";
    } else {
      // 0–49% : rouge
      bgClass = "bg-red-50";
      textClass = "text-red-700";
      borderClass = "border-red-200";
    }

    const label = percent === null ? "–" : `${percent}%`;

    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full px-3 h-7 text-xs font-semibold min-w-14 border",
          bgClass,
          textClass,
          borderClass
        )}
      >
        {label}
      </span>
    );
  };

  // Petit badge "×N" pour le nombre d'exemplaires complets possibles
  const renderMaxCompleteBadge = (set: SetRow) => {
    const raw = set.max_complete_sets;
    const n =
      typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 0;

    // On n'affiche rien si aucun exemplaire complet possible
    if (n <= 0) return null;

    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full px-2 h-6 text-[11px] font-medium",
          "border border-slate-200 bg-slate-50 text-slate-700"
        )}
      >
        ×{n}
      </span>
    );
  };

  if (error) {
    return (
      <main className="p-6 lg:p-8">
        <div className="app-card p-6">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Catalogue PlayNovus
          </h1>
          <p className="text-sm text-red-500">
            Erreur lors du chargement du catalogue : {error.message}
          </p>
        </div>
      </main>
    );
  }

  // --------- RENDER PRINCIPAL ---------
  return (
    <main className="space-y-6">
      <header className="px-1 md:px-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 md:text-[42px] md:leading-none">
            Catalogue PlayNovus
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Liste des sets présents dans la base.
          </p>
        </div>
      </header>

      <div className="catalogue-toolbar-shell">
        <form method="GET" className="catalogue-filter-toolbar">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="sort" value={activeSortKey} />
          <input type="hidden" name="dir" value={dir} />
          <input type="hidden" name="theme_mode" value="multi" />
          {searchQuery ? <input type="hidden" name="q" value={searchQuery} /> : null}

          <div className="catalogue-filter-frame">
            <div className="catalogue-filter-cluster">
              <details className="catalogue-filter-dropdown" name="catalogue-filter-group">
                <summary className="catalogue-filter-pill">
                  Version{selectedVersions.length > 0 ? ` (${selectedVersions.length})` : ""}
                </summary>
                <div className="catalogue-filter-drawer catalogue-filter-drawer--version">
                  <div className="catalogue-filter-check-grid">
                    {VERSION_FILTERS.map((versionFilter) => {
                      const isChecked = isEnabledFlag(resolvedSearchParams[versionFilter.key]);
                      return (
                        <label key={versionFilter.key} className="catalogue-filter-check-option">
                          <input
                            type="checkbox"
                            name={versionFilter.key}
                            value="1"
                            defaultChecked={isChecked}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                          <span>{versionFilter.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>

              <details className="catalogue-filter-dropdown" name="catalogue-filter-group">
                <summary className="catalogue-filter-pill">
                  Début prod.{selectedYears.length > 0 ? ` (${selectedYears.length})` : ""}
                </summary>
                <div className="catalogue-filter-drawer catalogue-filter-drawer--years">
                  <div className="catalogue-filter-scroll-grid">
                    {YEAR_OPTIONS.map((year) => {
                      const yearKey = `year_${year}`;
                      const isChecked = isEnabledFlag(resolvedSearchParams[yearKey]);
                      return (
                        <label key={yearKey} className="catalogue-filter-check-option">
                          <input
                            type="checkbox"
                            name={yearKey}
                            value="1"
                            defaultChecked={isChecked}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                          <span>{year}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>

              <details className="catalogue-filter-dropdown" name="catalogue-filter-group">
                <summary className="catalogue-filter-pill">
                  Période{productionFilter ? " (1)" : ""}
                </summary>
                <div className="catalogue-filter-drawer catalogue-filter-drawer--period">
                  <label className="catalogue-filter-field-label" htmlFor="catalogue-prod-filter">
                    Statut de production
                  </label>
                  <select
                    id="catalogue-prod-filter"
                    name="prod"
                    defaultValue={productionFilter}
                    className="app-control h-9 w-full px-3 text-[11px]"
                  >
                    <option value="">Toutes périodes</option>
                    <option value="active">En production</option>
                    <option value="ended">Production terminée</option>
                  </select>
                </div>
              </details>

              <details className="catalogue-filter-dropdown" name="catalogue-filter-group">
                <summary className="catalogue-filter-pill">
                  Thèmes{selectedThemes.length > 0 ? ` (${selectedThemes.length})` : ""}
                </summary>
                <div className="catalogue-filter-drawer catalogue-filter-drawer--themes">
                  {themeOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">Aucun thème disponible.</p>
                  ) : (
                    <div className="catalogue-filter-scroll-grid">
                      {themeOptions.map((theme) => (
                        <label key={theme} className="catalogue-filter-check-option">
                          <input
                            type="checkbox"
                            name="theme"
                            value={theme}
                            defaultChecked={selectedThemes.includes(theme)}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                          <span>{theme}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              <div className="catalogue-filter-actions">
                <Button variant="outline" size="sm" asChild className="h-9 px-4 text-xs font-medium">
                  <Link href="/catalogue">Réinitialiser</Link>
                </Button>
                <Button type="submit" size="sm" className="h-9 px-4 text-xs font-semibold">
                  Appliquer
                </Button>
              </div>
            </div>
          </div>
        </form>

        <div className="catalogue-toolbar-cta">
          <AddSetDialog
            createSetAction={createSet}
            triggerClassName="h-9 gap-2 px-4 text-xs font-medium"
          />
        </div>
      </div>

      <TableCard className="appro-table-shell catalogue-table-shell">

        <TableOverflow className="appro-table-scroll">
          <table className="appro-table min-w-full text-sm">
            <thead className="appro-table-header">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Photo</th>
                <SortableTableHeader
                  label="SetID"
                  columnKey="display_ref"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("display_ref")}
                />
                <SortableTableHeader
                  label="Nom du set"
                  columnKey="name"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("name")}
                />
                <SortableTableHeader
                  label="Version"
                  columnKey="version"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("version")}
                />
                <SortableTableHeader
                  label="Début prod."
                  columnKey="year_start"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("year_start")}
                />
                <SortableTableHeader
                  label="Fin prod."
                  columnKey="year_end"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("year_end")}
                />
                <SortableTableHeader
                  label="Thème"
                  columnKey="theme"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("theme")}
                />
                <SortableTableHeader
                  label="Complétion"
                  columnKey="completion"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("completion")}
                />
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {setsForDisplay.length > 0 ? (
                setsForDisplay.map((set) => (
                  <ClickableRow
                    key={set.id}
                    href={`/catalogue/${encodeURIComponent(set.id)}`}
                    className="appro-table-row cursor-pointer focus-visible:outline-none"
                  >
                    <td className="px-4 py-3">
                      {set.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={set.image_url}
                          alt={set.name}
                          className="h-10 w-10 rounded-md bg-muted object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                          N/A
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs">{set.display_ref}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{set.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      {set.version && set.version !== "Version Unique" ? set.version : "Unique"}
                    </td>
                    <td className="px-4 py-3">{set.year_start ?? "N/A"}</td>
                    <td className="px-4 py-3">{set.year_end ?? "N/A"}</td>
                    <td className="px-4 py-3">{set.theme ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {renderCompletionPill(set)}
                        {renderMaxCompleteBadge(set)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <DeleteSetButton
                          setId={set.id}
                          setName={set.name}
                          deleteSetAction={deleteSet}
                        />
                      </div>
                    </td>
                  </ClickableRow>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                    Aucun set trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableOverflow>

        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageNumbers={pageNumbers}
          summary={
            <>
              Affichage {from + 1}–{Math.min(to + 1, totalCount)} sur {totalCount} sets
            </>
          }
          makePageHref={makePageHref}
        />
      </TableCard>
    </main>
  );
}
