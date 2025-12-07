import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClickableRow } from "./ClickableRow";
import { AddSetDialog } from "./AddSetDialog";
import { createSet, deleteSet } from "./actions";
import { DeleteSetButton } from "./DeleteSetButton";

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
};

type CatalogueSearchParams = {
  page?: string;
  q?: string;
  prod?: string;
  sort?: string;
  dir?: string; // "asc" | "desc"
  theme?: string;
  [key: string]: string | undefined;
};

type CataloguePageProps = {
  searchParams?: Promise<CatalogueSearchParams>;
};

// --------- Page ---------
export default async function CataloguePage({
  searchParams,
}: CataloguePageProps) {
  const pageSize = 50;

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pageParam = resolvedSearchParams.page;
  const searchQuery = (resolvedSearchParams.q ?? "").toString().trim();
  const productionFilter = (resolvedSearchParams.prod ?? "")
    .toString()
    .trim();
  const themeFilter = (resolvedSearchParams.theme ?? "").toString().trim();

  // Tri – colonne + direction
  let sort = (resolvedSearchParams.sort ?? "display_ref").toString();
  let dir = (resolvedSearchParams.dir ?? "asc").toString().toLowerCase();

  const ALLOWED_SORT_COLUMNS = [
    "display_ref",
    "name",
    "version",
    "year_start",
    "year_end",
    "theme",
  ] as const;

  if (!(ALLOWED_SORT_COLUMNS as readonly string[]).includes(sort)) {
    sort = "display_ref";
  }
  if (dir !== "asc" && dir !== "desc") {
    dir = "asc";
  }

  const currentPage = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;

  // Versions sélectionnées (multi-checkbox)
  const selectedVersions: string[] = [];
  for (const v of VERSION_FILTERS) {
    if (resolvedSearchParams[v.key] === "1") {
      selectedVersions.push(v.value);
    }
  }

  // Années de début sélectionnées (multi-checkbox)
  const selectedYears: number[] = [];
  for (const year of YEAR_OPTIONS) {
    const key = `year_${year}`;
    if (resolvedSearchParams[key] === "1") {
      selectedYears.push(year);
    }
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("sets_catalog")
    .select(
      "id, display_ref, name, version, year_start, year_end, theme, image_url",
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

  if (themeFilter) {
    query = query.ilike("theme", `%${themeFilter}%`);
  }

  const { data, error, count } = await query
    .order(sort, { ascending: dir === "asc" })
    .range(from, to);

  const sets = (data ?? []) as SetRow[];
  const totalCount = count ?? sets.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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
  if (themeFilter) baseParams.set("theme", themeFilter);
  baseParams.set("sort", sort);
  baseParams.set("dir", dir);

  for (const v of VERSION_FILTERS) {
    if (resolvedSearchParams[v.key] === "1") {
      baseParams.set(v.key, "1");
    }
  }
  for (const year of YEAR_OPTIONS) {
    const key = `year_${year}`;
    if (resolvedSearchParams[key] === "1") {
      baseParams.set(key, "1");
    }
  }

  const makePageHref = (page: number) => {
    const params = new URLSearchParams(baseParams.toString());
    params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/catalogue?${qs}` : "/catalogue";
  };

  const makeSortHref = (column: string) => {
    const params = new URLSearchParams(baseParams.toString());
    params.set("page", "1");

    if (sort === column) {
      const nextDir = dir === "asc" ? "desc" : "asc";
      params.set("sort", column);
      params.set("dir", nextDir);
    } else {
      params.set("sort", column);
      params.set("dir", "asc");
    }

    const qs = params.toString();
    return qs ? `/catalogue?${qs}` : "/catalogue";
  };

  const renderSortableHeader = (label: string, column: string) => {
    const isActive = sort === column;
    const isAsc = dir === "asc";

    return (
      <th key={column} className="px-4 py-3 text-left font-medium">
        <Link
          href={makeSortHref(column)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-primary",
            isActive && "text-primary"
          )}
        >
          <span>{label}</span>
          <span className="text-[10px]">
            {isActive ? (isAsc ? "▲" : "▼") : "⇅"}
          </span>
        </Link>
      </th>
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

  // --------- RENDER PRINCIPAL (un seul return) ---------
  return (
    <main className="p-4 lg:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* Bandeau titre + recherche */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Catalogue PlayNovus
            </h1>
            <p className="text-sm text-muted-foreground">
              Liste des sets présents dans la base.
            </p>
          </div>

          {/* Recherche + actions principales */}
          <div className="flex w-full items-center justify-end gap-2">
            {/* FORMULAIRE DE RECHERCHE (GET) */}
            <form
              method="GET"
              className="flex w-full max-w-xs items-center gap-2"
            >
              <Input
                type="text"
                name="q"
                placeholder="Rechercher par nom ou SetID..."
                defaultValue={searchQuery}
                className="h-9 w-full"
              />
              <input type="hidden" name="page" value="1" />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="dir" value={dir} />

              {productionFilter && (
                <input type="hidden" name="prod" value={productionFilter} />
              )}
              {themeFilter && (
                <input type="hidden" name="theme" value={themeFilter} />
              )}
              {VERSION_FILTERS.map((v) =>
                resolvedSearchParams[v.key] === "1" ? (
                  <input
                    key={`hidden-${v.key}`}
                    type="hidden"
                    name={v.key}
                    value="1"
                  />
                ) : null
              )}
              {YEAR_OPTIONS.map((year) => {
                const key = `year_${year}`;
                return resolvedSearchParams[key] === "1" ? (
                  <input
                    key={`hidden-${key}`}
                    type="hidden"
                    name={key}
                    value="1"
                  />
                ) : null;
              })}

              <Button type="submit" variant="outline" size="sm">
                Rechercher
              </Button>
            </form>

            {/* Dialog d’ajout de set */}
            <AddSetDialog createSetAction={createSet} />

            {/* Bouton Filtres */}
            <label
              htmlFor="filters-toggle"
              className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs text-muted-foreground shadow-sm hover:bg-muted cursor-pointer"
            >
              Filtres
            </label>
          </div>
        </div>

        {/* Layout : tableau + panneau filtres */}
        <div className="flex gap-4 items-start justify-between">
          {/* Colonne tableau */}
          <div className="flex-1">
            <div className="app-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Photo</th>
                      {renderSortableHeader("SetID", "display_ref")}
                      {renderSortableHeader("Nom du set", "name")}
                      {renderSortableHeader("Version", "version")}
                      {renderSortableHeader("Début prod.", "year_start")}
                      {renderSortableHeader("Fin prod.", "year_end")}
                      {renderSortableHeader("Thème", "theme")}
                      <th className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets && sets.length > 0 ? (
                      sets.map((set) => (
                        <ClickableRow
                          key={set.id}
                          href={`/catalogue/${encodeURIComponent(set.id)}`}
                        >
                          {/* Photo */}
                          <td className="px-4 py-3 group-hover:bg-[#e0f2fe] transition-colors">
                            {set.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={set.image_url}
                                alt={set.name}
                                className="h-10 w-10 rounded-md object-cover bg-muted"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                                N/A
                              </div>
                            )}
                          </td>

                          {/* SetID */}
                          <td className="px-4 py-3 font-mono text-xs group-hover:bg-[#e0f2fe] transition-colors">
                            {set.display_ref}
                          </td>

                          {/* Nom */}
                          <td className="px-4 py-3 group-hover:bg-[#e0f2fe] transition-colors">
                            <span className="font-medium">{set.name}</span>
                          </td>

                          {/* Version */}
                          <td className="px-4 py-3 group-hover:bg-[#e0f2fe] transition-colors">
                            {set.version && set.version !== "Version Unique"
                              ? set.version
                              : "Unique"}
                          </td>

                          {/* Début / fin de production */}
                          <td className="px-4 py-3 group-hover:bg-[#e0f2fe] transition-colors">
                            {set.year_start ?? "N/A"}
                          </td>
                          <td className="px-4 py-3 group-hover:bg-[#e0f2fe] transition-colors">
                            {set.year_end ?? "N/A"}
                          </td>

                          {/* Thème */}
                          <td className="px-4 py-3 group-hover:bg-[#e0f2fe] transition-colors">
                            {set.theme ?? "-"}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right group-hover:bg-[#e0f2fe] transition-colors">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                data-row-action="true"
                                href={`/catalogue/${encodeURIComponent(
                                  set.id
                                )}`}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                Voir la fiche
                              </Link>

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
                      <tr className="border-t border-border">
                        <td
                          colSpan={8}
                          className="px-4 py-6 text-center text-sm text-muted-foreground"
                        >
                          Aucun set trouvé.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    Affichage {from + 1}–{Math.min(to + 1, totalCount)} sur{" "}
                    {totalCount} sets
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-full bg-background px-2 py-1 shadow-sm">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        disabled={currentPage === 1}
                        className="h-7 w-7 rounded-full"
                      >
                        <Link href={makePageHref(currentPage - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Link>
                      </Button>

                      {pageNumbers.map((item, index) =>
                        item === "dots" ? (
                          <span
                            key={`dots-${index}`}
                            className="h-7 px-2 flex items-center justify-center text-xs text-muted-foreground"
                          >
                            …
                          </span>
                        ) : (
                          <Link
                            key={item}
                            href={makePageHref(item)}
                            className={cn(
                              "h-7 w-7 flex items-center justify-center rounded-full text-xs transition-colors",
                              item === currentPage
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-muted/80"
                            )}
                          >
                            {item}
                          </Link>
                        )
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        disabled={currentPage === totalPages}
                        className="h-7 w-7 rounded-full"
                      >
                        <Link href={makePageHref(currentPage + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Toggle caché qui contrôle l’aside (frère direct) */}
          <input
            id="filters-toggle"
            type="checkbox"
            className="peer sr-only"
            aria-hidden="true"
          />

          {/* Panneau filtres : formulaire GET séparé */}
          <aside className="hidden w-[260px] shrink-0 peer-checked:block">
            <form method="GET" className="app-card text-xs sticky top-24">
              {/* on garde tri + recherche quand on applique les filtres */}
              <input type="hidden" name="page" value="1" />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="dir" value={dir} />
              {searchQuery && (
                <input type="hidden" name="q" value={searchQuery} />
              )}

              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Filtres
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    asChild
                  >
                    <Link href="/catalogue">Réinitialiser</Link>
                  </Button>

                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                  >
                    Appliquer
                  </Button>
                </div>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 pb-2">
                {/* Versions */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Versions
                  </p>
                  <div className="grid grid-cols-[repeat(4,max-content)] gap-x-2 gap-y-2">
                    {VERSION_FILTERS.map((v) => {
                      const isChecked = resolvedSearchParams[v.key] === "1";

                      return (
                        <label
                          key={`${v.key}-${isChecked ? "1" : "0"}`}
                          className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] whitespace-nowrap"
                        >
                          <input
                            type="checkbox"
                            name={v.key}
                            value="1"
                            defaultChecked={isChecked}
                            className="h-3 w-3"
                          />
                          <span>{v.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Début de production */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Début de production
                  </p>
                  <div className="grid grid-cols-[repeat(4,max-content)] gap-x-2 gap-y-2 max-h-48 overflow-y-auto">
                    {YEAR_OPTIONS.map((year) => {
                      const paramKey = `year_${year}`;
                      const isChecked =
                        resolvedSearchParams[paramKey] === "1";

                      return (
                        <label
                          key={`${paramKey}-${isChecked ? "1" : "0"}`}
                          className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] whitespace-nowrap"
                        >
                          <input
                            type="checkbox"
                            name={paramKey}
                            value="1"
                            defaultChecked={isChecked}
                            className="h-3 w-3"
                          />
                          <span>{year}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Période de production */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Période de production
                  </p>
                  <select
                    name="prod"
                    defaultValue={productionFilter || ""}
                    className="h-8 w-full rounded-full border border-border bg-background px-3 text-[11px] text-muted-foreground"
                  >
                    <option value="">Toutes périodes</option>
                    <option value="active">En production</option>
                    <option value="ended">Production terminée</option>
                  </select>
                </div>

                {/* Thème */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Thème
                  </p>
                  <Input
                    key={themeFilter || "theme-empty"}
                    type="text"
                    name="theme"
                    placeholder="Rechercher par thème..."
                    defaultValue={themeFilter}
                    className="h-8 w-full rounded-full border border-border bg-background px-3 text-[11px]"
                  />
                </div>
              </div>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}
