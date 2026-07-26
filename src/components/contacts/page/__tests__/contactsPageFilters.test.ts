/**
 * Regression lock για την εξαγωγή του φιλτραρίσματος επαφών (ADR-332 D20 / N.7.1).
 *
 * Το `filterContactsForPage` βγήκε από το `useContactsPageState` όταν το hook
 * πέρασε τις 500 γραμμές. Η εξαγωγή **δεν** επιτρέπεται να αλλάξει συμπεριφορά —
 * αυτά τα tests είναι μεταγραμμένα από τον προ-εξαγωγής κώδικα.
 */

import type { Contact } from '@/types/contacts';
import type { ContactFilterState } from '@/components/core/AdvancedFilters';
import { filterContactsForPage } from '../contactsPageFilters';

const NO_FILTERS: ContactFilterState = {
  searchTerm: '',
  company: [],
  status: [],
  contactType: 'all',
  propertiesCount: 'all',
  totalArea: 'all',
  hasProperties: false,
  isFavorite: false,
  showArchived: false,
  tags: [],
  dateRange: { from: undefined, to: undefined },
};

/** Ο μεταφραστής επιστρέφει το κλειδί — οι κάρτες αναγνωρίζονται από τον τίτλο. */
const t = (key: string) => key;

function contact(partial: Partial<Contact> & { id: string }): Contact {
  return {
    type: 'individual',
    firstName: 'Όνομα',
    lastName: 'Επώνυμο',
    ...partial,
  } as Contact;
}

const ALICE = contact({ id: 'c1', firstName: 'Αλίκη', lastName: 'Παπαδοπούλου' });
const COMPANY = contact({ id: 'c2', type: 'company', companyName: 'ALFA' } as Partial<Contact> & { id: string });
const SERVICE = contact({ id: 'c3', type: 'service', serviceName: 'ΔΟΥ' } as Partial<Contact> & { id: string });
const DELETED = contact({ id: 'c4', status: 'deleted' } as Partial<Contact> & { id: string });
const FAVOURITE = contact({ id: 'c5', firstName: 'Βασίλης', isFavorite: true });

const ALL = [ALICE, COMPANY, SERVICE, DELETED, FAVOURITE];

function run(overrides: Partial<Parameters<typeof filterContactsForPage>[0]> = {}) {
  return filterContactsForPage({
    contacts: ALL,
    filters: NO_FILTERS,
    activeCardFilter: null,
    contactIdParam: null,
    showTrash: false,
    t,
    ...overrides,
  });
}

describe('filterContactsForPage', () => {
  it('κρύβει τις soft-deleted επαφές από την κανονική προβολή', () => {
    expect(run().map(c => c.id)).toEqual(['c1', 'c2', 'c3', 'c5']);
  });

  it('ο κάδος δείχνει ΜΟΝΟ τις διαγραμμένες', () => {
    expect(run({ showTrash: true }).map(c => c.id)).toEqual(['c4']);
  });

  it('το deep link παρακάμπτει κάθε άλλο φίλτρο — αλλά όχι τις διαγραμμένες', () => {
    const result = run({
      contactIdParam: 'c2',
      filters: { ...NO_FILTERS, searchTerm: 'ανύπαρκτο', contactType: 'individual' },
    });

    expect(result.map(c => c.id)).toEqual(['c1', 'c2', 'c3', 'c5']);
  });

  it.each([
    ['page.dashboard.totalPersonnel', ['c1', 'c5']],
    ['page.dashboard.legalEntities', ['c2']],
    ['page.dashboard.services', ['c3']],
    ['page.dashboard.favorites', ['c5']],
    ['page.dashboard.contactsWithRelations', ['c1', 'c2', 'c5']],
    ['page.dashboard.totalContacts', ['c1', 'c2', 'c3', 'c5']],
  ])('κάρτα dashboard «%s»', (card, expected) => {
    expect(run({ activeCardFilter: card }).map(c => c.id)).toEqual(expected);
  });

  it('άγνωστη κάρτα δεν φιλτράρει τίποτα (παλιό switch χωρίς match)', () => {
    expect(run({ activeCardFilter: 'ανύπαρκτη-κάρτα' }).map(c => c.id)).toEqual(['c1', 'c2', 'c3', 'c5']);
  });

  it('η αναζήτηση κειμένου ψάχνει το εμφανιζόμενο όνομα, χωρίς πεζά/κεφαλαία', () => {
    expect(run({ filters: { ...NO_FILTERS, searchTerm: 'αλίκη' } }).map(c => c.id)).toEqual(['c1']);
  });

  it('το φίλτρο τύπου αγνοείται όσο υπάρχει ενεργή κάρτα', () => {
    const result = run({
      activeCardFilter: 'page.dashboard.legalEntities',
      filters: { ...NO_FILTERS, contactType: 'individual' },
    });

    // Η κάρτα κερδίζει — αλλιώς το αποτέλεσμα θα ήταν κενό.
    expect(result.map(c => c.id)).toEqual(['c2']);
  });

  it('το φίλτρο τύπου εφαρμόζεται όταν δεν υπάρχει κάρτα', () => {
    expect(run({ filters: { ...NO_FILTERS, contactType: 'service' } }).map(c => c.id)).toEqual(['c3']);
  });

  it('τα αγαπημένα φιλτράρονται ανεξάρτητα από την κάρτα', () => {
    expect(run({ filters: { ...NO_FILTERS, isFavorite: true } }).map(c => c.id)).toEqual(['c5']);
  });

  it('«πρόσφατες προσθήκες»: κρατά μόνο όσες δημιουργήθηκαν τον τελευταίο μήνα', () => {
    const now = new Date();
    const old = new Date();
    old.setMonth(old.getMonth() - 3);
    const recent = contact({ id: 'new', createdAt: now } as Partial<Contact> & { id: string });
    const stale = contact({ id: 'old', createdAt: old } as Partial<Contact> & { id: string });

    const result = filterContactsForPage({
      contacts: [recent, stale],
      filters: NO_FILTERS,
      activeCardFilter: 'page.dashboard.recentAdditions',
      contactIdParam: null,
      showTrash: false,
      t,
    });

    expect(result.map(c => c.id)).toEqual(['new']);
  });

  it('«ενεργές επαφές»: πετάει τις inactive', () => {
    const inactive = contact({ id: 'inact', status: 'inactive' } as Partial<Contact> & { id: string });

    const result = filterContactsForPage({
      contacts: [ALICE, inactive],
      filters: NO_FILTERS,
      activeCardFilter: 'page.dashboard.activeContacts',
      contactIdParam: null,
      showTrash: false,
      t,
    });

    expect(result.map(c => c.id)).toEqual(['c1']);
  });
});
