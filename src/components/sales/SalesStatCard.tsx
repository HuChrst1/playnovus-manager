// src/components/sales/SalesStatCard.tsx

import { KpiCard, type KpiCardColor } from "@/components/ui/kpi-card";

export type SalesStatCardColor = KpiCardColor;

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
  return <KpiCard title={title} mainValue={mainValue} subtitle={subtitle} color={color} />;
}
