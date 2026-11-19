'use client';

/**
 * @fileoverview **Η ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΕΧΕΙ ΘΕΣΗ** — ADR-332 §D32 (Esri «Rematch» των `U`).
 * @related lib/geocoding/address-position (`positionSettled` · `geocodeAttempt`) · AddressPositionStaleNotice
 *
 * 🔴 Ως το D32 η κάρτα έγραφε σκέτο «Χωρίς συντεταγμένες» — **χωρίς** να λέει αν ρωτήθηκε ποτέ ο
 * πάροχος, και **χωρίς** τρόπο να ξαναρωτηθεί. Δύο καταστάσεις, επειδή σημαίνουν άλλο για τον άνθρωπο:
 *
 * | Κατάσταση | Τι ξέρουμε | Τι θα γίνει χωρίς κανένα κλικ |
 * |---|---|---|
 * | `unmatched` | ο πάροχος ρωτήθηκε **με την τρέχουσα αναζήτηση** και δεν τη βρήκε | αυτόματη νέα δοκιμή όταν βελτιωθεί η αναζήτηση |
 * | `unchecked` | δεν έχει ρωτηθεί για αυτό το κείμενο με την τρέχουσα αναζήτηση | υπολογίζεται στην επόμενη αποθήκευση |
 *
 * 🔑 **Μία ενέργεια**, η **υπάρχουσα** διαδρομή `relocate` (`intent.relocate`) — καμία δεύτερη διαδρομή
 * εγγραφής. ⚠️ **Πληροφορεί, δεν μπλοκάρει** (Α5 §4.3).
 */

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export type AddressUnlocatedState = 'unmatched' | 'unchecked';

/** Ρητά κλειδιά — ποτέ template literal: οι πύλες i18n (3.8 · 3.13) βλέπουν μόνο ό,τι είναι γραμμένο. */
const MESSAGE_KEY: Readonly<Record<AddressUnlocatedState, string>> = {
  unmatched: 'editor.positionUnlocated.unmatched',
  unchecked: 'editor.positionUnlocated.unchecked',
};

export interface AddressPositionUnlocatedNoticeProps {
  readonly state: AddressUnlocatedState;
  /** «Εντόπισε αυτή τη διεύθυνση τώρα» — η υπάρχουσα διαδρομή `relocate`. */
  readonly onLocate: () => void;
  /** Αποθήκευση σε εξέλιξη — το κουμπί παγώνει, το μήνυμα μένει. */
  readonly busy?: boolean;
}

export function AddressPositionUnlocatedNotice({ state, onLocate, busy = false }: AddressPositionUnlocatedNoticeProps) {
  const { t } = useTranslation('addresses');

  return (
    <section role="status" aria-live="polite" className="mt-2 space-y-2 border-t pt-2 text-sm">
      <p className="text-muted-foreground">{t(MESSAGE_KEY[state])}</p>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onLocate}>
        {t('editor.positionUnlocated.locate')}
      </Button>
    </section>
  );
}
