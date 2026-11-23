/**
 * @fileoverview **«ΑΠΟΔΟΧΗ» ΤΙΜΗΣ ΕΓΓΡΑΦΟΥ** — γεμίζει τη φόρμα, τίποτα άλλο (ADR-950 §4.5).
 * @module lib/contacts/contact-evidence-acceptance
 *
 * 🔑 Ίδιο πρότυπο με το «Δέξου» του ADR-948 (`lib/company/registry-form-acceptance`): **νέα** `formData` με **ένα**
 *    πεδίο αλλαγμένο. Η εγγραφή περνά από την **υπάρχουσα** αποθήκευση — 4 φρουροί (`submission-guard-chain`:
 *    ADR-249/277/278/280) + Ιστορικό CDC (ADR-195). Ένα route που θα έγραφε απευθείας θα τους **παρέκαμπτε**.
 * 🔑 Τηλέφωνο: **προστίθεται**, ποτέ δεν αντικαθιστά — η επαφή μπορεί να έχει πολλά.
 * 🔑 Διεύθυνση: **δεν** γράφεται εδώ· βγαίνει ως πρόταση (`evidenceSeatProposal`) προς τον ιδιοκτήτη της έδρας.
 *
 * **Layering**: καθαρή — καμία I/O.
 */

import { splitCountryCallingCode } from '@/lib/contact/channel-phone';
import { phoneTypeForLineType } from '@/lib/contact/phone-type-vocabulary';
import type { SeatFields } from '@/lib/company/contact-registry-comparison';
import type { RegistrySeatApplication } from '@/lib/company/registry-form-acceptance';
import { isEvidenceActionable, type EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import type { ContactType, PhoneInfo } from '@/types/contacts/contracts';
import type { ContactFormData } from '@/types/ContactFormTypes';

/** Αξίζει «Αποδοχή»; Γειωμένη τιμή · θέλει κρίση · η πολιτική το επιτρέπει · (persona) η persona είναι ενεργή. */
export function canAcceptEvidence(row: EvidenceRow, formData: ContactFormData): boolean {
  if (row.documentDisplay === null || !isEvidenceActionable(row)) return false;
  switch (row.acceptance) {
    case 'form-field':
    case 'append-phone':
      return true;
    case 'persona-field':
      return formData.activePersonas?.includes('engineer') ?? false;
    case 'propose-address':
    case 'compare-only':
      return false;
  }
}

/** Αξίζει πρόταση έδρας; Ίδιος κανόνας με το ADR-948 `canProposeRegistrySeat`. */
export function canProposeEvidenceSeat(row: EvidenceRow): boolean {
  return row.acceptance === 'propose-address' && row.seat !== null && row.documentDisplay !== null && isEvidenceActionable(row);
}

/**
 * 🔴 2026-11-23 (ζωντανός έλεγχος): το σταθερό «2310 55 95 95» μπήκε ως «Κινητό» — ο τύπος ήταν η προεπιλογή του
 * κατόχου. Πλέον βγαίνει από τον **τύπο γραμμής** που σφράγισε ο διακομιστής (libphonenumber `/max`, ADR-950 §8.5),
 * μέσω της ΜΙΑΣ αντιστοίχισης `phoneTypeForLineType`· χωρίς τεκμήριο (παλιά ανάγνωση) ⇒ η προεπιλογή, όπως πριν.
 */
function appendPhone(formData: ContactFormData, row: EvidenceRow, e164: string, contactType: ContactType): ContactFormData {
  const split = splitCountryCallingCode(e164);
  if (split === null) return formData;
  const phones = formData.phones ?? [];
  const phone: PhoneInfo = {
    number: split.number,
    countryCode: split.countryCode,
    type: phoneTypeForLineType(row.phoneLineType ?? undefined, contactType),
    isPrimary: phones.length === 0,
  };
  return { ...formData, phones: [...phones, phone] };
}

function setPersonaTee(formData: ContactFormData, value: string): ContactFormData {
  const personaData = formData.personaData ?? {};
  return { ...formData, personaData: { ...personaData, engineer: { ...(personaData.engineer ?? {}), teeRegistryNumber: value } } };
}

/** «Αποδοχή»: νέα `formData` με την τιμή του εγγράφου στο **ένα** πεδίο — τίποτα άλλο δεν αγγίζεται. */
export function acceptEvidence(formData: ContactFormData, row: EvidenceRow, contactType: ContactType): ContactFormData {
  const value = row.documentDisplay;
  if (value === null || !canAcceptEvidence(row, formData)) return formData;
  if (row.acceptance === 'append-phone') return appendPhone(formData, row, value, contactType);
  if (row.acceptance === 'persona-field') return setPersonaTee(formData, value);
  const target = row.target;
  if (target === 'personFullName' || target === 'phones' || target === 'headquarters' || target === 'engineerTeeRegistryNumber') {
    return formData;
  }
  return { ...formData, [target]: value };
}

/**
 * Η έδρα του εγγράφου ως πρόταση (`HqAddressProposal.seat`). Μέρος που δεν γειώθηκε ⇒ `null` ⇒ ο editor κρατά ό,τι έχει
 * η φόρμα (`registrySeatAsAddressFields` + `applyResolvedToContactAddress`, ίδια διαδρομή με το ADR-948).
 */
export function evidenceSeatProposal(row: EvidenceRow): { readonly seat: SeatFields; readonly application: RegistrySeatApplication } | null {
  if (!canProposeEvidenceSeat(row) || row.seat === null) return null;
  // Ίδιος κανόνας με το ΓΕΜΗ (ADR-948 §8.7.4): «διαφέρει» = άλλη διεύθυνση ⇒ αντικατάσταση· αλλιώς συμπλήρωση.
  return { seat: row.seat.document, application: row.state === 'differs' ? 'replace' : 'complete' };
}

// ============================================================================
// ADR-950 §8.6 — «ΣΥΜΠΛΗΡΩΣΗ ΚΕΝΩΝ»: πολλές αποδοχές, ΜΙΑ αλλαγή φόρμας
// ============================================================================

/**
 * Οι γραμμές που γεμίζουν **κενό** πεδίο της επαφής με **γειωμένη** τιμή του εγγράφου (Salesforce «Compare & Update»,
 * HubSpot enrichment «fill empty only»): `missing` και αποδεκτή. Ποτέ αντικατάσταση υπάρχουσας τιμής (`differs`),
 * ποτέ αβέβαιη (`disputed` · `unverified` · δυσανάγνωστη) — αυτές δεν φτάνουν καν σε `missing`.
 */
export function fillableEvidenceRows(rows: readonly EvidenceRow[], formData: ContactFormData): readonly EvidenceRow[] {
  return rows.filter((row) => row.state === 'missing' && canAcceptEvidence(row, formData));
}

/** Η διεύθυνση ως **πρόταση** στη συμπλήρωση — μόνο όταν η έδρα της επαφής είναι κενή. */
export function fillableEvidenceSeat(rows: readonly EvidenceRow[]): EvidenceRow | null {
  return rows.find((row) => row.state === 'missing' && canProposeEvidenceSeat(row)) ?? null;
}

/** Όλες οι επιλεγμένες αποδοχές σε **μία** νέα `formData` — η ίδια `acceptEvidence` ανά γραμμή, καμία δεύτερη λογική. */
export function acceptEvidenceBatch(formData: ContactFormData, rows: readonly EvidenceRow[], contactType: ContactType): ContactFormData {
  return rows.reduce((next, row) => acceptEvidence(next, row, contactType), formData);
}
