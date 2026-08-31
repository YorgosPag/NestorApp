'use client';

/**
 * **Η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ ΣΤΟΝ ΧΡΟΝΟ** — «14 αγγελίες · 9 ελεύθερα · 4 κρατημένα · 1
 * χωρίς δηλωμένο ημερολόγιο» (ADR-835 §4.6).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΗΝ ΑΓΟΡΑ — ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η καταγεγραμμένη συμπεριφορά κάθε πλατφόρμας κρατήσεων:
 *
 *   «*the search algorithm **completely hides** unavailable listings rather than
 *   suggesting nearby dates or showing partially available properties*»
 *
 * Δηλαδή ο επισκέπτης βλέπει **3** αποτελέσματα και δεν μαθαίνει ποτέ ότι υπήρχαν
 * **14**, ούτε **γιατί** έφυγαν τα 11. Εδώ ο αριθμός που λείπει **τυπώνεται**.
 *
 * 🔑 Είναι η **δεύτερη** γραμμή δίπλα στην {@link ListingLedgerBar}, όχι αντικατάστασή
 * της: *«πού;»* και *«πότε;»* είναι **ανεξάρτητες διαμερίσεις** του ίδιου συνόλου.
 *
 * ⚠️ **Τυπώνονται οι μη-μηδενικοί κάδοι, ΚΑΙ ΠΑΝΤΑ το σύνολο.** Ένας κάδος στο μηδέν
 * δεν είναι *«αριθμός που λείπει»* — δεν υπάρχει τίποτα εκεί. Ο κανόνας *«το 0
 * τυπώνεται ακόμη κι όταν είναι 0»* τηρείται εκεί που έχει νόημα: στον **έλεγχο**
 * ({@link stayLedgerBalances}), που τρέχει σε **κάθε** βάψιμο και **φωνάζει** αν το
 * άθροισμα δεν κλείσει.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  stayLedgerBalances,
  ledgersAgree,
  type StayLedger,
} from '@/lib/listings/stay-ledger';
import {
  STAY_AVAILABILITY_KINDS,
  type StayAvailabilityKind,
} from '@/lib/stay/stay-availability-vocabulary';
import type { ListingLedger } from '@/types/public-listing';
import { cn } from '@/lib/utils';

/**
 * 🔑 **ΠΛΗΡΗ ΚΛΕΙΔΙΑ, ΠΟΤΕ ΣΥΝΑΡΜΟΛΟΓΗΜΕΝΑ** — παγίδα **μετρημένη** στη Φ2.
 *
 * Ένα ``t(`${NS}.kind.${x}`)`` **δεν επιλύεται** από τον στατικό σαρωτή της
 * **CHECK 3.8**: ο σαρωτής βλέπει `t()` με πρότυπο, δεν βλέπει κλειδί — άρα ένα
 * κλειδί που **λείπει** από τα locale περνά αόρατο και φτάνει στην οθόνη ως **ωμό
 * κείμενο κλειδιού** μπροστά στον επισκέπτη.
 *
 * ⚠️ **`Record` πάνω σε κλειστό σύνολο**: δέκατη τιμή στο λεξιλόγιο **δεν
 * μεταγλωττίζεται** μέχρι να αποκτήσει κλειδί — ο ίδιος φρουρός με τους κάδους της
 * λογιστικής. Μια χειρόγραφη `switch` θα δεχόταν τη δέκατη σιωπηλά.
 */
const LEDGER_KIND_KEYS: Readonly<Record<StayAvailabilityKind, string>> = {
  free: 'short-stay:ledger.kind.free',
  conditional: 'short-stay:ledger.kind.conditional',
  occupied: 'short-stay:ledger.kind.occupied',
  unknown: 'short-stay:ledger.kind.unknown',
  unreadable: 'short-stay:ledger.kind.unreadable',
  'terms-unknown': 'short-stay:ledger.kind.terms-unknown',
  'over-capacity': 'short-stay:ledger.kind.over-capacity',
  'below-min-nights': 'short-stay:ledger.kind.below-min-nights',
  'not-a-stay': 'short-stay:ledger.kind.not-a-stay',
};

interface StayLedgerBarProps {
  readonly stay: StayLedger;
  /** Η **πρώτη** διαμέριση — για τον έλεγχο ότι κλείνουν στο ίδιο σύνολο. */
  readonly position: ListingLedger;
  /** `false` όσο ο επισκέπτης δεν έχει δώσει ημερομηνίες. */
  readonly asked: boolean;
  readonly className?: string;
}

export function StayLedgerBar({ stay, position, asked, className }: StayLedgerBarProps) {
  const { t } = useTranslation(['short-stay']);

  const balanced = stayLedgerBalances(stay);
  const agree = ledgersAgree(position, stay);

  return (
    <output
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground',
        className
      )}
    >
      {!asked && <span>{t('short-stay:ledger.idle')}</span>}

      {asked && (
        <>
          <span>{t('short-stay:ledger.total', { count: stay.total })}</span>
          {STAY_AVAILABILITY_KINDS.filter((kind) => stay.byKind[kind] > 0).map((kind) => (
            <span key={kind}>
              {`· ${t(LEDGER_KIND_KEYS[kind], { count: stay.byKind[kind] })}`}
            </span>
          ))}
        </>
      )}

      {/*
        🔴 ΟΙ ΔΥΟ ΦΡΟΥΡΟΙ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟΙ, ΚΑΙ ΕΙΝΑΙ ΔΥΟ ΕΠΙΤΗΔΕΣ.
        Ο πρώτος πιάνει «απάντηση που δεν μετριέται σε κανέναν κάδο»· ο δεύτερος
        πιάνει «οι δύο διαμερίσεις μέτρησαν ΑΛΛΟ σύνολο» — π.χ. επειδή κάποιος πέρασε
        στη μία τις φιλτραρισμένες και στην άλλη όλες. Ένας κοινός έλεγχος θα έλεγε
        «κάτι δεν πάει καλά» και δεν θα έλεγε ποτέ **ποιο από τα δύο**.
      */}
      {!balanced && (
        <strong role="alert" className="text-destructive">
          {t('short-stay:ledger.imbalanced')}
        </strong>
      )}
      {balanced && !agree && (
        <strong role="alert" className="text-destructive">
          {t('short-stay:ledger.disagree')}
        </strong>
      )}
    </output>
  );
}
