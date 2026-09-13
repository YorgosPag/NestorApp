'use client';

/**
 * @fileoverview **ΤΟ ΟΡΓΑΝΟ ΤΟΥ ΩΦΕΛΙΜΟΥ ΠΛΑΤΟΥΣ** — η αληθινή φόρμα, σε δηλωμένα πλάτη.
 * @related AddressWithHierarchy · AddressEditor · address-field-widths · ADR-332 D27 Ζ7
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΣΕΛΙΔΑ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Στις 2026-09-13 μετρήθηκε ζωντανά ότι τα πεδία **Οδός / Αριθμός / Τ.Κ.** έφταναν σε
 * **ωφέλιμο πλάτος ΜΗΔΕΝ** σε στενή στήλη — **ο άνθρωπος δεν έβλεπε τι έγραφε**.
 * **703 tests ήταν πράσινα.** Και δεν ήταν ατύχημα:
 *
 * - Τα tests των **δύο** πραγματικά στενών σημείων (`ProjectLocationsTab.proximity`,
 *   `FrontageAddressCreateDialog.proximity`) κάνουν `jest.mock` σε **ΟΛΟΚΛΗΡΟ** το
 *   `@/components/shared/addresses/editor` ⇒ ο editor επιστρέφει `null`.
 * - Το `AddressesSectionWithFullscreen.placement` mock-άρει το `AddressWithHierarchy`
 *   ως `() => null`.
 * - ⚠️ Και **δεν θα μπορούσαν**: το **jsdom δεν έχει διάταξη**. Ένα jest test εδώ μπορεί
 *   να ελέγξει μόνο **ονόματα κλάσεων** — δηλαδή θα «περνούσε» και με σπασμένη διάταξη.
 *
 * 🔑 **Ο δηλωμένος λόγος αυτής της πύλης — «ο άνθρωπος βλέπει τι γράφει» — μετριέται
 * ΜΟΝΟ σε πραγματικό browser.** Γι' αυτό η σελίδα αποδίδει τον **αληθινό** `AddressEditor`
 * με τα **αληθινά** του children, χωρίς ούτε ένα mock.
 *
 * ⚠️ **Η σελίδα ΔΕΝ κρίνει.** Παράγει αριθμούς· η ετυμηγορία ζει στην πύλη Playwright και
 * το κατώφλι στο `address-field-widths.ts` — **το ίδιο** αρχείο που διαβάζει ο κώδικας.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { AddressEditor } from '@/components/shared/addresses/editor';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import I18nProvider from '@/components/providers/I18nProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isUnresolvedTranslation } from '@/i18n/unresolved-key';

import {
  MEASURED_ATTRIBUTE,
  RESULTS_ELEMENT_ID,
  WIDTH_CASES,
  type FieldWidthResult,
} from './address-field-width-cases';
import { measureCase, measureWhenSettled } from './measure-field-widths';
import styles from './address-field-width.module.css';

/**
 * 🔴 **ΑΔΕΙΑ ΦΟΡΜΑ — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΧΕΙΡΟΤΕΡΟ ΣΕΝΑΡΙΟ, ΟΧΙ ΤΟ ΕΥΚΟΛΟΤΕΡΟ.**
 *
 * Με άδειες τιμές και `phase: 'idle'`, το `useAddressFieldStatus` δίνει σε **κάθε** πεδίο
 * `kind: 'not-provided'` ⇒ το badge γράφει **«Δεν συμπληρώθηκε»**: **16 χαρακτήρες**, το
 * **πλατύτερο** από τα πέντε (`Ταιριάζει` 9 · `Ασυμφωνία` 9 · `Άγνωστο` 7 · `Αναζήτηση…` 12).
 *
 * ⚠️ Η αρχική ζωντανή μέτρηση έγινε με το **«Ταιριάζει»** (90 px). Μια πύλη που δοκίμαζε
 * εκείνο θα περνούσε και θα άφηνε την παραγωγή να σπάει στο πλατύτερο — ακριβώς το σχήμα
 * «ο λόγος μη διακρίσιμος». Εδώ το χειρότερο badge είναι το **προεπιλεγμένο**, και
 * προκύπτει **χωρίς δίκτυο και χωρίς mock**: απλώς δεν έχει συμπληρωθεί τίποτα.
 */
const EMPTY_HIERARCHY: AddressWithHierarchyValue = {
  street: '',
  number: '',
  postalCode: '',
  settlementId: null,
  settlementName: '',
  country: 'GR',
};

function WidthCaseForm({ widthPx }: { readonly widthPx: number }) {
  const [hierarchy, setHierarchy] = useState<AddressWithHierarchyValue>(EMPTY_HIERARCHY);
  return (
    <div className={styles.caseBody} style={{ width: `${widthPx}px` }}>
      <AddressEditor
        value={{}}
        onChange={() => undefined}
        mode="edit"
        domain="contact"
        /*
          ⚠️ **Ακριβώς οι επιλογές της παραγωγής.** Και τα πέντε σημεία κλήσης
          (`AddressesSectionWithFullscreen` · `CompanyAddressesSection` · `LocationInlineForm`
          · `FrontageAddressCreateDialog` · `BuildingAddressesEditor`) περνούν `hideGrid: true`.
          Το `showNeighborhoodRegion` φέρνει **επιπλέον** το `FormFieldRow` («Περιοχή /
          Συνοικία») — το μόνο σημείο όπου εκείνο ζει στην παραγωγή. Δύο υλοποιήσεις της
          ίδιας γραμμής, **και οι δύο** μετρημένες εδώ.
        */
        formOptions={{ hideGrid: true, showNeighborhoodRegion: true }}
        activityLog={{ collapsed: true }}
      >
        <AddressWithHierarchy value={hierarchy} onChange={setHierarchy} />
      </AddressEditor>
    </div>
  );
}

/** Το κλειδί του **πλατύτερου** σήματος — και το καμπανάκι ότι η γλώσσα φόρτωσε. */
const WIDEST_BADGE_KEY = 'editor.field.badge.notProvided';

function AddressFieldWidthHarnessBody() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<FieldWidthResult[] | null>(null);
  const startedRef = useRef(false);
  const { t } = useTranslation('addresses');

  const readAll = useCallback((): FieldWidthResult[] => {
    const root = rootRef.current;
    if (!root) return [];
    /*
      🔴 **ΑΡΝΗΣΗ ΜΕΤΡΗΣΗΣ ΟΣΟ Η ΓΛΩΣΣΑ ΔΕΝ ΦΟΡΤΩΣΕ — ΜΕΤΡΗΜΕΝΟ ΓΙΑΤΙ ΣΥΝΕΒΗ.**

      Πρώτη εκτέλεση της πύλης (2026-09-13): τα σήματα έδειχναν **ωμό κλειδί**
      (`editor.field.badge.notProvided`, **30** χαρακτήρες αντί για 16). Η μέτρηση
      «δούλεψε» και παρήγαγε **εύλογους** αριθμούς για πλάτος που **κανείς δεν βλέπει** —
      το ίδιο σχήμα με το κάδρο `958×0` του CHECK 3.77.

      ⚠️ Η κρίση «είναι ωμό κλειδί;» **δεν ξαναγράφεται εδώ**: ζει στο
      `i18n/unresolved-key` (ADR-798 §13), και το `result !== key` που φαίνεται προφανές
      είναι **λάθος** για κλειδιά με πρόθεμα namespace — πληρωμένο περιστατικό.
    */
    if (isUnresolvedTranslation(t(WIDEST_BADGE_KEY), WIDEST_BADGE_KEY)) return [];
    return WIDTH_CASES.flatMap(widthCase => {
      const section = root.querySelector<HTMLElement>(`[data-width-case="${widthCase.id}"]`);
      return section ? measureCase(section, widthCase) : [];
    });
  }, [t]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void measureWhenSettled(readAll, WIDTH_CASES.length).then(setRows);
  }, [readAll]);

  return (
    <main className={styles.page}>
      <h1>Ωφέλιμο πλάτος πεδίων διεύθυνσης — μετρημένο, όχι γραμμένο</h1>
      <p>
        Κάθε ενότητα είναι η <strong>αληθινή</strong> φόρμα διεύθυνσης, με τις επιλογές που
        περνούν και τα πέντε σημεία της παραγωγής, σε <strong>δηλωμένο πλάτος στήλης</strong>.
        Μετριέται το <code>clientWidth − padding</code> κάθε πεδίου, σε{' '}
        <strong>χαρακτήρες</strong> — γιατί η ερώτηση δεν είναι «πόσα pixel;» αλλά{' '}
        <strong>«χωράει αυτό που κρατά το πεδίο;»</strong>.
      </p>

      <section aria-live="polite">
        {rows === null ? (
          <p data-testid="address-field-width-pending">Μετράει…</p>
        ) : (
          <table className={styles.table}>
            <caption>{rows.length} μετρήσεις σε {WIDTH_CASES.length} πλάτη</caption>
            <thead>
              <tr>
                <th scope="col">Πλάτος</th>
                <th scope="col">Πεδίο</th>
                <th scope="col">Ωφέλιμο (px)</th>
                <th scope="col">Χαρακτήρες</th>
                <th scope="col">Σήμα</th>
                <th scope="col">Σήμα (px)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={`${row.caseId}-${row.field}`}>
                  <td>{row.caseWidthPx}</td>
                  <td>{row.field}</td>
                  <td className={styles.numeric}>{row.usablePx}</td>
                  <td className={styles.numeric}>{row.usableChars}</td>
                  <td>{row.badgeText}</td>
                  <td className={styles.numeric}>{row.badgePx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {rows !== null && (
        <script
          type="application/json"
          id={RESULTS_ELEMENT_ID}
          // eslint-disable-next-line react/no-danger -- δικά μας δεδομένα, σε `application/json` που ΔΕΝ εκτελείται
          dangerouslySetInnerHTML={{ __html: JSON.stringify(rows) }}
        />
      )}

      <div ref={rootRef} {...{ [MEASURED_ATTRIBUTE]: rows !== null ? 'true' : 'false' }}>
        {WIDTH_CASES.map(widthCase => (
          <section
            key={widthCase.id}
            data-width-case={widthCase.id}
            className={styles.caseFrame}
          >
            <h2 className={styles.caseTitle}>
              {widthCase.id} — {widthCase.widthPx}px
            </h2>
            <p className={styles.note}>{widthCase.why}</p>
            <WidthCaseForm widthPx={widthCase.widthPx} />
          </section>
        ))}
      </div>
    </main>
  );
}

/**
 * 🔑 **Ο `I18nProvider` μπαίνει ΕΔΩ, όχι στο `(bare)/layout`.**
 *
 * Το `(bare)` είναι **σκόπιμα** γυμνό — «καμία μπάρα, κανένα sidebar, **καμία γλώσσα**»
 * (ADR-775 §13): ό,τι μπαίνει στο κάδρο ενός golden image και δεν το ζωγράφισε ο ζωγράφος
 * είναι μελλοντικό ψευδώς-θετικό. Το να προσθέσω γλώσσα στο **layout** θα άλλαζε τις
 * συνθήκες των **43** visual tests του DXF για χάρη αυτής της μιας σελίδας.
 *
 * Εδώ όμως η γλώσσα **είναι η μέτρηση**: το ωφέλιμο πλάτος είναι ό,τι περισσεύει αφού
 * πάρει τον χώρο του το κείμενο του σήματος. ⇒ Η σελίδα φέρνει **τη δική της** γλώσσα,
 * και το `(bare)` μένει γυμνό για όλους τους άλλους.
 */
export default function AddressFieldWidthHarness() {
  return (
    <I18nProvider>
      <AddressFieldWidthHarnessBody />
    </I18nProvider>
  );
}
