/**
 * Επιλογές τύπου σχέσης ανά διασταύρωση (ADR-372) — καμία χωρίς ετικέτα (ADR-327, 2026-10-28).
 *
 * 🔴 Η αφορμή: ο πίνακας ADR-372 επιτρέπει τους τύπους ακινήτου (ADR-244) σε κάθε διασταύρωση εταιρείας/φυσικού
 * προσώπου, αλλά το `VISUAL_REGISTRY` τους εξαιρεί ρητά («managed by the property module»). Ο κλάδος μόνο-πηγής
 * φιλτράριζε, ο κλάδος διασταύρωσης ΟΧΙ ⇒ `property_buyer` ωμό στο dropdown εταιρεία → φυσικό πρόσωπο
 * (φόρμα σχέσεων επαφής ΚΑΙ πρόταση υπογράφοντα στον έλεγχο σάρωσης προσφοράς).
 */

/* global describe, it, expect */

import type { ContactType } from '@/types/contacts/contracts';
import { getRelationshipTypeOptions } from '../relationship-form-presets';
import { getAvailableRelationshipTypes, getRelationshipTypeConfig } from '../../utils/relationship-types';

const echo = (key: string): string => key;
const TYPES: ContactType[] = ['individual', 'company', 'service'];

describe('getAvailableRelationshipTypes — διασταύρωση', () => {
  it('🔴 Τ1 — σε ΚΑΘΕ διασταύρωση, κάθε τύπος έχει ετικέτα (κανένας τύπος ακινήτου)', () => {
    for (const source of TYPES) {
      for (const target of TYPES) {
        for (const type of getAvailableRelationshipTypes(source, target)) {
          expect([source, target, type, getRelationshipTypeConfig(type)?.label ?? null])
            .toEqual([source, target, type, expect.stringMatching(/^relationships\.types\./)]);
        }
      }
    }
  });

  it('🔴 Τ2 — εταιρεία → φυσικό πρόσωπο (υπογράφων προσφοράς): ούτε ωμό κλειδί, ούτε `property_*`', () => {
    const options = getRelationshipTypeOptions('company', echo, undefined, 'individual');
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.value).not.toMatch(/^property_/);
      expect(option.label).toMatch(/^relationships\.types\./);
    }
  });

  it('Τ3 — η αποθηκευμένη τιμή εκτός λίστας μπαίνει πρώτη, με ετικέτα (συμβόλαιο που διατηρείται)', () => {
    const options = getRelationshipTypeOptions('company', echo, 'family', 'individual');
    expect(options.some(o => o.value === 'family')).toBe(true);
  });
});
