/**
 * Άγκυρες της **ταυτότητας στοιχείου συλλογής** της επαφής — ADR-195 (η).
 *
 * 🔴 ΤΟ ΕΥΡΗΜΑ: δύο δηλώσεις `keyBy` έδειχναν σε πεδίο που **δεν υπάρχει** (`personas` → `type` αντί για `personaType`,
 * `escoSkills` → `code` σε στοιχείο `{uri, label}`). Κανείς δεν το έβλεπε: το κλειδί έβγαινε κενό, η μηχανή έπεφτε
 * σιωπηλά στο κλειδί ολόκληρου JSON και η ετικέτα γινόταν «(άγνωστο)».
 *
 * Ι1 — κάθε `keyBy` / `labelFields` είναι **πραγματική ιδιότητα** ενός στοιχείου με τον πραγματικό του τύπο.
 * Ι2 — η υπηρεσία (`CONTACT_TRACKED_FIELDS`) διαβάζει την **ίδια** ταυτότητα (μία δήλωση, δύο γραφείς).
 * Ι3 — κάθε κάτοπτρο δείχνει σε δηλωμένη αυθεντία, και η αυθεντία δεν είναι η ίδια κάτοπτρο.
 * Ι4 — η ταυτότητα δεν περιέχει **μεταβλητή ιδιότητα** (`type`): αλλαγή τύπου = αλλαγή ιδιότητας, όχι νέο στοιχείο.
 */

import {
  CONTACT_COLLECTION_IDENTITY,
  CONTACT_DERIVED_MIRRORS,
  type ContactCollectionField,
} from '../audit-collection-identity';
import { CONTACT_TRACKED_FIELDS } from '../audit-tracked-fields';
import type {
  AddressInfo,
  ContactPerson,
  EmailInfo,
  PhoneInfo,
  ResponsiblePerson,
  SocialMediaInfo,
  WebsiteInfo,
} from '@/types/contacts/contracts';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import type { PersonaData } from '@/types/contacts/personas';

type EscoSkill = { readonly uri: string; readonly label: string };

/**
 * Ένα στοιχείο ανά συλλογή αντικειμένων, **με τον πραγματικό τύπο του** — το `Pick` κάνει τον compiler να αρνηθεί
 * όνομα ιδιότητας που ο τύπος δεν έχει, και το test ελέγχει ότι η δήλωση ζητά ό,τι υπάρχει στο στοιχείο.
 */
const ITEMS: Readonly<Partial<Record<ContactCollectionField, Readonly<Record<string, unknown>>>>> = {
  emails: { email: 'info@macon.gr', type: 'info', isPrimary: true } satisfies Pick<EmailInfo, 'email' | 'type' | 'isPrimary'>,
  phones: { number: '2310428900', type: 'main', isPrimary: true, countryCode: '+30' } satisfies Pick<PhoneInfo, 'number' | 'type' | 'isPrimary' | 'countryCode'>,
  websites: { url: 'https://macon.gr', type: 'company' } satisfies Pick<WebsiteInfo, 'url' | 'type'>,
  socialMedia: { platform: 'linkedin', username: 'macon', url: 'https://linkedin.com/in/macon' } satisfies Pick<SocialMediaInfo, 'platform' | 'username' | 'url'>,
  addresses: { id: 'addr_1', street: 'Απόλλωνος', city: 'Θεσσαλονίκη', type: 'work' } satisfies Pick<AddressInfo, 'id' | 'street' | 'city' | 'type'>,
  'customFields.companyAddresses': { id: 'addr_1', type: 'headquarters', street: 'Απόλλωνος', city: 'Θεσσαλονίκη' } satisfies Pick<CompanyAddress, 'id' | 'type' | 'street' | 'city'>,
  contactPersons: { name: 'Νίκος', position: 'Διευθυντής', isPrimary: true } satisfies Pick<ContactPerson, 'name' | 'position' | 'isPrimary'>,
  responsiblePersons: { name: 'Νίκος', position: 'Διευθυντής', isPrimary: true } satisfies Pick<ResponsiblePerson, 'name' | 'position' | 'isPrimary'>,
  personas: { personaType: 'supplier', status: 'active' } satisfies Pick<PersonaData, 'personaType' | 'status'>,
  escoSkills: { uri: 'http://data.europa.eu/esco/skill/1', label: 'Java' } satisfies EscoSkill,
};

const FIELDS = Object.keys(CONTACT_COLLECTION_IDENTITY) as ContactCollectionField[];

function keyFields(field: ContactCollectionField): readonly string[] {
  const { keyBy } = CONTACT_COLLECTION_IDENTITY[field];
  if (keyBy === 'value') return [];
  return typeof keyBy === 'string' ? [keyBy] : keyBy;
}

function labelFields(field: ContactCollectionField): readonly string[] {
  const identity: { readonly labelFields?: readonly string[] } = CONTACT_COLLECTION_IDENTITY[field];
  return identity.labelFields ?? [];
}

describe('Ι1 — κάθε keyBy / labelFields είναι πραγματική ιδιότητα του στοιχείου', () => {
  it.each(FIELDS.filter((f) => CONTACT_COLLECTION_IDENTITY[f].keyBy !== 'value'))('%s', (field) => {
    const item = ITEMS[field];
    expect(item).toBeDefined();
    for (const property of [...keyFields(field), ...labelFields(field)]) {
      expect(Object.keys(item ?? {})).toContain(property);
    }
  });
});

describe('Ι2 — η υπηρεσία διαβάζει την ΙΔΙΑ ταυτότητα', () => {
  it.each(FIELDS)('%s', (field) => {
    const def = CONTACT_TRACKED_FIELDS[field];
    expect(def?.kind).toBe('collection');
    if (def?.kind !== 'collection') return;
    expect(def.keyBy).toEqual(CONTACT_COLLECTION_IDENTITY[field].keyBy);
    expect(def.labelFields).toEqual(labelFields(field).length > 0 ? labelFields(field) : undefined);
  });
});

describe('Ι3 — κάτοπτρα', () => {
  it.each(Object.entries(CONTACT_DERIVED_MIRRORS))('%s ← %s', (derived, authority) => {
    expect(FIELDS).toContain(derived);
    expect(FIELDS).toContain(authority);
    expect(Object.keys(CONTACT_DERIVED_MIRRORS)).not.toContain(authority);
  });

  it('η έδρα και ο ρόλος καταγράφονται από την αυθεντία τους', () => {
    expect(CONTACT_DERIVED_MIRRORS.addresses).toBe('customFields.companyAddresses');
    expect(CONTACT_DERIVED_MIRRORS.personaTypes).toBe('personas');
  });
});

describe('Ι4 — η ταυτότητα δεν περιέχει μεταβλητή ιδιότητα', () => {
  it.each(FIELDS)('%s', (field) => {
    expect(keyFields(field)).not.toContain('type');
    expect(keyFields(field)).not.toContain('isPrimary');
  });
});
