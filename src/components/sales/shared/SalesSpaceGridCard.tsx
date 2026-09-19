'use client';

/**
 * SalesSpaceGridCard — η κάρτα ενός ΧΩΡΟΥ (θέση · αποθήκη) στις σελίδες «διαθέσιμα» των πωλήσεων
 *
 * `SalesGridCard` + η **διάθεση** από τον ΕΝΑ αναγνώστη (`useSpaceCommercialStatusView`, ADR-777
 * §8.60.20 — ως τότε διάβαζε το παλιό ανάμεικτο `status`) + η **τιμή με μονάδα**
 * (`salesCardPricing`, §8.60.14.14). Ήταν γραμμένο δύο φορές (μία ανά σελίδα)· κάθε σελίδα δίνει
 * πλέον μόνο εικονίδιο, τίτλο και περιγραφή.
 *
 * @module components/sales/shared/SalesSpaceGridCard
 */

import type { LucideIcon } from 'lucide-react';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpaceCommercialStatusView } from '@/components/shared/unit-status/useSpaceCommercialStatusView';
import type { SpaceStatusSource } from '@/lib/spaces/space-status-split';
import type { PricedPropertyLike } from '@/lib/properties/price-resolver';
import { SalesGridCard } from './SalesGridCard';
import { salesCardPricing } from './sales-space-page';

export interface SalesSpaceGridCardProps {
  readonly item: SpaceStatusSource & PricedPropertyLike & { readonly id: string; readonly area?: number | null };
  readonly icon: LucideIcon;
  readonly title: string;
  /** Ήδη μεταφρασμένη (τύπος · ζώνη · εμβαδόν). */
  readonly description: string;
  readonly onClick: (id: string) => void;
}

export function SalesSpaceGridCard({ item, icon, title, description, onClick }: SalesSpaceGridCardProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const statusViewOf = useSpaceCommercialStatusView();
  return (
    <SalesGridCard
      id={item.id}
      icon={icon}
      title={title}
      {...statusViewOf(item)}
      description={description}
      {...salesCardPricing(item, t)}
      onClick={onClick}
    />
  );
}
