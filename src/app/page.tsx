export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Header du dashboard */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Dashboard</p>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Hello, Barbara 👋
          </h2>
          <p className="text-sm text-muted-foreground">
            Voici ce qui se passe dans ta boutique PlayNovus ce mois-ci.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sélecteur de période */}
          <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium shadow-sm border border-border">
            <span>Ce mois-ci</span>
            <span className="text-xs opacity-70">▼</span>
          </button>

          {/* Petit bouton calendrier */}
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-border text-sm">
            📅
          </button>
        </div>
      </div>

      {/* Ligne de 4 KPI cards (Total revenue, orders, visitors, net profit) */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Total revenue – carte principale bleu/violet */}
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-5 shadow-[0_18px_45px_rgba(79,70,229,0.45)]">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-80">
                Total revenue
              </p>
              <p className="text-2xl font-semibold">$ 99.560</p>
              <p className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <span className="text-emerald-300">▲ 2.6%</span>
                <span className="opacity-80">vs dernier mois</span>
              </p>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg">
              ↗
            </button>
          </div>
        </div>

        {/* Total orders */}
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-[#e4e7f5]">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Total orders
              </p>
              <p className="text-2xl font-semibold">35</p>
              <p className="flex items-center gap-1 text-xs text-red-500">
                <span>▼ 2.6%</span>
                <span className="text-muted-foreground">vs dernier mois</span>
              </p>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs">
              ↗
            </button>
          </div>
        </div>

        {/* Total visitors */}
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-[#e4e7f5]">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Total visitors
              </p>
              <p className="text-2xl font-semibold">45.600</p>
              <p className="flex items-center gap-1 text-xs text-red-500">
                <span>▼ 1.8%</span>
                <span className="text-muted-foreground">vs dernier mois</span>
              </p>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs">
              ↗
            </button>
          </div>
        </div>

        {/* Net profit */}
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-[#e4e7f5]">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Net profit
              </p>
              <p className="text-2xl font-semibold">$ 60.450</p>
              <p className="flex items-center gap-1 text-xs text-emerald-500">
                <span>▲ 5.6%</span>
                <span className="text-muted-foreground">vs dernier mois</span>
              </p>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs">
              ↗
            </button>
          </div>
        </div>
      </div>

      {/* Bloc du milieu : graph revenu + donut catégories (placeholders pour l’instant) */}
      <div className="grid gap-4 lg:grid-cols-[2fr,1.1fr]">
        {/* Graph revenu (bar chart stylisé en faux) */}
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-[#e4e7f5] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Revenue</p>
              <p className="text-xs text-muted-foreground">
                Ce mois vs mois dernier
              </p>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs">
              ↗
            </button>
          </div>

          {/* Faux graph barres */}
          <div className="flex flex-1 items-end gap-2 pt-4">
            {[40, 65, 50, 80, 90, 70, 60].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-[#e5e7ff]"
                style={{ height: `${h}%` }}
              >
                <div className="h-full w-full rounded-full bg-primary" />
              </div>
            ))}
          </div>

          <div className="flex justify-between text-[10px] text-muted-foreground pt-2">
            <span>1 AUG</span>
            <span>2 AUG</span>
            <span>3 AUG</span>
            <span>4 AUG</span>
            <span>5 AUG</span>
            <span>6 AUG</span>
            <span>7 AUG</span>
          </div>
        </div>

        {/* Donut categories (placeholder) */}
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-[#e4e7f5] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Sales by Category</p>
              <p className="text-xs text-muted-foreground">
                Ce mois vs dernier mois
              </p>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs">
              ↗
            </button>
          </div>

          <div className="flex flex-1 items-center gap-4">
            {/* Faux donut */}
            <div className="relative h-32 w-32">
              <div className="absolute inset-0 rounded-full bg-linear-to-tr from-primary via-[#f97316] to-[#22c55e]" />
              <div className="absolute inset-4 rounded-full bg-white" />
            </div>

            {/* Légende */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span>Châteaux & chevaliers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#f97316]" />
                <span>City & pompiers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                <span>Licornes & princesses</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#0ea5e9]" />
                <span>Autres thèmes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bas du dashboard : 2 grandes cartes (Orders / Customers) */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-[#e4e7f5] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-4xl font-semibold">98</p>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs">
              ↗
            </button>
          </div>
          <p className="text-sm font-medium">orders</p>
          <p className="text-xs text-muted-foreground">
            12 commandes sont en attente de confirmation.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm border border-[#e4e7f5] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-4xl font-semibold">17</p>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs">
              ↗
            </button>
          </div>
          <p className="text-sm font-medium">customers</p>
          <p className="text-xs text-muted-foreground">
            17 clients sont en attente de réponse.
          </p>
        </div>
      </div>
    </div>
  );
}
