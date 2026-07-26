/**
 * Tests για τη λίστα διευθύνσεων ΚΑΘΕ είδους επαφής (ADR-332 D18).
 *
 * ΤΙ ΚΑΘΗΛΩΝΟΥΝ
 * Το UI δέχεται επιπλέον διευθύνσεις και για τους τρεις τύπους επαφής, αλλά η
 * αποθήκευση τις κρατούσε **μόνο** για εταιρείες: το μπλοκ που έγραφε
 * `customFields.companyAddresses` έτρεχε κάτω από `if (type === 'company')`,
 * και το `stripTypeExclusiveFields` έσβηνε αμέσως μετά και το top-level
 * αντίγραφο. Ό,τι δεν ήταν στη θέση 0 εξαφανιζόταν **σιωπηλά** στο save και
 * δεν ξαναδιαβαζόταν ποτέ (individual/service mappers διάβαζαν `addresses[0]`).
 *
 * Τα προηγούμενα tests ήταν πράσινα: κανένα δεν έκανε round-trip σε φυσικό
 * πρόσωπο ή υπηρεσία με δεύτερη διεύθυνση.
 */

import type { Contact } from '@/types/contacts';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { EnterpriseContactSaver } from '../EnterpriseContactSaver';
import { stripTypeExclusiveFields } from '../contact-type-fields';
import { resolveContactAddresses } from '../contact-addresses-reader';

// =============================================================================
// ΒΟΗΘΗΤΙΚΑ
// =============================================================================

function addr(partial: Partial<CompanyAddress> & Pick<CompanyAddress, 'type'>): CompanyAddress {
  return {
    street: 'Ονειροπόλων',
    number: '42',
    postalCode: '54624',
    city: 'Θεσσαλονίκη',
    ...partial,
  };
}

/** Φόρμα με κύρια διεύθυνση + δύο επιπλέον, ανά είδος επαφής. */
function formWithThreeAddresses(
  type: ContactFormData['type'],
  addresses: CompanyAddress[],
): ContactFormData {
  return {
    ...initialFormData,
    type,
    street: addresses[0].street,
    streetNumber: addresses[0].number,
    postalCode: addresses[0].postalCode,
    city: addresses[0].city,
    companyAddresses: addresses,
  };
}

const INDIVIDUAL_ADDRESSES: CompanyAddress[] = [
  addr({ type: 'home' }),
  addr({ type: 'office', street: 'Τσιμισκή', city: 'Καλαμαριά' }),
  addr({ type: 'vacation', street: 'Παραλίας', city: 'Νικήτη' }),
];

const SERVICE_ADDRESSES: CompanyAddress[] = [
  addr({ type: 'central_service' }),
  addr({ type: 'regional_service', street: 'Εγνατία', city: 'Σέρρες' }),
  addr({ type: 'annex', street: 'Βενιζέλου', city: 'Κιλκίς' }),
];

const COMPANY_ADDRESSES: CompanyAddress[] = [
  addr({ type: 'headquarters' }),
  addr({ type: 'branch', street: 'Μοναστηρίου', city: 'Εύοσμος' }),
  addr({ type: 'warehouse', street: 'Βιομηχανική', city: 'Σίνδος' }),
];

const CASES = [
  { contactType: 'individual' as const, addresses: INDIVIDUAL_ADDRESSES },
  { contactType: 'service' as const, addresses: SERVICE_ADDRESSES },
  { contactType: 'company' as const, addresses: COMPANY_ADDRESSES },
];

// =============================================================================
// ΤΟ ΙΔΙΟ ΣΥΜΒΟΛΑΙΟ ΚΑΙ ΓΙΑ ΤΑ ΤΡΙΑ ΕΙΔΗ
// =============================================================================

describe.each(CASES)('λίστα διευθύνσεων — $contactType', ({ contactType, addresses }) => {
  it('γράφει ΟΛΕΣ τις διευθύνσεις στην αυθεντική θέση', () => {
    const result = EnterpriseContactSaver.convertToEnterpriseStructure(
      formWithThreeAddresses(contactType, addresses),
    );

    expect(result.customFields?.companyAddresses).toHaveLength(3);
  });

  it('παράγει `addresses[]` με ΟΛΕΣ τις διευθύνσεις, όχι μόνο την κύρια', () => {
    const result = EnterpriseContactSaver.convertToEnterpriseStructure(
      formWithThreeAddresses(contactType, addresses),
    );

    // ΤΟ ΕΛΑΤΤΩΜΑ: εδώ έβγαινε 1 για individual/service — μόνο η έδρα από τα
    // flat πεδία, γιατί η μετατροπή της λίστας δεν έτρεχε καθόλου.
    expect(result.addresses).toHaveLength(3);
    expect(result.addresses?.map(a => a.label)).toEqual(addresses.map(a => a.type));
  });

  it('δεν αφήνει top-level αντίγραφο της λίστας', () => {
    const result = EnterpriseContactSaver.convertToEnterpriseStructure(
      formWithThreeAddresses(contactType, addresses),
    );

    expect((result as Record<string, unknown>).companyAddresses).toBeUndefined();
  });

  it('round-trip: ό,τι αποθηκεύτηκε ξαναδιαβάζεται ολόκληρο', () => {
    const saved = EnterpriseContactSaver.convertToEnterpriseStructure(
      formWithThreeAddresses(contactType, addresses),
    );

    const reread = resolveContactAddresses(saved as unknown as Contact, contactType);

    expect(reread).toHaveLength(3);
    expect(reread.map(a => a.type)).toEqual(addresses.map(a => a.type));
    expect(reread.map(a => a.city)).toEqual(addresses.map(a => a.city));
  });

  it('το φίλτρο τύπου δεν σβήνει πια τη λίστα', () => {
    const stripped = stripTypeExclusiveFields(
      { companyAddresses: addresses, customFields: { companyAddresses: addresses } },
      contactType,
    );

    expect(stripped.customFields).toBeDefined();
  });
});

// =============================================================================
// ΣΗΜΑΣΙΟΛΟΓΙΑ ΑΝΑ ΕΙΔΟΣ — ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΟΥ ADR-319
// =============================================================================

describe('resolveContactAddresses — ανακατασκευή από το παράγωγο', () => {
  /** Έγγραφο παλιάς μορφής: μόνο `addresses[]`, καμία αυθεντική λίστα. */
  function legacyContact(labels: Array<string | undefined>): Contact {
    return {
      addresses: labels.map(label => ({
        street: 'Ονειροπόλων',
        number: '42',
        postalCode: '54624',
        city: 'Θεσσαλονίκη',
        type: 'work' as const,
        isPrimary: false,
        ...(label ? { label } : {}),
      })),
    } as unknown as Contact;
  }

  it('χωρίς `label`, τα slug ακολουθούν το είδος επαφής — όχι σταθερά headquarters/branch', () => {
    // ΤΟ ΕΛΑΤΤΩΜΑ: η παλιά υλοποίηση έγραφε πάντα `headquarters`/`branch`,
    // τιμές που το ADR-319 ΔΕΝ επιτρέπει σε φυσικό πρόσωπο — η φόρμα γέμιζε με
    // είδη εκτός του επιτρεπτού συνόλου του AddressTypeSelector.
    const individual = resolveContactAddresses(legacyContact([undefined, undefined]), 'individual');
    expect(individual.map(a => a.type)).toEqual(['home', 'office']);

    const service = resolveContactAddresses(legacyContact([undefined, undefined]), 'service');
    expect(service.map(a => a.type)).toEqual(['central_service', 'regional_service']);

    const company = resolveContactAddresses(legacyContact([undefined, undefined]), 'company');
    expect(company.map(a => a.type)).toEqual(['headquarters', 'branch']);
  });

  it('σημασιολογικό slug στο `label` επιστρέφει ως `type`', () => {
    const result = resolveContactAddresses(legacyContact(['vacation']), 'individual');
    expect(result[0]).toMatchObject({ type: 'vacation' });
    expect(result[0].customLabel).toBeUndefined();
  });

  it('ελεύθερη ετικέτα επιστρέφει ως `other` + `customLabel`', () => {
    // Χωρίς αυτό, ένα «Εξοχικό Πηλίου» θα ξαναγύριζε ως σκέτο `other` και ο
    // χρήστης θα έβλεπε την ετικέτα του να εξαφανίζεται στο reload.
    const result = resolveContactAddresses(legacyContact(['Εξοχικό Πηλίου']), 'individual');
    expect(result[0]).toMatchObject({ type: 'other', customLabel: 'Εξοχικό Πηλίου' });
  });

  it('προτιμά την αυθεντική λίστα από το παράγωγο', () => {
    const authoritative = [addr({ type: 'home', city: 'Αυθεντική' })];
    const contact = {
      customFields: { companyAddresses: authoritative },
      addresses: [{ street: 'x', number: '', postalCode: '', city: 'Παράγωγη', type: 'home' }],
    } as unknown as Contact;

    expect(resolveContactAddresses(contact, 'individual')[0].city).toBe('Αυθεντική');
  });

  it('διατηρεί τη διοικητική ιεραρχία στην ανακατασκευή', () => {
    const contact = {
      addresses: [{
        street: 'Ονειροπόλων', number: '42', postalCode: '54624', city: 'Θεσσαλονίκη',
        type: 'home' as const, isPrimary: true, label: 'home',
        settlement: 'Θεσσαλονίκη', municipality: 'Δήμος Θεσσαλονίκης',
        region: 'Κεντρική Μακεδονία', neighborhood: 'Κέντρο',
      }],
    } as unknown as Contact;

    expect(resolveContactAddresses(contact, 'individual')[0]).toMatchObject({
      municipalityName: 'Δήμος Θεσσαλονίκης',
      regionName: 'Κεντρική Μακεδονία',
      neighborhood: 'Κέντρο',
    });
  });
});

// =============================================================================
// ΜΗ-ΠΑΛΙΝΔΡΟΜΗΣΗ ΤΟΥ ΚΛΑΔΟΥ ΕΤΑΙΡΕΙΑΣ
// =============================================================================

describe('τα company-only πεδία δεν παρασύρθηκαν στη γενίκευση', () => {
  const companyForm: ContactFormData = {
    ...formWithThreeAddresses('company', COMPANY_ADDRESSES),
    gemiNumber: '123456789000',
    activityCodeKAD: '41.20',
    chamber: 'ΕΒΕΘ',
    municipality: 'Δήμος Θεσσαλονίκης',
  };

  it('τα ΓΕΜΗ/ΚΑΔ πεδία εξακολουθούν να πηγαίνουν στα customFields', () => {
    const result = EnterpriseContactSaver.convertToEnterpriseStructure(companyForm);

    expect(result.customFields).toMatchObject({
      activityCodeKAD: '41.20',
      chamber: 'ΕΒΕΘ',
      municipality: 'Δήμος Θεσσαλονίκης',
    });
  });

  it('το top-level `municipality` αφαιρείται ΜΟΝΟ σε εταιρεία', () => {
    // Σε εταιρεία το `municipality` είναι πεδίο ΓΕΜΗ· σε φυσικό πρόσωπο είναι
    // επίπεδο της διοικητικής ιεραρχίας και η διαγραφή του θα έσβηνε διεύθυνση.
    const company = EnterpriseContactSaver.convertToEnterpriseStructure(companyForm);
    expect((company as Record<string, unknown>).municipality).toBeUndefined();

    const individual = EnterpriseContactSaver.convertToEnterpriseStructure({
      ...formWithThreeAddresses('individual', INDIVIDUAL_ADDRESSES),
      municipality: 'Δήμος Θεσσαλονίκης',
    });
    expect((individual as Record<string, unknown>).municipality).toBe('Δήμος Θεσσαλονίκης');
  });
});
