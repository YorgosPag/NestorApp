/**
 * Η πρόταση «Νέα ιδιότητα από τη γραμμή» (ADR-923 §5.5.2 Β3 Γ7): ό,τι γεμίζει η φόρμα, ποτέ ό,τι αποθηκεύεται. Καθαρό.
 */

import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import { suggestAttributeFromLine } from '../suggest-attribute-from-line';

describe('§5.5.2 Β3 — πρόταση νέας ιδιότητας από γραμμή της πηγής', () => {
  it('🔴 η μονάδα που τυπώνει η γραμμή δίνει οικογένεια μέτρησης, και φεύγει από το όνομα', () => {
    const suggestion = suggestAttributeFromLine({ label: 'ΠΑΡΟΧΗ ΑΕΡΑ · Μ · m³/h', values: ['280', '340', '520'] }, PLATFORM_MEASUREMENT_REGISTRY);
    expect(suggestion.measurement).toEqual({ familyCode: 'volume_flow', unitCode: 'm3_h' });
    expect(suggestion.label).toBe('ΠΑΡΟΧΗ ΑΕΡΑ Μ');
    expect(suggestion.code).not.toBe('');
    expect(suggestion.numeric).toBe(true);
  });

  it('🔴 Μ13: διαφορετική τιμή ανά παραλλαγή ⇒ ανά κωδικό· ίδια παντού ⇒ κοινή', () => {
    expect(suggestAttributeFromLine({ label: 'ΒΑΡΟΣ · kg', values: ['14,5', '16'] }, PLATFORM_MEASUREMENT_REGISTRY).level).toBe('leaf');
    expect(suggestAttributeFromLine({ label: 'ΗΛΕΚΤΡΙΚΗ ΠΑΡΟΧΗ', values: ['230V-50Hz-1Ph'] }, PLATFORM_MEASUREMENT_REGISTRY).level).toBe('shared');
  });

  it('τα δεκαδικά είναι τα περισσότερα που τυπώνονται', () => {
    expect(suggestAttributeFromLine({ label: 'ΒΑΡΟΣ · kg', values: ['14,5', '16', '18,25'] }, PLATFORM_MEASUREMENT_REGISTRY).decimals).toBe(2);
  });

  it('κείμενο χωρίς αριθμούς ⇒ καμία μέτρηση, όσο κι αν μοιάζει η ετικέτα', () => {
    const suggestion = suggestAttributeFromLine({ label: 'ΣΥΝΔΕΣΕΙΣ ΝΕΡΟΥ', values: ['3/4"', '3/4"'] }, PLATFORM_MEASUREMENT_REGISTRY);
    expect(suggestion.measurement).toBeNull();
    expect(suggestion.numeric).toBe(false);
  });

  it('αριθμοί χωρίς τυπωμένη μονάδα ⇒ αριθμός, ποτέ μαντεμένη μονάδα (σφάλμα ×1000)', () => {
    const suggestion = suggestAttributeFromLine({ label: 'ΑΡΙΘΜΟΣ ΤΑΧΥΤΗΤΩΝ', values: ['3', '3'] }, PLATFORM_MEASUREMENT_REGISTRY);
    expect(suggestion.measurement).toBeNull();
    expect(suggestion.numeric).toBe(true);
  });
});
