'use client';

/**
 * =============================================================================
 * **Ο ΣΥΝΔΕΣΜΟΣ ΑΠΑΝΤΑ, ΑΚΟΜΗ ΚΑΙ ΟΤΑΝ Η ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ «ΟΧΙ»** — ADR-777 §8.31
 * =============================================================================
 *
 * Ένας ιδιοκτήτης ένα σημείο προσάρτησης ανά οθόνη — αποθήκες · στάθμευση ·
 * κτίρια. Μεταφράζει τις ρητές καταστάσεις του {@link EntitySelection} σε κάτι
 * που **βλέπει άνθρωπος**.
 *
 * ## Γιατί υπάρχει
 *
 * Πριν από το §8.31 και οι δύο «όχι» ήταν **σιωπηλοί**:
 * - *δεν υπάρχει* ⇒ η οθόνη έδειχνε το γενικό «διάλεξε κάτι από τη λίστα», σαν
 *   να μην είχε ζητηθεί ποτέ τίποτα·
 * - *στον κάδο* ⇒ **τίποτα** — και στα κτίρια, χειρότερα, **άλλη εγγραφή**.
 *
 * 🏆 Η αγορά ονομάζει τη σιωπηλή αστοχία deep-link ελάττωμα (`openai/codex#18216`:
 * *«fail silently instead of resolving or offering recovery»*) και απαντά με
 * **ανάκτηση** (GitLab · Google Drive · Outlook). Εδώ η ίδια απάντηση δεν είναι
 * υλοποίηση **μιας οθόνης** αλλά συμβόλαιο του κοινού εξαρτήματος: κάθε λίστα
 * που καταναλώνει το `useEntityPageState` το κληρονομεί.
 *
 * ⚠️ **ΔΕΝ αποδίδει τίποτα για `resolving`.** Το «ψάχνω» ανήκει στην κατάσταση
 * φόρτωσης της οθόνης· πανό που αναβοσβήνει για ένα καρέ είναι θόρυβος, και σε
 * **δυναμική** διαδρομή θα έφευγε ωμό κλειδί στο HTML του διακομιστή (§8.30 Μ-Β).
 *
 * @module components/shared/deep-link/DeepLinkNotice
 * @enterprise ADR-777 §8.31
 */

import React from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EntitySelection, SelectableEntity } from '@/hooks/entity-selection-state';

export interface DeepLinkNoticeProps<T extends SelectableEntity> {
  readonly selection: EntitySelection<T>;
  /** Προαιρετική ενέργεια επαναφοράς, όταν η εγγραφή είναι στον κάδο. */
  readonly onRestore?: (item: T) => void;
  readonly className?: string;
}

export function DeepLinkNotice<T extends SelectableEntity>({
  selection,
  onRestore,
  className,
}: DeepLinkNoticeProps<T>): React.ReactElement | null {
  const { t } = useTranslation('common-shared');

  if (selection.kind === 'not-found') {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('deepLink.title')}</AlertTitle>
        <AlertDescription>{t('deepLink.body')}</AlertDescription>
      </Alert>
    );
  }

  if (selection.kind === 'archived') {
    return (
      <Alert className={className}>
        <Trash2 className="h-4 w-4" />
        <AlertTitle>{t('deepLink.archivedTitle')}</AlertTitle>
        <AlertDescription>
          {t('deepLink.archivedBody')}
          {onRestore ? (
            <button
              type="button"
              className="ml-2 underline underline-offset-2"
              onClick={() => onRestore(selection.item)}
            >
              {t('deepLink.restore')}
            </button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  // `none` · `selected` · `resolving` — η οθόνη δείχνει ήδη το σωστό πράγμα.
  return null;
}
