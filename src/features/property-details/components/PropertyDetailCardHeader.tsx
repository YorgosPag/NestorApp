/**
 * **Η κεφαλίδα μιας κάρτας στοιχείων ακινήτου**: εικονίδιο · τίτλος · και, σε πολυεπίπεδο ακίνητο, αν η κάρτα
 * γράφει **ανά όροφο** ή **κοινά** για όλους.
 *
 * Ζούσε γραμμένη έξι φορές σε `PropertyFieldsDetailCards` + `PropertyFieldsDetailCardsRow2` (CHECK 3.28, N.0.2):
 * ίδια δομή, ίδιες κλάσεις, διαφορετικό μόνο εικονίδιο/τίτλος/εμβέλεια.
 *
 * @module features/property-details/components/PropertyDetailCardHeader
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

import { CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { PROPERTY_MICRO_TEXT } from './property-fields-constants';
import type { PropertyFieldsEditFormProps } from './property-fields-form-types';

/** Τι λέει η κάρτα σε πολυεπίπεδο ακίνητο: τιμές **ανά όροφο** ή **κοινές** για όλο το ακίνητο. */
export type PropertyCardScope = 'perFloor' | 'shared';

const SCOPE_HINT_KEY: Record<PropertyCardScope, string> = {
  perFloor: 'multiLevel.perLevel.perFloorHint',
  shared: 'multiLevel.perLevel.sharedHint',
};

export interface PropertyCardIcon {
  readonly icon: LucideIcon;
  /** Κλάση χρώματος από το `PROPERTY_CARD_COLORS`. */
  readonly tone: string;
}

export interface PropertyDetailCardHeaderProps {
  readonly icon: PropertyCardIcon;
  /** Δεύτερο εικονίδιο μετά τον τίτλο (π.χ. κατάσταση + ενεργειακή κλάση). */
  readonly trailingIcon?: PropertyCardIcon;
  readonly title: string;
  readonly scope: PropertyCardScope;
  readonly isMultiLevel: boolean;
  /** Το `t` της φόρμας (ίδιος τύπος με το `property-fields-form-types`). */
  readonly t: TFunction;
}

export function PropertyDetailCardHeader({ icon, trailingIcon, title, scope, isMultiLevel, t }: PropertyDetailCardHeaderProps) {
  const typography = useTypography();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const Lead = icon.icon;
  const Trail = trailingIcon?.icon;
  const hintTone = scope === 'perFloor' ? colors.text.success : colors.text.muted;

  return (
    <CardHeader className="p-2 pb-1">
      <CardTitle className={cn('flex items-center gap-1.5', typography.card.titleCompact)}>
        <Lead className={cn(iconSizes.sm, icon.tone)} />
        {title}
        {Trail && trailingIcon && <Trail className={cn(iconSizes.sm, trailingIcon.tone)} />}
        {isMultiLevel && (
          <span className={cn('ml-auto font-normal', PROPERTY_MICRO_TEXT.micro, hintTone)}>{t(SCOPE_HINT_KEY[scope])}</span>
        )}
      </CardTitle>
    </CardHeader>
  );
}

/**
 * Η σημείωση «υπολογίζεται αυτόματα» πάνω από τα **αθροίσματα** πολυεπίπεδου ακινήτου
 * (όταν δεν έχει επιλεγεί όροφος). Ζούσε γραμμένη τρεις φορές (CHECK 3.28).
 */
export function PropertyAutoComputedNote({ t }: { readonly t: TFunction }) {
  const colors = useSemanticColors();
  return <p className={cn('italic', PROPERTY_MICRO_TEXT.helper, colors.text.muted)}>{t('multiLevel.perLevel.autoComputed')}</p>;
}

type AggregatedTotals = NonNullable<PropertyFieldsEditFormProps['aggregatedTotals']>;

/**
 * Τα αθροίσματα που δείχνει μια κάρτα **μόνο** όταν το ακίνητο είναι πολυεπίπεδο και δεν έχει
 * επιλεγεί όροφος· αλλιώς `null` (η κάρτα δείχνει τα πεδία του ορόφου). Μία απάντηση για όλες τις κάρτες.
 */
export function levelAggregateOf(
  isMultiLevel: boolean,
  activeLevelId: string | null,
  aggregatedTotals: PropertyFieldsEditFormProps['aggregatedTotals'],
): AggregatedTotals | null {
  return isMultiLevel && activeLevelId === null ? aggregatedTotals : null;
}
