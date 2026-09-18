'use client';

/**
 * =============================================================================
 * SpaceCommercialCard — «Διάθεση & τιμή» μιας θέσης στάθμευσης ή αποθήκης
 * =============================================================================
 *
 * ADR-777 §8.60.18. Ως τις 2026-09-18 **καμία** οθόνη δεν μπορούσε να δηλώσει χώρο προς
 * ενοικίαση: το ADR-193 είχε αφαιρέσει την «Οικονομική» κάρτα της Γενικής καρτέλας και καμία
 * άλλη δεν πήρε τη θέση της. Η κάρτα επιστρέφει ως **χωριστή ομάδα** (Revit Properties palette:
 * ομάδα παραμέτρων, όχι ανάμειξη με τα φυσικά), με το **ίδιο** πρωτότυπο με το ακίνητο:
 * ο ίδιος επιλογέας διάθεσης, τα ίδια πεδία τιμής, ο ίδιος έλεγχος εύλογου.
 *
 * Όταν τη διάθεση την **κατέχει συναλλαγή** (κρατημένη · πωλημένη · μισθωμένη), η κάρτα τη
 * δείχνει κλειδωμένη και λέει **γιατί** — ο server αρνείται έτσι κι αλλιώς (409).
 *
 * @module components/shared/commercial/SpaceCommercialCard
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { isTransactionOwnedCommercialStatus } from '@/constants/commercial-statuses';
import type { CommercialDraftState } from './useCommercialDraft';
import { CommercialStatusSelect } from './CommercialStatusSelect';
import { CommercialPriceFields } from './CommercialPriceFields';

export interface SpaceCommercialCardProps {
  /** Το πρόχειρο της καρτέλας (`useCommercialDraft`). */
  readonly commercial: CommercialDraftState;
  /** Εμβαδόν για €/m² — `undefined` όταν δεν έχει δηλωθεί. */
  readonly area: number | undefined;
  /** Κλάση τιμής για τον έλεγχο εύλογου — `'parking'` · `'storage'`. */
  readonly pricingType: 'parking' | 'storage';
  readonly isEditing: boolean;
  /** Πρόθεμα `id` — μοναδικό ανά σελίδα. */
  readonly idPrefix: string;
}

export function SpaceCommercialCard({
  commercial,
  area,
  pricingType,
  isEditing,
  idPrefix,
}: SpaceCommercialCardProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  const PriceIcon = NAVIGATION_ENTITIES.price.icon;
  const transactionOwned = isTransactionOwnedCommercialStatus(commercial.draft.commercialStatus);
  const disabled = !isEditing || transactionOwned;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <PriceIcon className={cn(iconSizes.md, NAVIGATION_ENTITIES.price.color)} />
          {t('commercialCard.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <fieldset className="space-y-1">
          <CommercialStatusSelect
            id={`${idPrefix}-commercial-status`}
            value={commercial.draft.commercialStatus}
            onValueChange={commercial.setStatus}
            disabled={!isEditing}
          />
        </fieldset>
        <CommercialPriceFields
          draft={commercial.draft}
          onPriceChange={commercial.setPrice}
          grossArea={area}
          pricingType={pricingType}
          disabled={disabled}
          idPrefix={idPrefix}
        />
        {transactionOwned && (
          <p className={cn('text-xs md:col-span-2', colors.text.muted)}>
            {t('commercialCard.transactionLocked')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
