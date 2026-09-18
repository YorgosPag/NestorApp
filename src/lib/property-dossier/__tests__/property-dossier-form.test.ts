/**
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α37.7 του ADR-866 Φ1.2** — η φόρμα και η πόρτα απαντούν τα **ίδια** invariants.
 * @related ADR-866 §2.9.1 Α5 · lib/property-dossier/property-dossier-form.ts · types/property-dossier.ts
 *
 * 🔑 Η άγκυρα **δεν** αντιγράφει τους κανόνες: για κάθε όνομα ρωτά **και** τη φόρμα **και** τη συνάρτηση της πόρτας
 * (`propertyDossierInvariantViolations`) και απαιτεί **ίδια** απάντηση. Ένας δεύτερος κριτής στη φόρμα (π.χ. `min(1)`
 * ή άλλο μέγιστο μήκος) κοκκινίζει εδώ, πριν ο άνθρωπος δει «αποθηκεύτηκε…» και μετά άρνηση.
 */

import {
  EMPTY_PROPERTY_DOSSIER_FORM,
  propertyDossierFormFrom,
  validatePropertyDossierForm,
} from '@/lib/property-dossier/property-dossier-form';
import { PROPERTY_DOSSIER_LABEL_MAX, propertyDossierInvariantViolations } from '@/types/property-dossier';

const LABELS = ['', '   ', 'Σπίτι', '  Σπίτι  ', 'α'.repeat(PROPERTY_DOSSIER_LABEL_MAX), 'α'.repeat(PROPERTY_DOSSIER_LABEL_MAX + 1)];

describe('🏆 Α37.7 — φόρμα ≡ πόρτα', () => {
  it.each(LABELS.map((label) => [JSON.stringify(label).slice(0, 24), label] as const))('όνομα %s', (_name, label) => {
    const form = validatePropertyDossierForm({ label, type: '' });
    const door = propertyDossierInvariantViolations({ label, type: null });

    expect(form.kind === 'ready' ? [] : form.violations).toEqual(door);
  });
});

describe('Α37.7 — είδος', () => {
  it('κενό ⇒ `null` (προαιρετικό — ο φάκελος υπάρχει πριν αποφασιστεί το είδος)', () => {
    const form = validatePropertyDossierForm({ label: 'Σπίτι', type: '' });
    expect(form).toEqual({ kind: 'ready', draft: { label: 'Σπίτι', type: null } });
  });

  it('κανονικό είδος περνά αυτούσιο — και η γη (φάκελος οικοπέδου)', () => {
    expect(validatePropertyDossierForm({ label: 'Χωράφι', type: 'plot' })).toEqual({
      kind: 'ready',
      draft: { label: 'Χωράφι', type: 'plot' },
    });
  });

  it('άγνωστο είδος ⇒ `null`, ποτέ ωμή συμβολοσειρά προς την πόρτα', () => {
    const form = validatePropertyDossierForm({ label: 'Σπίτι', type: 'castle' });
    expect(form.kind === 'ready' && form.draft.type).toBeNull();
  });
});

describe('Α37.7 — αρχικές τιμές', () => {
  it('γέννηση: κενή φόρμα', () => {
    expect(EMPTY_PROPERTY_DOSSIER_FORM).toEqual({ label: '', type: '' });
  });

  it('μετονομασία: ξεκινά από ό,τι ΕΙΝΑΙ ο φάκελος (`null` είδος ⇒ κενό)', () => {
    expect(propertyDossierFormFrom({ label: 'Σπίτι', type: null })).toEqual({ label: 'Σπίτι', type: '' });
    expect(propertyDossierFormFrom({ label: 'Σπίτι', type: 'villa' })).toEqual({ label: 'Σπίτι', type: 'villa' });
  });
});
