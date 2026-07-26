/**
 * Το φιλτράρισμα της λίστας επαφών — καθαρή συνάρτηση, ένα σημείο.
 *
 * Εξήχθη από το `useContactsPageState` (N.7.1: το hook είχε περάσει τις 500
 * γραμμές). Είναι **καθαρή**: δέχεται τα πάντα ως όρισμα, δεν διαβάζει state και
 * δεν έχει παρενέργειες — άρα δοκιμάζεται χωρίς να στηθεί ολόκληρη η σελίδα.
 *
 * Αδελφό αρχείο του `contactDashboardStats.ts`, ίδιο μοτίβο εξαγωγής (ADR-233).
 *
 * @module components/contacts/page/contactsPageFilters
 */

import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { CONTACT_TYPES } from '@/constants/contacts';
import { normalizeToDate } from '@/lib/date-local';
import type { ContactFilterState } from '@/components/core/AdvancedFilters';

/** Μεταφραστής τίτλων καρτών του dashboard — ό,τι επιστρέφει το `useTranslation`. */
type TranslateFn = (key: string) => string;

export interface ContactFilterInputs {
  contacts: readonly Contact[];
  filters: ContactFilterState;
  /** Ο τίτλος της ενεργής κάρτας dashboard, ή `null` όταν καμία δεν είναι πατημένη. */
  activeCardFilter: string | null;
  /**
   * Η **ανοιχτή** επαφή (`?contactId=`) — μένει πάντα ορατή, ό,τι κι αν λένε τα φίλτρα.
   *
   * ⚠️ Μέχρι το ADR-332 D21 η συνθήκη ήταν `if (contactIdParam) return true`, δηλαδή
   * η **παρουσία** του param απενεργοποιούσε **όλα** τα φίλτρα για **όλες** τις
   * επαφές. Αυτό στεκόταν όσο το param έμπαινε μόνο από εξωτερικά deep links· από τη
   * στιγμή που το URL έγινε η πηγή αλήθειας της επιλογής, κάθε κλικ θα σκότωνε την
   * αναζήτηση. Η πρόθεση ήταν πάντα η στενή: **μην κρύβεις αυτό που είναι ανοιχτό**.
   */
  selectedContactId: string | null;
  showTrash: boolean;
  t: TranslateFn;
}

/**
 * Ταιριάζει η επαφή με την ενεργή κάρτα του dashboard;
 *
 * Οι κάρτες αναγνωρίζονται από τον **μεταφρασμένο τίτλο** τους — έτσι ήταν ήδη
 * γραμμένο· η αλλαγή σε σταθερά ids θα ήταν διαφορετική απόφαση από αυτή την
 * εξαγωγή και δεν γίνεται σιωπηλά εδώ.
 */
function matchesCardFilter(contact: Contact, activeCardFilter: string, t: TranslateFn): boolean {
  switch (activeCardFilter) {
    case t('page.dashboard.totalContacts'):
      return true;
    case t('page.dashboard.totalPersonnel'):
      return contact.type === 'individual';
    case t('page.dashboard.legalEntities'):
      return contact.type === 'company';
    case t('page.dashboard.activeContacts'):
      return (contact as Contact & { status?: string }).status !== 'inactive';
    case t('page.dashboard.services'):
      return contact.type === 'service';
    case t('page.dashboard.recentAdditions'): {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const createdDate = normalizeToDate(contact.createdAt);
      return !!createdDate && createdDate > oneMonthAgo;
    }
    case t('page.dashboard.favorites'):
      return !!contact.isFavorite;
    case t('page.dashboard.contactsWithRelations'):
      return contact.type !== CONTACT_TYPES.SERVICE;
    default:
      return true;
  }
}

/**
 * Η ορατή λίστα επαφών για την τρέχουσα κατάσταση της σελίδας.
 *
 * Σειρά προτεραιότητας: κάδος → soft-deleted → **η ανοιχτή επαφή** → κάρτα
 * dashboard → αναζήτηση κειμένου → τύπος επαφής → αγαπημένα.
 */
export function filterContactsForPage({
  contacts,
  filters,
  activeCardFilter,
  selectedContactId,
  showTrash,
  t,
}: ContactFilterInputs): Contact[] {
  // 🗑️ Trash mode: show ONLY deleted contacts
  if (showTrash) {
    return contacts.filter(c => c.status === 'deleted');
  }

  return contacts.filter(contact => {
    // Exclude soft-deleted contacts from normal view
    if (contact.status === 'deleted') return false;

    // Η ανοιχτή επαφή δεν κρύβεται ποτέ από φίλτρο — αλλιώς το πάνελ δείχνει κάποιον
    // που δεν υπάρχει στη λίστα δίπλα του. Ισχύει ΜΟΝΟ γι' αυτήν, όχι για όλες.
    if (selectedContactId && contact.id === selectedContactId) return true;

    if (activeCardFilter && !matchesCardFilter(contact, activeCardFilter, t)) return false;

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      if (!getContactDisplayName(contact).toLowerCase().includes(searchLower)) return false;
    }

    // Contact type (unless overridden by card filter)
    if (!activeCardFilter && filters.contactType !== 'all' && contact.type !== filters.contactType) {
      return false;
    }

    if (filters.isFavorite && !contact.isFavorite) return false;

    return true;
  });
}
