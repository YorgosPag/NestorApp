import type { Contact } from '@/types/contacts/contracts';
import { resolveLeadPerson } from '../lead-person';

const SNAPSHOT = { fullName: 'Αντίγραφο', email: 'old@example.test', phone: '6900000004' };

const contact = {
  type: 'individual', firstName: 'GEO', lastName: 'PAGONIS',
  emails: [{ email: 'real@example.test', type: 'personal', isPrimary: true }],
} as unknown as Contact;

describe('resolveLeadPerson', () => {
  it('χωρίς επαφή ισχύουν τα αντίγραφα της ευκαιρίας', () => {
    expect(resolveLeadPerson(SNAPSHOT, null)).toEqual(SNAPSHOT);
  });

  it('με επαφή, αυτή κερδίζει και το κενό της μένει κενό', () => {
    expect(resolveLeadPerson(SNAPSHOT, contact)).toEqual({
      fullName: 'GEO PAGONIS', email: 'real@example.test', phone: undefined,
    });
  });
});
