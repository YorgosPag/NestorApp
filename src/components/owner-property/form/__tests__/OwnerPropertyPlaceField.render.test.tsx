/**
 * @fileoverview **Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ ΟΤΑΝ Η ΟΘΟΝΗ ΕΔΕΙΞΕ «Build Error»** — ADR-777 §8.47.
 * @related components/owner-property/form/OwnerPropertyPlaceField · hooks/geo/usePlaceResolver
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (2026-09-02)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μια τοπική μεταβλητή γράφτηκε με **ίδιο όνομα με την παράμετρο** της συνάρτησης
 * (`const query = …` μέσα σε `async (query: string) => …`) ⇒ *«cannot reassign to a
 * variable declared with `const`»*. Η οθόνη έδειξε **Build Error**.
 *
 * **659 άγκυρες ήταν πράσινες.** Ο λόγος είναι ένας και δομικός: **καμία τους δεν
 * εισήγαγε το αρχείο**. Ο `usePlaceResolver` και αυτό το πεδίο δεν είχαν κανέναν
 * καταναλωτή σε φάκελο `__tests__` — δηλαδή ο κώδικας δεν **εκτελούνταν** ποτέ έξω από
 * τον περιηγητή, και το μόνο όργανο που τον έβλεπε ήταν το **περπάτημα**.
 *
 * 🔑 **Τι φυλάει αυτό το αρχείο**: ότι ολόκληρη η αλυσίδα εισαγωγών
 * *(πεδίο → `usePlaceResolver` → `address-line-query` → `address-parse` →
 * `house-number-standing`)* **φορτώνει και τρέχει**. Δεν κρίνει σχεδίαση — κρίνει
 * **ύπαρξη**, που είναι ακριβώς ό,τι έλειπε.
 *
 * ⚠️ **Το `t()` επιστρέφει το κλειδί επίτηδες** — ίδιο ιδίωμα με το
 * `PlaceIdentityField.render.test.tsx`: κάνει τα κλειδιά ορατά στο DOM, ώστε η παρουσία
 * τους να είναι μονοσήμαντη απόδειξη ότι το υποδέντρο ζωγραφίστηκε.
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import '@testing-library/jest-dom';

import { OwnerPropertyPlaceField } from '../OwnerPropertyPlaceField';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

/** Ο επιλογέας τόπου σέρνει MapLibre — κρίνεται από τη δική του άγκυρα. */
jest.mock('@/components/geo/PlaceIdentityField', () => ({
  PlaceIdentityField: () => <div data-testid="place-identity" />,
}));

/** Το ραδιόφωνο «θα δηλώσω / δεν θέλω» ζει στα κοινά πεδία της φόρμας. */
jest.mock('../OwnerPropertyFields', () => ({
  OwnerPlaceAnswerField: () => <div data-testid="answer-field" />,
}));

/**
 * 🔴 **ΤΟ ΥΠΟΚΑΤΑΣΤΑΤΟ ΚΡΙΝΕΙ ΤΗΝ ΑΠΟΔΟΣΗ — ΚΑΙ ΜΟΝΟ ΑΥΤΗΝ** *(ADR-846 §8.9)*.
 *
 * Το αληθινό `CoverageReachNotice` σέρνει **συνδρομή Firestore** *(η βιτρίνα)* και δύο
 * τεμπέλικα JSON *(αποτυπώματα · ιεραρχία)*. Η ερώτηση εδώ όμως είναι **πριν** από
 * όλα αυτά: ο φρουρός `{brokered && …}` κρίνεται σε χρόνο απόδοσης, **πάνω** από το
 * `next/dynamic`, άρα ένα υποκατάστατο απαντά **ακριβώς** την ερώτηση που ρωτάμε.
 *
 * ⛔ **ΚΑΙ ΔΕΝ ΑΠΑΝΤΑ ΤΗΝ ΑΛΛΗ.** Στη Φάση 6 υπάρχουν **δύο** εγγυήσεις:
 *
 * | Εγγύηση | Ποιος τη φυλάει |
 * |---|---|
 * | **δεν ζωγραφίζεται** όταν `brokered={false}` | **αυτό εδώ** *(Κ2)* |
 * | **δεν στέλνεται** στην κλειστότητα της σελίδας του ιδιώτη | **CHECK 3.34** *(μέγεθος)* |
 *
 * Η δεύτερη είναι ο λόγος που η εισαγωγή είναι `next/dynamic` *(18.964 > 18.370 bytes)*
 * και **δεν** κρίνεται εδώ: με υποκατάστατο δεν υπάρχει chunk να μετρηθεί. Μια άγκυρα
 * που υπονοούσε ότι καλύπτει και τις δύο θα ήταν **χειρότερη από καμία** — θα έδινε
 * άδεια σε κάποιον να γυρίσει το `dynamic` σε στατική εισαγωγή «αφού είναι πράσινο».
 */
jest.mock('@/components/mandate/CoverageReachNotice', () => ({
  CoverageReachNotice: () => <div data-testid="coverage-reach-notice" />,
}));

interface HarnessProps {
  readonly answer: 'declared' | 'declined';
  /** Η προεπιλογή είναι **ο ιδιώτης** — ίδια με του ίδιου του component. */
  readonly brokered?: boolean;
}

/** Η φόρμα είναι **προϋπόθεση** του πεδίου: χωρίς context το `useFormContext` πέφτει. */
function Harness({ answer, brokered = false }: HarnessProps): React.ReactElement {
  const form = useForm({
    defaultValues: {
      placeAnswer: answer,
      placeQuery: '',
      placeRef: null,
      placePoint: null,
      placeAccuracy: null,
    },
  });
  return (
    <FormProvider {...form}>
      <OwnerPropertyPlaceField brokered={brokered} />
    </FormProvider>
  );
}

/**
 * **Δίνει στο `next/dynamic` την ευκαιρία του — και είναι ΠΡΟΫΠΟΘΕΣΗ της άρνησης.**
 *
 * 🔴 Χωρίς αυτό η Κ2/1 θα ήταν **πράσινη για λάθος λόγο**: το δυναμικό υποδέντρο είναι
 * `null` στο πρώτο καρέ **ούτως ή άλλως**, οπότε ένα σκέτο `queryByTestId` αμέσως μετά
 * το `render` θα έμενε πράσινο **ακόμη κι αν ο φρουρός είχε αφαιρεθεί**. Η ίδια
 * αναμονή τρέχει **και** στον παρονομαστή, όπου αποδεδειγμένα **αρκεί** — άρα η απουσία
 * μετά από αυτήν είναι απουσία, όχι βιασύνη.
 */
async function settleDynamicImport(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

// =============================================================================
// Κ1 — Η ΑΛΥΣΙΔΑ ΕΙΣΑΓΩΓΩΝ ΤΡΕΧΕΙ
// =============================================================================

describe('Κ1 — το πεδίο θέσης φορτώνει και ζωγραφίζει', () => {
  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: ξαναγράψε τη μεταβλητή του `usePlaceResolver` ως `const query = …`
   * (ίδιο όνομα με την παράμετρο) ⇒ **κόκκινο εδώ**, ενώ πριν από αυτό το αρχείο
   * ολόκληρη η σουίτα έμενε πράσινη και το έβλεπε **μόνο ο περιηγητής**.
   */
  it('ζωγραφίζει το πεδίο διεύθυνσης όταν ο άνθρωπος δήλωσε ότι θα πει τη θέση', () => {
    render(<Harness answer="declared" />);

    expect(screen.getByText('property-market:offer.form.placeQueryLabel')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'property-market:offer.form.placeResolve' }),
    ).toBeInTheDocument();
  });

  it('σιωπά όταν ο άνθρωπος δεν θέλει να πει τη θέση — η φόρμα μικραίνει (Α14 §17.2)', () => {
    render(<Harness answer="declined" />);

    expect(screen.queryByText('property-market:offer.form.placeQueryLabel')).toBeNull();
    expect(
      screen.getByText('property-market:offer.form.placeDeclinedNote'),
    ).toBeInTheDocument();
  });

  /**
   * 🔑 **Χωρίς εντοπισμένο σημείο ΔΕΝ υπάρχει πλαίσιο επιβεβαίωσης** — ούτε βαθμός
   * ακρίβειας, ούτε γραμμή για τον αριθμό. Η οθόνη δεν επιτρέπεται να λέει τίποτα για
   * μια απάντηση που δεν ήρθε.
   */
  it('χωρίς απάντηση παρόχου δεν εμφανίζεται καμία πρόταση για τον αριθμό', () => {
    render(<Harness answer="declared" />);

    expect(
      screen.queryByText(/placeHouseNumber/),
    ).toBeNull();
  });
});

// =============================================================================
// Κ2 — Ο ΦΡΟΥΡΟΣ ΤΟΥ ΑΚΡΟΑΤΗΡΙΟΥ: Η ΚΑΛΥΨΗ ΕΙΝΑΙ ΕΝΝΟΙΑ ΤΟΥ ΓΡΑΦΕΙΟΥ (ADR-846 §8.9)
// =============================================================================

describe('Κ2 — η προειδοποίηση κάλυψης ζωγραφίζεται μόνο για το γραφείο', () => {
  /**
   * 🔴 **Η ΕΓΓΥΗΣΗ ΠΟΥ ΕΩΣ ΣΗΜΕΡΑ ΕΙΧΕ ΜΟΝΟ ΧΕΙΡΟΚΙΝΗΤΗ ΜΑΡΤΥΡΙΑ.**
   *
   * Για τον ιδιώτη κάτοχο η ερώτηση *«είναι εκτός των περιοχών σου;»* **δεν έχει
   * υποκείμενο** — δεν δηλώνει περιοχές δραστηριοποίησης. Η μόνη απόδειξη ήταν ένα
   * ζωντανό περπάτημα *(2026-09-10: ίδια διεύθυνση, δύο οθόνες)*, δηλαδή **απόδειξη
   * μιας στιγμής**, όχι φρουρός.
   *
   * ⛔ **ΜΕΤΑΛΛΑΞΗ, ΕΚΤΕΛΕΣΜΕΝΗ**: αφαίρεση του `brokered &&` στο
   * `OwnerPropertyPlaceField` ⇒ **κόκκινο εδώ** *(«expected null, received element»)*.
   */
  it('σιωπά για τον ιδιώτη — brokered={false}, η προεπιλογή', async () => {
    render(<Harness answer="declared" brokered={false} />);
    await settleDynamicImport();

    expect(screen.queryByTestId('coverage-reach-notice')).toBeNull();
  });

  /**
   * 🔒 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — ΧΩΡΙΣ ΑΥΤΟΝ Η ΑΓΚΥΡΑ ΕΙΝΑΙ ΚΕΝΗ.**
   *
   * Ένα υποκατάστατο που δεν αποδίδεται **ποτέ** *(λάθος διαδρομή στο `jest.mock`,
   * μετονομασμένο `data-testid`, δυναμική εισαγωγή που δεν προλαβαίνει)* θα άφηνε το
   * παραπάνω πράσινο **για λάθος λόγο**. Ίδιο μάθημα με τη **Γ3** του
   * `coverage-reach.test.ts`: μια άρνηση αξίζει όσο η κατάφασή της.
   */
  it('ζωγραφίζει για το γραφείο — brokered', async () => {
    render(<Harness answer="declared" brokered />);
    await settleDynamicImport();

    expect(screen.getByTestId('coverage-reach-notice')).toBeInTheDocument();
  });

  /**
   * ⚠️ **Η ΑΡΝΗΣΗ ΤΟΠΟΥ ΥΠΕΡΙΣΧΥΕΙ ΤΟΥ ΑΚΡΟΑΤΗΡΙΟΥ.** Η προειδοποίηση κρίνει **τη
   * διεύθυνση που μόλις επιβεβαιώθηκε**· όταν δεν δηλώθηκε καμία, ολόκληρο το υποδέντρο
   * λείπει *(Α14 §17.2: «η φόρμα μικραίνει»)* — και μαζί του η ερώτηση.
   */
  it('σιωπά και για το γραφείο όταν ο άνθρωπος δεν δήλωσε θέση', async () => {
    render(<Harness answer="declined" brokered />);
    await settleDynamicImport();

    expect(screen.queryByTestId('coverage-reach-notice')).toBeNull();
  });
});
