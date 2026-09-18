'use client';

/**
 * **ΠΟΤΕ ΚΑΙ ΠΟΣΟΙ;** — ο χρονικός άξονας της οθόνης 2 (ADR-835 §4.6).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΑ ΦΙΛΤΡΑ ΖΟΥΝ ΣΤΗ ΔΙΕΥΘΥΝΣΗ — ΚΑΜΙΑ ΚΑΤΑΣΤΑΣΗ ΣΕ ΜΝΗΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **Α3** δεσμεύτηκε ότι *«τα φίλτρα επιμένουν»*, και μετρήθηκε ότι **75%** των
 * αποτυχιών της παλιάς κατάστασης ήταν ακριβώς η απώλειά τους. Το ίδιο ισχύει —
 * **περισσότερο** — για τις ημερομηνίες: ένας σύνδεσμος προς «ελεύθερα 10–17/08»
 * που δείχνει άλλες μέρες όταν τον ανοίξει ο φίλος σου δεν είναι σύνδεσμος.
 *
 * ⚠️ **Καμία `useState` για τιμή φίλτρου.** Ο κάθε έλεγχος γράφει **κατευθείαν** στη
 * διεύθυνση μέσω του {@link serializeListingFilters}, και διαβάζει από αυτήν. Δύο
 * αντίγραφα της ίδιας ερώτησης θα διαφωνούσαν στο πρώτο «πίσω».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΝΑΤΙΒ `<input type="date">` ΚΑΙ ΟΧΙ ΒΙΒΛΙΟΘΗΚΗ ΗΜΕΡΟΛΟΓΙΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Η μορφή του είναι ΗΔΗ `YYYY-MM-DD`** — ακριβώς ο τύπος που περιμένει το
 *    `ListingStayWindow`. Καμία μετατροπή, καμία ζώνη ώρας, κανένα `slice(0, 10)`.
 * 2. **Α19 (πρώτος καρές)**: μηδέν επιπλέον JavaScript στην πιο δημόσια οθόνη μας.
 * 3. **Προσβασιμότητα**: το πληκτρολόγιο και ο αναγνώστης οθόνης το ξέρουν ήδη.
 *
 * ⚠️ Το `min` στην αναχώρηση **δεν είναι** ο φρουρός — είναι **βοήθεια**. Ο φρουρός
 * είναι το `readStayWindow`, που απορρίπτει κενά και ανάποδα διαστήματα **στην πόρτα**
 * (Ε-10): ένας κοινοποιημένος σύνδεσμος δεν περνά από `<input>`.
 */

import React, { useId } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingFilters } from '@/lib/listings/listing-filters';
import { intervalShape } from '@/lib/date-local';
import { STAY_PETS_CEILING } from '@/lib/offers/offer-amount';
import { cn } from '@/lib/utils';
import { useFilterCommit } from './filters/use-filter-commit';

interface StayFilterFieldsProps {
  readonly filters: ListingFilters;
  readonly className?: string;
}

/** Πόσα άτομα προσφέρει ο έλεγχος. Πάνω από αυτό, ο επισκέπτης γράφει στη διεύθυνση. */
const GUEST_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** Πόσα κατοικίδια — **παράγεται** από το ταβάνι του κατόχου, ποτέ δεύτερος χειρόγραφος αριθμός. */
const PET_CHOICES: readonly number[] = Array.from({ length: STAY_PETS_CEILING }, (_, index) => index + 1);

/**
 * **Ένας επιλογέας πλήθους** — άτομα ή κατοικίδια, με ρητό «δεν το έχω αποφασίσει».
 *
 * ⚠️ **Το «δεν το έχω αποφασίσει» είναι ΤΙΜΗ, όχι απουσία** (N.12). Χωρίς ρητή επιλογή, ο
 * επισκέπτης δεν θα μπορούσε να **ξε-ρωτήσει** — και το `null` σημαίνει «δεν ρωτήθηκε», ποτέ
 * «ένα» ή «μηδέν». Εξήχθη όταν ήρθε ο δεύτερος άξονας, ώστε να μη γεννηθεί δίδυμο (CHECK 3.28).
 */
function CountSelectField({
  label,
  anyLabel,
  choices,
  value,
  onChange,
}: {
  readonly label: string;
  readonly anyLabel: string;
  readonly choices: readonly number[];
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
}): React.ReactElement {
  const id = useId();
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="mt-1 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
      >
        <option value="">{anyLabel}</option>
        {choices.map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
    </div>
  );
}

export function StayFilterFields({ filters, className }: StayFilterFieldsProps) {
  const { t } = useTranslation(['short-stay']);
  const { commit } = useFilterCommit(filters);
  const checkInId = useId();
  const checkOutId = useId();

  const checkIn = filters.stayWindow?.checkIn ?? '';
  const checkOut = filters.stayWindow?.checkOut ?? '';

  /**
   * ✅ **Η ΜΙΑ ΕΞΟΔΟΣ ΠΡΟΣ ΤΗ ΔΙΕΥΘΥΝΣΗ ΕΦΥΓΕ ΣΕ ΚΟΙΝΟ ΤΟΠΟ** *(2026-09-04, Στάδιο 3)*.
   *
   * Ζούσε εδώ ως τοπική `commit()`, με τον λόγο της γραμμένο: *«δύο σημεία που έγραφαν
   * διεύθυνση θα παρήγαγαν δύο διαφορετικούς συνδέσμους για την ίδια ερώτηση»*. Το
   * πάνελ κριτηρίων πρόσθεσε **τρία ακόμη** τέτοια σημεία — οπότε το επιχείρημα
   * απαιτούσε **μετακόμιση**, όχι αντιγραφή: {@link useFilterCommit}.
   */

  /**
   * ⚠️ **Το ημιτελές παράθυρο ΔΕΝ γράφεται, και δεν είναι σφάλμα.** Όσο ο επισκέπτης
   * έχει συμπληρώσει μόνο την άφιξη, δεν υπάρχει ερώτηση — και το `stayWindow: null`
   * είναι η **ειλικρινής** κατάσταση. Θα γραφτεί μόλις υπάρξουν και τα δύο άκρα.
   *
   * 🔴 **Και το ανάποδο/κενό διάστημα ΔΕΝ «διορθώνεται» σιωπηλά.** Ο επισκέπτης που
   * έβαλε αναχώρηση πριν την άφιξη οφείλει να το **μάθει** (δες το μήνυμα παρακάτω),
   * όχι να δει τις ημερομηνίες του να αλλάζουν μόνες τους.
   */
  function commitWindow(nextIn: string, nextOut: string): void {
    const complete = nextIn !== '' && nextOut !== '' && intervalShape(nextIn, nextOut) === 'proper';
    commit({
      ...filters,
      stayWindow: complete ? { checkIn: nextIn, checkOut: nextOut } : null,
    });
  }

  // 🔴 **Ονομάζουμε το πρόβλημα αντί να το σβήσουμε** — το ίδιο ήθος με τη λογιστική:
  //    ο επισκέπτης έγραψε κάτι, και του λέμε τι δεν πάει, όχι «τίποτα δεν βρέθηκε».
  const rangeInvalid =
    checkIn !== '' && checkOut !== '' && intervalShape(checkIn, checkOut) !== 'proper';

  return (
    <section aria-label={t('short-stay:legend')} className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label htmlFor={checkInId} className="text-xs font-medium text-muted-foreground">
            {t('short-stay:checkIn')}
          </label>
          <input
            id={checkInId}
            type="date"
            value={checkIn}
            onChange={(e) => commitWindow(e.target.value, checkOut)}
            className="mt-1 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor={checkOutId} className="text-xs font-medium text-muted-foreground">
            {t('short-stay:checkOut')}
          </label>
          <input
            id={checkOutId}
            type="date"
            value={checkOut}
            // ⚠️ Βοήθεια, ΟΧΙ φρουρός — δες την κεφαλίδα.
            min={checkIn === '' ? undefined : checkIn}
            onChange={(e) => commitWindow(checkIn, e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>

        <CountSelectField
          label={t('short-stay:guests')}
          anyLabel={t('short-stay:guestsAny')}
          choices={GUEST_CHOICES}
          value={filters.guests}
          onChange={(guests) => commit({ ...filters, guests })}
        />

        {/* ADR-777 §8.60.21 — ίδιος έλεγχος, ίδιος κανόνας «δεν ρωτήθηκε ≠ μηδέν». */}
        <CountSelectField
          label={t('short-stay:pets.filterLabel')}
          anyLabel={t('short-stay:pets.filterAny')}
          choices={PET_CHOICES}
          value={filters.pets}
          onChange={(pets) => commit({ ...filters, pets })}
        />

        {filters.stayWindow !== null && (
          <button
            type="button"
            onClick={() => commit({ ...filters, stayWindow: null })}
            className="rounded-md border border-input px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {t('short-stay:clear')}
          </button>
        )}
      </div>

      {rangeInvalid && (
        <p role="alert" className="text-sm text-destructive">
          {t('short-stay:rangeInvalid')}
        </p>
      )}

      <p className="text-xs text-muted-foreground">{t('short-stay:hint')}</p>
      <p className="text-xs text-muted-foreground">{t('short-stay:pets.filterHint')}</p>
    </section>
  );
}
