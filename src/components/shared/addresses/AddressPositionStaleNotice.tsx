'use client';

/**
 * @fileoverview **Η ΘΕΣΗ ΛΥΘΗΚΕ ΓΙΑ ΑΛΛΟ ΚΕΙΜΕΝΟ** — ADR-332 D27 **Ζ6**.
 * @related lib/geocoding/address-position (`positionTextVerdict` · `resolvedFor`)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΤΟ ΞΕΧΩΡΙΖΕΙ ΑΠΟ ΤΟ {@link AddressPositionDriftNotice}
 * ────────────────────────────────────────────────────────────────────────────
 * Το drift notice μιλά για πινέζα **ανθρώπου** που απέχει από τη νέα διεύθυνση: εκεί ο
 * άνθρωπος έχει **δύο** έγκυρες απαντήσεις («μετακίνησε» ή «κράτα — ξέρω καλύτερα»), γιατί η
 * πινέζα του **είναι** γνώση. Εδώ μιλάμε για θέση **μηχανής** που ισχυρίζεται ακρίβεια για
 * κείμενο που δεν ισχύει.
 *
 * 🔑 **Γι' αυτό η ενέργεια είναι ΜΙΑ, όχι δύο.** Ένα «κράτα» εδώ θα ήταν **τοπική απόκρυψη**
 * μιας πρότασης που παραμένει ψευδής στη βάση — θα ξαναεμφανιζόταν σε κάθε φόρτωση και θα
 * εκπαίδευε τον άνθρωπο να αγνοεί το μήνυμα. Η κατάσταση του drift είναι **εφήμερη**
 * (απάντηση μιας αποθήκευσης)· αυτή είναι **μόνιμη**, και η μόνη πράξη που την αλλάζει είναι
 * το να ξαναρωτηθεί η μηχανή.
 *
 * ⚠️ **Πληροφορεί, δεν μπλοκάρει** (Α5 §4.3). Η αποθηκευμένη θέση μένει άθικτη όσο ο άνθρωπος
 * δεν αποφασίζει — «άγνοια δεν σβήνει σωστό σημείο».
 */

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface AddressPositionStaleNoticeProps {
  /** Ρητή δήλωση «ξαναλύσε αυτή τη διεύθυνση» — η **υπάρχουσα** διαδρομή `relocate`. */
  readonly onResolve: () => void;
  /** Αποθήκευση σε εξέλιξη — το κουμπί παγώνει, το μήνυμα μένει. */
  readonly busy?: boolean;
}

export function AddressPositionStaleNotice({ onResolve, busy = false }: AddressPositionStaleNoticeProps) {
  const { t } = useTranslation('addresses');

  return (
    <section role="status" aria-live="polite" className="mt-2 space-y-2 border-t pt-2 text-sm">
      <p className="text-[hsl(var(--text-warning))]">{t('editor.positionStale.message')}</p>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onResolve}>
        {t('editor.positionStale.resolve')}
      </Button>
    </section>
  );
}
