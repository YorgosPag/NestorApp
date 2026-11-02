import type { Opportunity } from '@/types/crm';
import type { Contact } from '@/types/contacts/contracts';
import { getContactDisplayName, getPrimaryEmail, getPrimaryPhone } from '@/types/contacts/helpers';

export interface LeadPerson {
  readonly fullName?: string;
  readonly email?: string;
  readonly phone?: string;
}

/**
 * Ποιος είναι ο άνθρωπος μιας ευκαιρίας.
 *
 * Με φορτωμένη επαφή, αυτή είναι η μόνη αλήθεια: κενό πεδίο σημαίνει «δεν το γνωρίζουμε»,
 * όχι «δείξε το παλιό αντίγραφο». Τα αντίγραφα της ευκαιρίας ισχύουν μόνο όσο δεν υπάρχει
 * επαφή: χωρίς `contactId`, κατά τη φόρτωση ή όταν η ανάγνωση απέτυχε.
 */
export function resolveLeadPerson(
  lead: Pick<Opportunity, 'fullName' | 'email' | 'phone'>,
  contact: Contact | null,
): LeadPerson {
  if (!contact) return { fullName: lead.fullName, email: lead.email, phone: lead.phone };
  return {
    fullName: getContactDisplayName(contact) || lead.fullName,
    email: getPrimaryEmail(contact),
    phone: getPrimaryPhone(contact),
  };
}
