/**
 * Επιλογές ρόλου σχέσης ανά διασταύρωση (ADR-372 §8) — καμία χωρίς ετικέτα (ADR-327, 2026-10-28),
 * καμία ΔΙΠΛΗ ετικέτα (§Β1) και φορά ανεξάρτητη από την καρτέλα (§Β2).
 *
 * 🔴 Αφορμές:
 * - ADR-327: ο πίνακας επιτρέπει τους τύπους ακινήτου (ADR-244), που το `VISUAL_REGISTRY` εξαιρεί ⇒
 *   `property_buyer` ωμό στο dropdown εταιρεία → φυσικό πρόσωπο.
 * - ADR-372 §Β1: τέσσερα ζεύγη με ΙΔΙΑ ελληνική ετικέτα στο dropdown.
 * - ADR-372 §Β2: «Μέτοχος» δούλευε μόνο από την καρτέλα προσώπου, «Εργαζόμενος» μόνο από της εταιρείας.
 */

/* global describe, it, expect */

import type { ContactType } from '@/types/contacts/contracts';
import elRelationships from '@/i18n/locales/el/contacts-relationships.json';
import { getRelationshipTypeOptions } from '../relationship-form-presets';
import {
  decodeOrientedRole,
  getOfferedOrientedRoles,
  orientRelationship,
  relationshipRoleLabelKey,
  relationshipTypeI18nSegment,
} from '@/types/contacts/relationships/core/relationship-orientation';

const echo = (key: string): string => key;
const TYPES: ContactType[] = ['individual', 'company', 'service'];

type Bundle = { relationships: { types: Record<string, string>; inverseTypes: Record<string, string> } };
const el = elRelationships as Bundle;
const translateEl = (key: string): string => {
  const [, block, segment] = key.split('.');
  return block === 'inverseTypes' ? el.relationships.inverseTypes[segment] : el.relationships.types[segment];
};

describe('Επιλογές ρόλου — διασταύρωση (ADR-372 §8)', () => {
  it('🔴 Τ1 — σε ΚΑΘΕ διασταύρωση, κάθε ρόλος έχει ελληνική ετικέτα (κανένας τύπος ακινήτου)', () => {
    for (const current of TYPES) {
      for (const picked of TYPES) {
        for (const role of getOfferedOrientedRoles(current, picked)) {
          expect(role.type).not.toMatch(/^property_/);
          const label = translateEl(relationshipRoleLabelKey(role.type, role.pickedSide));
          expect([current, picked, role.type, role.pickedSide, typeof label]).toEqual(
            [current, picked, role.type, role.pickedSide, 'string']
          );
        }
      }
    }
  });

  it('🔴 Τ2 — §Β1: σε ΚΑΘΕ διασταύρωση οι ελληνικές ετικέτες του dropdown είναι ΜΟΝΑΔΙΚΕΣ', () => {
    for (const current of TYPES) {
      for (const picked of TYPES) {
        const labels = getRelationshipTypeOptions(current, translateEl, undefined, picked).map(o => o.label);
        expect([current, picked, labels.length]).toEqual([current, picked, new Set(labels).size]);
      }
    }
  });

  it('🔴 Τ3 — §Β2: «Μέτοχος» ίδια αποθήκευση από ΟΠΟΙΑΔΗΠΟΤΕ καρτέλα (πρόσωπο → εταιρεία)', () => {
    const fromCompany = getRelationshipTypeOptions('company', echo, undefined, 'individual')
      .find(o => o.value === 'shareholder');
    const fromPerson = getRelationshipTypeOptions('individual', echo, undefined, 'company')
      .find(o => decodeOrientedRole(o.value).type === 'shareholder');
    expect(fromCompany).toBeDefined();
    expect(fromPerson).toBeDefined();
    const a = decodeOrientedRole(fromCompany!.value);
    const b = decodeOrientedRole(fromPerson!.value);
    const viaCompanyCard = orientRelationship({ type: 'shareholder', pickedSide: a.pickedSide }, 'COMPANY', 'PERSON');
    const viaPersonCard = orientRelationship({ type: 'shareholder', pickedSide: b.pickedSide }, 'PERSON', 'COMPANY');
    expect(viaCompanyCard).toEqual({ sourceContactId: 'PERSON', targetContactId: 'COMPANY' });
    expect(viaPersonCard).toEqual(viaCompanyCard);
  });

  it('Τ4 — η αποθηκευμένη τιμή εκτός λίστας μπαίνει πρώτη, με ετικέτα (συμβόλαιο που διατηρείται)', () => {
    const options = getRelationshipTypeOptions('company', echo, 'family', 'individual');
    expect(options[0]).toEqual({ value: 'family', label: `relationships.types.${relationshipTypeI18nSegment('family')}` });
  });
});
