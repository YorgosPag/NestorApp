/**
 * @fileoverview **ΟΙ ΑΔΕΙΕΣ ΤΗΣ ΕΠΑΦΗΣ** — ανάγνωση από τον δίσκο, σχηματισμός από τη φόρμα, με ΠΡΟΕΛΕΥΣΗ (ADR-915 §40.5).
 * @related types/contacts/contact-licences.ts · lib/agency/showcase-licence.ts (ο ίδιος σχηματισμός/αναγνώστης) ·
 *   lib/professional/licence-drafts.ts (η κατάσταση φόρμας)
 * @module lib/contacts/contact-licences
 *
 * 🔑 **Κανένας δεύτερος validator**: ο αριθμός, ο εκδότης και η αρχή κρίνονται από το `formShowcaseLicences` /
 *    `readShowcaseLicences` — εδώ προστίθεται **μόνο** η προέλευση.
 * 🔑 **Η τιμή που δεν άλλαξε κρατά την προέλευσή της**: ξανασώζοντας τη φόρμα, η άδεια που υιοθετήθηκε από τη δήλωση
 *    του ίδιου μένει `self-declared` με την αρχική ώρα. Νέα ή αλλαγμένη τιμή ⇒ `office`, τώρα.
 * Καθαρό leaf — καμία εισαγωγή SDK.
 */

import { PROFESSIONAL_LICENCES } from '@/config/professional-licences';
import { formShowcaseLicences, readShowcaseLicences, type ShowcaseLicenceRejection } from '@/lib/agency/showcase-licence';
import { licenceWireOf, type LicenceDrafts } from '@/lib/professional/licence-drafts';
import type { ShowcaseLicence } from '@/types/agency-profile';
import {
  CONTACT_LICENCE_SOURCES,
  type ContactLicence,
  type ContactLicenceProvenance,
  type ContactLicenceSource,
} from '@/types/contacts/contact-licences';

/** Οι λόγοι άρνησης που φτάνουν από τη φόρμα επαφής (η επαφή δεν έχει βιτρίνα ούτε ειδικότητες να διπλοδηλώσει). */
export type ContactLicenceRejection = Extract<
  ShowcaseLicenceRejection,
  'licence-number-missing' | 'licence-duplicate' | 'licence-chapter-missing'
>;

function isContactLicenceSource(value: unknown): value is ContactLicenceSource {
  return typeof value === 'string' && (CONTACT_LICENCE_SOURCES as readonly string[]).includes(value);
}

/** Η προέλευση μιας αποθηκευμένης γραμμής — `null` αν δεν περνά τον φρουρό (η γραμμή τότε παραλείπεται). */
function readProvenance(raw: unknown): ContactLicenceProvenance | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (!isContactLicenceSource(row.source) || typeof row.recordedAt !== 'string' || row.recordedAt === '') return null;
  const engagementId = typeof row.engagementId === 'string' && row.engagementId !== '' ? row.engagementId : null;
  return { source: row.source, recordedAt: row.recordedAt, engagementId: row.source === 'self-declared' ? engagementId : null };
}

/** Μία αποθηκευμένη γραμμή ⇒ άδεια με προέλευση, ή `null` (παραλείπεται — ποτέ μαντεψιά). */
function readContactLicence(raw: unknown): ContactLicence | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const [held] = readShowcaseLicences([raw]);
  const provenance = readProvenance((raw as Record<string, unknown>).provenance);
  return held !== undefined && provenance !== null ? { ...held, provenance } : null;
}

/**
 * Οι άδειες ενός αποθηκευμένου εγγράφου επαφής. Απόν πεδίο ⇒ `[]` (επαφή γραμμένη πριν υπάρξουν άδειες δεν έχει
 * καμία)· μη αναγνώσιμη γραμμή παραλείπεται· δεύτερη γραμμή της **ίδιας** άδειας παραλείπεται (κρατιέται η πρώτη).
 */
export function readContactLicences(raw: unknown): readonly ContactLicence[] {
  if (!Array.isArray(raw)) return [];
  const read = raw.map(readContactLicence).filter((licence): licence is ContactLicence => licence !== null);
  return read.filter((licence, index) => read.findIndex((other) => other.licence === licence.licence) === index);
}

/** Ίδιος αριθμός **και** ίδιος εκδότης — η μόνη ταυτότητα τιμής που μετρά για την προέλευση. */
export function sameLicenceValue(a: ShowcaseLicence, b: ShowcaseLicence): boolean {
  const ra = a.attestation.registration;
  const rb = b.attestation.registration;
  if (a.licence !== b.licence || ra.number !== rb.number) return false;
  const chapterA = ra.authorityKind === 'chapter' ? ra.chapter : null;
  const chapterB = rb.authorityKind === 'chapter' ? rb.chapter : null;
  return chapterA === chapterB;
}

/**
 * Από τη φόρμα στις άδειες της επαφής — με **ονομασμένη** άρνηση. Αμετάβλητη τιμή ⇒ κρατά την προέλευσή της· νέα ή
 * αλλαγμένη ⇒ `office`, `recordedAt = nowIso`.
 */
export function contactLicencesFromDrafts(
  existing: readonly ContactLicence[],
  drafts: LicenceDrafts,
  nowIso: string,
): { readonly licences: readonly ContactLicence[] } | { readonly reason: ContactLicenceRejection } {
  const formed = formShowcaseLicences(licenceWireOf(drafts, []));
  if ('reason' in formed) return { reason: narrowRejection(formed.reason) };
  const licences = formed.licences.map((licence): ContactLicence => {
    const kept = existing.find((held) => sameLicenceValue(held, licence));
    return kept ?? { ...licence, provenance: { source: 'office', recordedAt: nowIso, engagementId: null } };
  });
  return { licences: sortByVocabulary(licences) };
}

/** Τα δύο λεξιλόγια επικαλύπτονται· όσα η επαφή δομικά δεν παράγει (βιτρίνα/ειδικότητα) πέφτουν στο «λείπει αριθμός». */
function narrowRejection(reason: ShowcaseLicenceRejection): ContactLicenceRejection {
  return reason === 'licence-duplicate' || reason === 'licence-chapter-missing' ? reason : 'licence-number-missing';
}

/** Σταθερή σειρά (του λεξιλογίου) ⇒ καμία ψευδής αλλαγή στο ίχνος από αναδιάταξη. */
export function sortByVocabulary(licences: readonly ContactLicence[]): readonly ContactLicence[] {
  return [...licences].sort((a, b) => PROFESSIONAL_LICENCES.indexOf(a.licence) - PROFESSIONAL_LICENCES.indexOf(b.licence));
}
