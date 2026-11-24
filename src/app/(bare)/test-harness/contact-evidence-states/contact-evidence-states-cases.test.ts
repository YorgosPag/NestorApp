/**
 * ADR-950 §8.19 — οι σταθερές αναγνώσεις της σελίδας καταστάσεων **δίνουν πράγματι** τις καταστάσεις που υπόσχονται,
 * μέσα από την ΙΔΙΑ `compareEvidenceWithForm` που καλεί ο πίνακας. Φθηνή άμυνα (jest, χωρίς browser) κάτω από το
 * CHECK 3.117: αν αλλάξει η σύγκριση και μια περίπτωση πάψει να δείχνει ό,τι λέει το όνομά της, κοκκινίζει **εδώ**,
 * πριν φτάσει στο CI — και η πύλη του browser δεν κρίνει ποτέ λάθος κατάσταση ως «πράσινη».
 */

import { fillableEvidenceRows } from '@/lib/contacts/contact-evidence-acceptance';
import { compareEvidenceWithForm, type EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import { readablePhone } from '@/lib/contact/channel-phone';

import { CONTACT_EVIDENCE_CASES, type ContactEvidenceCaseId } from './contact-evidence-states-cases';

function rowsOf(id: ContactEvidenceCaseId): readonly EvidenceRow[] {
  const found = CONTACT_EVIDENCE_CASES.find((c) => c.id === id);
  const analysis = found?.file.ingestion?.analysis;
  if (found === undefined || analysis?.fields === undefined || analysis.evidencePurpose === undefined) {
    throw new Error(`case ${id} has no reading`);
  }
  return compareEvidenceWithForm({
    reading: {
      fields: analysis.fields,
      fieldConsensus: analysis.fieldConsensus,
      addressVerification: analysis.addressVerification,
      phoneLineType: analysis.phoneLineType,
    },
    purpose: analysis.evidencePurpose,
    formData: found.formData,
    contactType: 'individual',
    dismissals: [],
  });
}

function row(rows: readonly EvidenceRow[], key: EvidenceRow['key']): EvidenceRow {
  const found = rows.find((r) => r.key === key);
  if (found === undefined) throw new Error(`no row ${key}`);
  return found;
}

it('ακριβώς τρεις περιπτώσεις, μοναδικές', () => {
  expect(CONTACT_EVIDENCE_CASES.map((c) => c.id)).toEqual(['corrected-street', 'map-unavailable', 'phone-fill']);
});

it('corrected-street ⇒ η διεύθυνση γειώνεται ΔΙΟΡΘΩΜΕΝΗ σε Σαμοθράκης, με το τυπωμένο ΣΑΜΟΓΡΑΦΗΣ', () => {
  const address = row(rowsOf('corrected-street'), 'address');
  expect(address).toMatchObject({ ungrounded: null, correctedFrom: 'ΣΑΜΟΓΡΑΦΗΣ', state: 'missing' });
  expect(address.documentDisplay).toMatch(/^Σαμοθράκης /);
  expect(address.documentPrinted).toMatch(/^ΣΑΜΟΓΡΑΦΗΣ /);
});

it('map-unavailable ⇒ «ο χάρτης δεν απάντησε», καμία πρόταση', () => {
  expect(row(rowsOf('map-unavailable'), 'address')).toMatchObject({ ungrounded: 'map-unavailable', documentDisplay: null });
});

it('phone-fill ⇒ το τηλέφωνο λείπει, μπαίνει στη «Συμπλήρωση κενών», και διαβάζεται ως 231 055 9595', () => {
  const rows = rowsOf('phone-fill');
  const phone = row(rows, 'phone');
  expect(phone).toMatchObject({ ungrounded: null, state: 'missing', documentPrinted: '2310.55.95.95' });
  expect(readablePhone(phone.documentDisplay ?? '')).toBe('231 055 9595');
  expect(fillableEvidenceRows(rows).map((r) => r.key)).toContain('phone');
});
