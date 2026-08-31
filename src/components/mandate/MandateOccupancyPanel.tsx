'use client';

/**
 * @fileoverview **Η ΚΑΤΑΛΗΨΗ, ΟΡΑΤΗ ΠΡΙΝ ΤΟ ΠΑΤΗΜΑ** — το πάνελ του Φ5 (ADR-832 §4).
 * @related lib/mandate/mandate-occupancy-notice.ts · components/mandate/MandateRequestFormContent.tsx
 * @module components/mandate/MandateOccupancyPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΝΤΙΚΑΘΙΣΤΑ: ΤΗ ΣΙΩΠΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τις 2026-08-30 ο επιλογέας ακινήτου **έκρυβε** ό,τι είχε εντολή
 * (`mandate.kind === 'self'`): ο ιδιοκτήτης δεν έβλεπε το σπίτι του και **δεν
 * μάθαινε ποτέ γιατί λείπει**. Το ADR-832 έβγαλε το φιλτράρισμα — και αν σταματούσε
 * εκεί, θα είχε αντικαταστήσει τη σιωπή με μια **έκπληξη μετά την υποβολή**.
 *
 * 🏆 Αυτό το πάνελ είναι η **τρίτη** κατάσταση, και η μόνη σωστή: *«ο Χ κρατά
 * αποκλειστική πώλησης ως 12/03 — ελεύθερο από τότε»*, **πριν** πατήσει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΚΑΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ **Δεν κρίνει.** Ο κανόνας ζει στο `mandate-occupancy-notice.ts`, που καλεί τον
 * **ίδιο** κριτή με τον διακομιστή. Εδώ γίνεται μόνο μετάφραση σε λέξεις.
 * ⛔ **Δεν μπλοκάρει την υποβολή.** Η πρόβλεψη βλέπει ό,τι έχει ο πελάτης· ο
 * διακομιστής κρίνει με τα **φρέσκα**. Ένα κουμπί απενεργοποιημένο από πρόβλεψη θα
 * έκλεινε τον δρόμο σε άνθρωπο που έχει δίκιο (N.7.2 #4: κύριος δρόμος + δίχτυ).
 * ⛔ **Δεν αποκαλύπτει ταυτότητες.** Δείχνει το όνομα **μόνο** όσων ξέρει ο καλών —
 * δες το `nameOf`.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EXISTING_IS_EXCLUSIVE, type MandateConflict } from '@/lib/mandate/mandate-conflict';
import type {
  MandateOccupancyNotice,
} from '@/lib/mandate/mandate-occupancy-notice';
import type { MandateOccupancy } from '@/lib/mandate/mandate-conflict';
import { LISTING_AGREEMENT_I18N_KEYS } from '@/components/mandate/listing-agreement-labels';
import { OFFER_KIND_I18N_KEYS } from '@/components/mandate/offer-kind-labels';
import { formatTermDay, toDateInputValue } from '@/lib/mandate/mandate-term-window';

import { MANDATE_REQUEST_NS, SCREEN_KEYS } from './mandate-request-form-labels';

export interface MandateOccupancyPanelProps {
  readonly notice: MandateOccupancyNotice;
  /**
   * **Ταυτότητα οργανισμού → όνομα**, ή `null` όταν ο καλών δεν το ξέρει.
   *
   * 🔑 **Η άγνοια δηλώνεται, δεν μαντεύεται.** Η φόρμα ξέρει με βεβαιότητα **ένα**
   * όνομα — του γραφείου στο οποίο απευθύνεται ο άνθρωπος. Για τα υπόλοιπα λέει
   * *«Άλλο γραφείο»*, που είναι **αληθές και χρήσιμο**: ο ιδιοκτήτης μαθαίνει ότι
   * υπάρχει εμπόδιο και **ως πότε** — και τα ονόματα των εντολών του τα βλέπει
   * ολόκληρα στη σελίδα του ακινήτου, όπου ο διακομιστής μπορεί να τα λύσει.
   *
   * ⛔ **ΜΗΝ βάλεις εδώ αναζήτηση ονομάτων.** Θα ήταν δημόσιο ερώτημα καταλόγου
   * οργανισμών από πελάτη — ακριβώς η διαρροή που το §9.4 έκλεισε στο `agency-absent`.
   */
  readonly nameOf: (agencyCompanyId: string) => string | null;
  /**
   * Ο άνθρωπος αποδέχεται την προτεινόμενη έναρξη. `undefined` ⇒ καμία πρόταση.
   *
   * 🏆 **Το κουμπί ΕΙΝΑΙ η διαφορά από κάθε MLS**: η άρνηση παύει να είναι είδηση και
   * γίνεται **ενέργεια ενός πατήματος**.
   */
  readonly onScheduleFrom?: (yyyyMmDd: string) => void;
}

export function MandateOccupancyPanel({
  notice,
  nameOf,
  onScheduleFrom,
}: MandateOccupancyPanelProps): React.JSX.Element | null {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);

  // ⚠️ **Τίποτα στην οθόνη όταν δεν υπάρχει τίποτα να πει.** Ένα άδειο πλαίσιο
  //    «κανείς δεν κρατά» θα ήταν θόρυβος στη συνηθισμένη περίπτωση.
  if (notice.kind === 'free') return null;

  return (
    <section
      aria-live="polite"
      className="rounded-md border border-border bg-muted/40 p-3"
    >
      <h2 className="m-0 text-sm font-semibold text-foreground">
        {t(SCREEN_KEYS.occupancyTitle)}
      </h2>
      {/*
        🔴 **ΤΡΕΙΣ ΡΗΤΕΣ ΚΛΗΣΕΙΣ, ΟΧΙ `t(leadKeyFor(notice))`.** Η πρώτη γραφή περνούσε
        **παραγόμενο** κλειδί — και ο τεμαχιστής (ADR-744) το κατήγγειλε ονομαστικά:
        *«unresolved dynamic t()»*. Δηλαδή τα κλειδιά **δεν θα έμπαιναν στο route slice**
        και ο ιδιοκτήτης θα έβλεπε **ωμό κλειδί** — ενώ η CHECK 3.8, που ψάχνει
        κυριολεκτικό `t('…')`, θα έμενε **πράσινη**.

        ⛔ **ΔΕΝ το λύσαμε με δήλωση στο `dynamicKeyPolicy`.** Εκείνο είναι εξαίρεση που
        λέει *«εμπιστέψου με»*· αυτό εδώ είναι **απόδειξη**. Τρία `t(ΣΤΑΘΕΡΑ)` κοστίζουν
        τρεις γραμμές και τα βλέπει **κάθε** εργαλείο.
      */}
      <p className="mb-2 mt-1 text-sm text-muted-foreground">
        {notice.kind === 'blocked'
          ? t(SCREEN_KEYS.occupancyBlocked)
          : notice.kind === 'undetermined'
            ? t(SCREEN_KEYS.occupancyUndetermined)
            : t(SCREEN_KEYS.occupancyHeld)}
      </p>

      {notice.kind === 'occupied' && (
        <ul className="m-0 list-none space-y-1 p-0">
          {notice.held.map((occupancy) => (
            <li key={`${occupancy.agencyCompanyId}-${occupancy.scope.join()}`} className="text-sm text-foreground">
              <OccupancyLine occupancy={occupancy} nameOf={nameOf} />
            </li>
          ))}
        </ul>
      )}

      {notice.kind === 'blocked' && (
        <>
          <ul className="m-0 list-none space-y-1 p-0">
            {notice.conflicts.map((conflict) => (
              <li key={`${conflict.with.agencyCompanyId}-${conflict.resource}`} className="text-sm text-foreground">
                <OccupancyLine occupancy={conflict.with} nameOf={nameOf} resource={conflict.resource} />
                <span className="block text-xs text-muted-foreground">
                  {/* ⛔ Σταθερές, ποτέ `t(reasonKeyFor(…))` — δες παραπάνω. */}
                  {conflict.reason === EXISTING_IS_EXCLUSIVE
                    ? t(SCREEN_KEYS.occupancyReasonExisting)
                    : t(SCREEN_KEYS.occupancyReasonCandidate)}
                </span>
              </li>
            ))}
          </ul>
          <Remedy availableFrom={notice.availableFrom} onScheduleFrom={onScheduleFrom} />
        </>
      )}
    </section>
  );
}

/**
 * **Μία κατάληψη σε μία γραμμή** — ποιος, τι είδους, για ποια πράξη, ως πότε.
 *
 * ⚠️ **Η πράξη έρχεται από τη σύγκρουση όταν υπάρχει**, όχι από ολόκληρο το `scope`:
 * ο άνθρωπος που εμποδίζεται **μόνο** στην πώληση δεν πρέπει να διαβάσει ότι
 * εμποδίζεται και στην ενοικίαση.
 */
function OccupancyLine({
  occupancy,
  nameOf,
  resource,
}: {
  occupancy: MandateOccupancy;
  nameOf: (agencyCompanyId: string) => string | null;
  resource?: MandateConflict['resource'];
}): React.JSX.Element {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);

  const agency = nameOf(occupancy.agencyCompanyId) ?? t(SCREEN_KEYS.occupancyHolderOther);
  const kinds = resource === undefined ? occupancy.scope : [resource];
  const values = {
    agency,
    agreement: t(LISTING_AGREEMENT_I18N_KEYS[occupancy.agreement]),
    // ⚠️ Ευρετηρίαση **σταθεράς module**, ποτέ `t(\`…${kind}\`)` — αλλιώς ο τεμαχιστής
    //    βγάζει «unresolved dynamic t()» και το κλειδί λείπει από το slice.
    //
    // 🔴 **ΤΟ ΚΕΝΟ ΕΙΧΕ ΟΝΟΜΑ ΓΙΑ ΤΟΝ ΚΑΤΟΧΟ ΚΑΙ ΔΕΝ ΕΙΧΕ ΓΙΑ ΤΙΣ ΠΡΑΞΕΙΣ**
    //    (ADR-834 §6.5). Το κληροδοτημένο έγγραφο (προ-ADR-832) έχει `scope: []`, και
    //    το `join` σε κενό πίνακα δίνει **κενή συμβολοσειρά** — η οθόνη τύπωνε
    //    *«Άλλο γραφείο — Αποκλειστική, με δικαίωμα του ιδιοκτήτη για , ως 2027-04-30»*,
    //    δηλαδή **παρουσίαζε την άγνοια ως έγκυρη λίστα**. Η γραμμή από πάνω κάνει ήδη
    //    ακριβώς το σωστό για το άγνωστο **όνομα** (`?? occupancyHolderOther`)· η
    //    άγνοια για τις **πράξεις** έμενε ανώνυμη. Πλέον ονομάζεται.
    resource:
      kinds.length === 0
        ? t(SCREEN_KEYS.occupancyScopeUnknown)
        : kinds.map((kind) => t(OFFER_KIND_I18N_KEYS[kind])).join(' · '),
    until: formatTermDay(occupancy.expiresAt),
  };

  return (
    <span>
      {occupancy.expiresAt === null
        ? t(SCREEN_KEYS.occupancyEntryOpen, values)
        : t(SCREEN_KEYS.occupancyEntry, values)}
    </span>
  );
}

/**
 * 🏆 **Η ΔΙΕΞΟΔΟΣ** — ημερομηνία και κουμπί, ή η ειλικρινής απουσία τους.
 *
 * ⚠️ **Δύο διαφορετικά μηνύματα, όχι ένα με `if`**: *«περίμενε ως τότε»* και *«η
 * αναμονή δεν βοηθά, ζήτα απλή»* στέλνουν τον άνθρωπο σε **αντίθετες** ενέργειες.
 */
function Remedy({
  availableFrom,
  onScheduleFrom,
}: {
  availableFrom: string | null;
  onScheduleFrom?: (yyyyMmDd: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);

  if (availableFrom === null) {
    return <p className="m-0 mt-2 text-xs text-muted-foreground">{t(SCREEN_KEYS.occupancyNoWait)}</p>;
  }

  // 🔑 **Η επομένη της λήξης**, όχι η ημέρα της λήξης: το διάστημα είναι ημι-ανοιχτό
  //    `[από, ως)` και η λήξη γράφεται ως `23:59:59.999` της τελευταίας ημέρας — άρα
  //    η ίδια ημέρα **επικαλύπτεται**. Ένα `slice(0,10)` σκέτο θα πρότεινε ημερομηνία
  //    που ο ίδιος ο κριτής θα απέρριπτε, και ο άνθρωπος θα έβλεπε την πλατφόρμα να
  //    αντιφάσκει με τον εαυτό της.
  const dayAfter = nextDay(availableFrom);

  return (
    <p className="m-0 mt-2 text-xs text-muted-foreground">
      {t(SCREEN_KEYS.occupancyAvailableFrom, { date: dayAfter })}{' '}
      {onScheduleFrom !== undefined && (
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-4"
          onClick={() => onScheduleFrom(dayAfter)}
        >
          {t(SCREEN_KEYS.occupancyAvailableAction, { date: dayAfter })}
        </button>
      )}
    </p>
  );
}

/**
 * ISO στιγμή → `yyyy-mm-dd` της **επόμενης** ημέρας.
 *
 * ⚠️ **Αριθμητική σε UTC χιλιοστά, ποτέ τοπικό ημερολόγιο**: `getDate() + 1` διαβάζει
 * τη ζώνη του φυλλομετρητή και μετακινεί την ημερομηνία κατά μία ημέρα για κάθε
 * χρήστη ανατολικά ή δυτικά — το ίδιο μάθημα που έχει ήδη γράψει το
 * `mandate-term-window.ts`.
 */
function nextDay(isoInstant: string): string {
  const at = Date.parse(isoInstant);
  if (Number.isNaN(at)) return toDateInputValue(isoInstant);
  return toDateInputValue(new Date(at + 24 * 60 * 60 * 1000).toISOString());
}
