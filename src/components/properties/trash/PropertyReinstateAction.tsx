'use client';

/**
 * ♻️ PropertyReinstateAction — «Επαναφορά» **πάνω στην ίδια την αποσυρμένη εγγραφή**.
 *
 * Στη λίστα η επαναφορά ζει στη μπάρα του αρχείου/κάδου. Στη σελίδα `/properties/[id]` δεν υπάρχει
 * μπάρα: η ταινία θα εξηγούσε τι κάνει η επαναφορά χωρίς να την προσφέρει, και ο άνθρωπος θα έπρεπε να
 * βρει μόνος του το ακίνητο στο αρχείο. Η πρακτική (Notion · Shopify · Figma) είναι η πράξη δίπλα στην
 * εξήγηση (ADR-329 §3.9).
 *
 * 🔑 **Καμία δεύτερη ροή**: ίδιος δρόμος, ίδια μηνύματα, ίδια `useTrashBarRestore` με τις μπάρες
 * (`property-reinstate`). Εδώ μόνο ο στόχος — **ένα** ακίνητο.
 *
 * ⚠️ **Δεν ανανεώνει τίποτα μόνη της, επίτηδες.** Μετά την επαναφορά ο ζωντανός κατάλογος αποκτά το
 * ακίνητο και η σελίδα ξεκλειδώνει (ο κατάλογος προηγείται — `property-page-state`). Μια δεύτερη
 * ανάγνωση εδώ θα έβρισκε ζωντανό έγγραφο πριν φτάσει το στιγμιότυπο και θα έδειχνε «δεν βρέθηκε».
 *
 * @module components/properties/trash/PropertyReinstateAction
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { useCallback, useState } from 'react';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTrashBarRestore, type TrashBarRestoreSpec } from '@/components/shared/trash/useTrashBarRestore';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n';
import { retiredKindOf, type MaybeTrashed } from '@/lib/firestore/trashed-status';
import '@/lib/design-system';

import {
  restoreTrashedProperties,
  unarchiveProperties,
  useArchivedPropertyReinstateText,
  useTrashedPropertyReinstateText,
} from './property-reinstate';

interface PropertyReinstateActionProps {
  readonly property: MaybeTrashed & { readonly id: string };
}

const NOTHING_TO_REFRESH = (): void => undefined;

/** Ζωντανό ακίνητο ⇒ τίποτα. Κάθε απόσυρση έχει τον δικό της δρόμο επιστροφής. */
export function PropertyReinstateAction({ property }: PropertyReinstateActionProps) {
  const kind = retiredKindOf(property);
  if (kind === 'archived') return <ArchivedReinstate propertyId={property.id} />;
  if (kind === 'trashed') return <TrashedReinstate propertyId={property.id} />;
  return null;
}

function ArchivedReinstate({ propertyId }: { readonly propertyId: string }) {
  const text = useArchivedPropertyReinstateText();
  return (
    <ReinstateButton
      propertyId={propertyId}
      label={text.restore}
      entity="properties-archive"
      restore={unarchiveProperties}
      successMessage={text.restoreSuccess}
      failureMessage={text.restoreFailed}
    />
  );
}

function TrashedReinstate({ propertyId }: { readonly propertyId: string }) {
  const { t } = useTranslation('trash');
  const text = useTrashedPropertyReinstateText();
  return (
    <ReinstateButton
      propertyId={propertyId}
      label={t('retiredBanner.restoreFromTrash')}
      entity="properties"
      restore={restoreTrashedProperties}
      successMessage={text.restoreSuccess}
      failureMessage={text.restoreFailed}
    />
  );
}

interface ReinstateButtonProps<TResult> extends Omit<TrashBarRestoreSpec<TResult>, 'onSettled'> {
  readonly propertyId: string;
  readonly label: string;
}

function ReinstateButton<TResult>({ propertyId, label, ...flow }: ReinstateButtonProps<TResult>) {
  const iconSizes = useIconSizes();
  const runRestore = useTrashBarRestore<TResult>({ ...flow, onSettled: NOTHING_TO_REFRESH });
  // Ιδεμποτία στο κλικ: όσο τρέχει η επαναφορά, δεύτερο πάτημα δεν ξεκινά δεύτερη.
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(async () => {
    setPending(true);
    try {
      await runRestore([propertyId]);
    } finally {
      setPending(false);
    }
  }, [runRestore, propertyId]);

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5 self-start"
      disabled={pending}
      aria-busy={pending}
      onClick={() => void handleClick()}
    >
      <RotateCcw className={iconSizes.xs} />
      {label}
    </Button>
  );
}
