// src/components/sales/SalesStatCard.tsx

export type SalesStatCardColor = "indigo" | "orange" | "amber" | "emerald";

const headerBgByColor: Record<SalesStatCardColor, string> = {
  indigo: "#4E56C0",
  orange: "#9B5DE0",
  amber: "#D78FEE",
  emerald: "#FDCFFA",
};

export type SalesStatCardProps = {
  /**
   * Titre de la métrique, ex: "CA net (ventes confirmées)"
   */
  title: string;

  /**
   * Valeur principale déjà formatée, ex: "1 234,50 €"
   */
  mainValue: string;

  /**
   * Texte secondaire en petit à droite (optionnel),
   * ex: "2 ventes confirmées"
   */
  subtitle?: string;

  /**
   * Couleur de la bande en haut de la card.
   * Les couleurs correspondent à celles utilisées pour les cards Appro.
   */
  color: SalesStatCardColor;
};

export function SalesStatCard({
  title,
  mainValue,
  subtitle,
  color,
}: SalesStatCardProps) {
  const headerBgHex = headerBgByColor[color];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
      {/* Bandeau coloré avec le titre (même style qu'Appro) */}
      <div
        className="h-12 w-full flex items-center px-5 rounded-t-3xl"
        style={{ backgroundColor: headerBgHex }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
          {title}
        </p>
      </div>

      {/* Contenu de la card */}
      <div className="px-5 pb-4 pt-3 bg-white rounded-b-3xl">
        <div className="flex items-end justify-between gap-2">
          <span className="text-3xl font-semibold text-slate-900 leading-none">
            {mainValue}
          </span>

          {subtitle && (
            <span className="text-[11px] text-slate-500 text-right">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}