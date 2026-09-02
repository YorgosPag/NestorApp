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
import { render, screen } from '@testing-library/react';
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

interface HarnessProps {
  readonly answer: 'declared' | 'declined';
}

/** Η φόρμα είναι **προϋπόθεση** του πεδίου: χωρίς context το `useFormContext` πέφτει. */
function Harness({ answer }: HarnessProps): React.ReactElement {
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
      <OwnerPropertyPlaceField />
    </FormProvider>
  );
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
