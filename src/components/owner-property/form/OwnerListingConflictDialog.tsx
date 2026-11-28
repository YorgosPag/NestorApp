'use client';

/**
 * @fileoverview **Ο διάλογος σύγκρουσης της αγγελίας** — ποια πεδία άλλαξαν και οι δύο, ποιος, πότε, και δύο πράξεις.
 * @related ADR-953 §3.5 · hooks/owner-property/useOwnerListingEdit.ts · components/ui/ConfirmDialog.tsx (ADR-003)
 * @module components/owner-property/form/OwnerListingConflictDialog
 *
 * 🔑 **Ανοίγει ΜΟΝΟ όταν δύο άλλαξαν το ίδιο πεδίο σε άλλη τιμή.** Αλλαγές σε διαφορετικά πεδία συγχωνεύονται
 * χωρίς ερώτηση και χωρίς μήνυμα — ένας διάλογος για κάθε ξένη αποθήκευση θα ήταν θόρυβος, όχι σήμα.
 *
 * ⚠️ **Κλείσιμο χωρίς απόφαση (Esc) δεν χάνει τίποτα**: η φόρμα μένει όπως είναι και η επόμενη αποθήκευση ξαναρωτά.
 */

import * as React from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime } from '@/lib/intl-formatting';
import type { OwnerListingConflict, OwnerPropertyDraftField } from '@/lib/owner-property/owner-property-edit';

const NS = 'property-market';

/**
 * Τα ονόματα των πεδίων — **σταθερά module**, ώστε να τα βλέπει ο τεμαχιστής και η CHECK 3.8.
 * ⚠️ `Record<OwnerPropertyDraftField, …>`: νέο πεδίο προσχεδίου δεν μεταγλωττίζεται χωρίς όνομα για τον άνθρωπο.
 */
const FIELD_KEYS: Record<OwnerPropertyDraftField, string> = {
  title: 'property-market:offer.conflict.field.title',
  type: 'property-market:offer.conflict.field.type',
  areaSqm: 'property-market:offer.conflict.field.areaSqm',
  floor: 'property-market:offer.conflict.field.floor',
  floorKind: 'property-market:offer.conflict.field.floorKind',
  unitNumber: 'property-market:offer.conflict.field.unitNumber',
  bedrooms: 'property-market:offer.conflict.field.bedrooms',
  offers: 'property-market:offer.conflict.field.offers',
  place: 'property-market:offer.conflict.field.place',
  media: 'property-market:offer.conflict.field.media',
  publishedFileIds: 'property-market:offer.conflict.field.publishedFileIds',
  publishedFileFocalPoints: 'property-market:offer.conflict.field.publishedFileFocalPoints',
  publishedFileCaptureSpots: 'property-market:offer.conflict.field.publishedFileCaptureSpots',
  publishedFileFloorplanNorth: 'property-market:offer.conflict.field.publishedFileFloorplanNorth',
  publishedFileCaptions: 'property-market:offer.conflict.field.publishedFileCaptions',
};

interface OwnerListingConflictDialogProps {
  /** Η σύγκρουση που περιμένει απόφαση· `null` ⇒ ο διάλογος είναι κλειστός. */
  readonly conflict: OwnerListingConflict | null;
  /** Η «Κράτα τις δικές μου» τρέχει. */
  readonly resolving: boolean;
  readonly onKeepMine: () => void | Promise<void>;
  readonly onTakeTheirs: () => void;
  readonly onDismiss: () => void;
}

export function OwnerListingConflictDialog({
  conflict,
  resolving,
  onKeepMine,
  onTakeTheirs,
  onDismiss,
}: OwnerListingConflictDialogProps): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  if (conflict === null) return null;

  const who = conflict.bySelf
    ? t('property-market:offer.conflict.bySelf')
    : conflict.byName !== null
      ? t('property-market:offer.conflict.byOther', { name: conflict.byName })
      : t('property-market:offer.conflict.byUnknown');

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      title={t('property-market:offer.conflict.title')}
      description={
        <>
          <p>{who}</p>
          {conflict.at !== null && (
            <p>{t('property-market:offer.conflict.at', { when: formatDateTime(conflict.at) })}</p>
          )}
        </>
      }
      confirmText={t('property-market:offer.conflict.keepMine')}
      cancelText={t('property-market:offer.conflict.loadTheirs')}
      onConfirm={onKeepMine}
      onCancel={onTakeTheirs}
      variant="warning"
      loading={resolving}
      keepOpenWhilePending
    >
      <section>
        <p>{t('property-market:offer.conflict.fieldsHeading', { count: conflict.fields.length })}</p>
        <ul className="list-disc pl-5">
          {conflict.fields.map((field) => (
            <li key={field}>{t(FIELD_KEYS[field])}</li>
          ))}
        </ul>
        <p>{t('property-market:offer.conflict.rest')}</p>
      </section>
    </ConfirmDialog>
  );
}
