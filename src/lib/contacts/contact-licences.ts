/**
 * @fileoverview **ΟΙ ΑΔΕΙΕΣ ΤΗΣ ΕΠΑΦΗΣ** — ανάγνωση από τον δίσκο, σχηματισμός από τη φόρμα, με ΠΡΟΕΛΕΥΣΗ (ADR-915 §40.5).
 * @related types/contacts/contact-licences.ts · lib/agency/showcase-licence.ts (ο ίδιος σχηματισμός/αναγνώστης) ·
 *   lib/professional/licence-drafts.ts (η κατάσταση φόρμας)
 * @module lib/contacts/contact-licences
 *
 * 🔑 **Κανένας δεύτερος validator**: ο αριθμός, ο εκδότης και η αρχή κρίνονται από το `formShowcaseLicences` /
 *    `readShowcaseLicences` — εδώ προστίθεται **μόνο** η προέλευση.
 * 🔑 **Το πεδίο που δεν άλλαξε κρατά την προέλευσή του** — **ανά πεδίο** (εγγραφή · τάξεις), όχι ανά άδεια (§40.5,
 *    πρακτική HubSpot property history): το γραφείο που συμπληρώνει τάξεις **δεν** μετατρέπει τον αριθμό που δήλωσε ο
 *    ίδιος σε «Καταχωρίστηκε από το γραφείο». Νέο ή αλλαγμένο πεδίο ⇒ `office`, τώρα.
 * Καθαρό leaf — καμία εισαγωγή SDK.
 */

import { PROFESSIONAL_LICENCES, type ProfessionalLicence } from '@/config/professional-licences';
import { formShowcaseLicences, readShowcaseLicences, type ShowcaseLicenceRejection } from '@/lib/agency/showcase-licence';
import {
  NO_LICENCE_DRAFTS,
  licenceWireOf,
  type LicenceDraft,
  type LicenceDrafts,
} from '@/lib/professional/licence-drafts';
import { sameLicenceGrades } from '@/lib/professional/licence-grades';
import type { ShowcaseLicence } from '@/types/agency-profile';
import {
  CONTACT_LICENCE_SOURCES,
  type ContactLicence,
  type ContactLicenceFieldProvenance,
  type ContactLicenceProvenance,
  type ContactLicenceSource,
} from '@/types/contacts/contact-licences';

/** Οι λόγοι άρνησης που φτάνουν από τη φόρμα επαφής (η επαφή δεν έχει βιτρίνα ούτε ειδικότητες να διπλοδηλώσει). */
export type ContactLicenceRejection = Extract<
  ShowcaseLicenceRejection,
  'licence-number-missing' | 'licence-duplicate' | 'licence-chapter-missing' | 'licence-grade-unknown'
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

/**
 * Μία αποθηκευμένη γραμμή ⇒ άδεια με προέλευση ανά πεδίο, ή `null` (παραλείπεται — ποτέ μαντεψιά).
 * Οι τάξεις χωρίς δική τους (έγκυρη) προέλευση παίρνουν της εγγραφής: γραμμή πριν από τη διάσπαση (§40.5) είχε ΜΙΑ
 * προέλευση που κάλυπτε όλη την άδεια — άρα αυτή **είναι** η προέλευση των τάξεών της, όχι εικασία.
 */
function readContactLicence(raw: unknown): ContactLicence | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const [held] = readShowcaseLicences([raw]);
  const row = raw as Record<string, unknown>;
  const provenance = readProvenance(row.provenance);
  if (held === undefined || provenance === null) return null;
  return withGradesProvenance({ ...held, provenance }, readProvenance(row.gradesProvenance) ?? provenance);
}

/** Η προέλευση των τάξεων **μόνο** όταν υπάρχουν τάξεις — ποτέ `gradesProvenance` χωρίς `grades`. */
function withGradesProvenance(
  licence: Omit<ContactLicence, 'gradesProvenance'>,
  gradesProvenance: ContactLicenceProvenance,
): ContactLicence {
  return licence.grades === undefined ? licence : { ...licence, gradesProvenance };
}

/** Η προέλευση μιας τιμής που μόλις έγραψε το γραφείο. */
function officeProvenance(nowIso: string): ContactLicenceProvenance {
  return { source: 'office', recordedAt: nowIso, engagementId: null };
}

/** Ίδια **εγγραφή**: ίδια άδεια, ίδιος αριθμός, ίδιος εκδότης — οι τάξεις δεν μετρούν (άλλο πεδίο, §40.5). */
export function sameLicenceRegistration(a: ShowcaseLicence, b: ShowcaseLicence): boolean {
  const ra = a.attestation.registration;
  const rb = b.attestation.registration;
  if (a.licence !== b.licence || ra.number !== rb.number) return false;
  const chapterA = ra.authorityKind === 'chapter' ? ra.chapter : null;
  const chapterB = rb.authorityKind === 'chapter' ? rb.chapter : null;
  return chapterA === chapterB;
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

/**
 * Ίδια εγγραφή **και** ίδιες τάξεις (ADR-915 §40.7) — ολόκληρη η τιμή της άδειας. Κρίνει πότε ο έλεγχος στο μητρώο
 * αφορά ό,τι δείχνει η φόρμα· η προέλευση κρίνεται **ανά πεδίο** ({@link sameLicenceRegistration} · `sameLicenceGrades`).
 */
export function sameLicenceValue(a: ShowcaseLicence, b: ShowcaseLicence): boolean {
  return sameLicenceRegistration(a, b) && sameLicenceGrades(a.grades, b.grades);
}

/**
 * Η προέλευση των τάξεων μιας νέας τιμής: αμετάβλητες ⇒ κρατούν τη δική τους· νέες/αλλαγμένες ⇒ `office`, τώρα.
 * Καμία τάξη ⇒ καμία προέλευση.
 */
function gradesProvenanceOf(held: ContactLicence | undefined, grades: ShowcaseLicence['grades'], nowIso: string): ContactLicenceProvenance {
  return held?.grades !== undefined && held.gradesProvenance !== undefined && sameLicenceGrades(held.grades, grades)
    ? held.gradesProvenance
    : officeProvenance(nowIso);
}

/** Μία άδεια της φόρμας απέναντι στην αποθηκευμένη της ίδιας άδειας — κάθε πεδίο κρατά ή ανανεώνει τη δική του προέλευση. */
function mergeLicence(held: ContactLicence | undefined, licence: ShowcaseLicence, nowIso: string): ContactLicence {
  if (held !== undefined && sameLicenceValue(held, licence)) return held;
  const provenance = held !== undefined && sameLicenceRegistration(held, licence) ? held.provenance : officeProvenance(nowIso);
  return withGradesProvenance({ ...licence, provenance }, gradesProvenanceOf(held, licence.grades, nowIso));
}

/**
 * Από τη φόρμα στις άδειες της επαφής — με **ονομασμένη** άρνηση. Η προέλευση κρίνεται **ανά πεδίο** (§40.5): αμετάβλητη
 * εγγραφή κρατά την προέλευσή της ακόμη κι αν άλλαξαν οι τάξεις, και αντίστροφα· νέο ή αλλαγμένο πεδίο ⇒ `office`, τώρα.
 */
export function contactLicencesFromDrafts(
  existing: readonly ContactLicence[],
  drafts: LicenceDrafts,
  nowIso: string,
): { readonly licences: readonly ContactLicence[] } | { readonly reason: ContactLicenceRejection } {
  const formed = formShowcaseLicences(licenceWireOf(drafts, []));
  if ('reason' in formed) return { reason: narrowRejection(formed.reason) };
  const licences = formed.licences.map((licence) =>
    mergeLicence(existing.find((held) => held.licence === licence.licence), licence, nowIso));
  return { licences: sortByVocabulary(licences) };
}

/**
 * **Υιοθέτηση της δήλωσης του ίδιου** (ADR-915 §40.6) — γράφει **μόνο** το πεδίο που δηλώθηκε, την εγγραφή. Οι τάξεις
 * που είχε ήδη καταχωρίσει το γραφείο **μένουν**, με τη δική τους προέλευση: η υιοθέτηση του αριθμού δεν είναι λόγος να
 * σβηστεί ένα άλλο πεδίο που κανείς δεν ζήτησε να αλλάξει.
 */
export function adoptLicenceRegistration(
  held: ContactLicence | undefined,
  declared: ShowcaseLicence,
  provenance: ContactLicenceProvenance,
): ContactLicence {
  const base = { licence: declared.licence, attestation: declared.attestation, provenance };
  if (held?.grades === undefined || held.gradesProvenance === undefined) return base;
  return { ...base, grades: held.grades, gradesProvenance: held.gradesProvenance };
}

/**
 * Η **επεξεργασία** στέλνει dirty diff με `licenceDrafts` (κατάσταση φόρμας) — ποτέ `licences`. Εδώ γίνεται το πεδίο
 * που γράφεται, απέναντι στις **αποθηκευμένες** άδειες (κρατά την προέλευση των αμετάβλητων). Χωρίς `licenceDrafts` ⇒
 * το diff μένει ως έχει (το πεδίο δεν αγγίζεται). Άδειο αποτέλεσμα ⇒ `[]`, που ο καθαριστής κάνει `deleteField()`.
 * Η φόρμα δεν σχηματίζεται ⇒ μένουν οι αποθηκευμένες — ποτέ σιωπηλό σβήσιμο (ο έλεγχος έγινε ήδη στο validation).
 */
export function resolveLicenceDraftsForUpdate<T extends { readonly licenceDrafts?: LicenceDrafts }>(
  diff: T,
  storedRaw: unknown,
  nowIso: string,
): Omit<T, 'licenceDrafts'> & { licences?: ContactLicence[] } {
  const { licenceDrafts, ...rest } = diff;
  if (!licenceDrafts) return rest;
  const stored = readContactLicences(storedRaw);
  const formed = contactLicencesFromDrafts(stored, licenceDrafts, nowIso);
  return { ...rest, licences: 'reason' in formed ? [...stored] : [...formed.licences] };
}

/**
 * **Η αποθηκευμένη άδεια που δείχνει ΑΥΤΗ τη στιγμή η φόρμα** (ADR-915 §40.5 — προέλευση μέσα στο μπλοκ της άδειας).
 * Μόνο όταν το draft σχηματίζει **την ίδια τιμή** με την αποθηκευμένη (`sameLicenceValue`, μετά τον ίδιο σχηματισμό που
 * κάνει η αποθήκευση) — ξετσεκαρισμένη ή αλλαγμένη τιμή δεν έχει ακόμη προέλευση (θα γίνει `office` στην αποθήκευση).
 */
export function storedLicenceShownBy(
  stored: readonly ContactLicence[] | undefined,
  licence: ProfessionalLicence,
  draft: LicenceDraft | null,
): ContactLicence | null {
  if (!stored || draft === null) return null;
  const formed = formShowcaseLicences(licenceWireOf({ ...NO_LICENCE_DRAFTS, [licence]: draft }, []));
  if ('reason' in formed || formed.licences.length !== 1) return null;
  const [shown] = formed.licences;
  return stored.find((held) => sameLicenceValue(held, shown)) ?? null;
}

/**
 * **Η προέλευση ΑΝΑ ΠΕΔΙΟ που δείχνει αυτή τη στιγμή η φόρμα** (ADR-915 §40.5). Κάθε πεδίο έχει προέλευση μόνο όταν το
 * draft σχηματίζει **την ίδια** τιμή με την αποθηκευμένη — αλλαγμένη εγγραφή δεν σβήνει την προέλευση των αμετάβλητων
 * τάξεων, και αντίστροφα. Ξετσεκαρισμένη ή μη σχηματίσιμη άδεια ⇒ καμία.
 */
export function storedLicenceProvenanceShownBy(
  stored: readonly ContactLicence[] | undefined,
  licence: ProfessionalLicence,
  draft: LicenceDraft | null,
): ContactLicenceFieldProvenance {
  const none: ContactLicenceFieldProvenance = { registration: null, grades: null };
  const held = stored?.find((row) => row.licence === licence);
  if (held === undefined || draft === null) return none;
  const formed = formShowcaseLicences(licenceWireOf({ ...NO_LICENCE_DRAFTS, [licence]: draft }, []));
  if ('reason' in formed || formed.licences.length !== 1) return none;
  const [shown] = formed.licences;
  return {
    registration: sameLicenceRegistration(held, shown) ? held.provenance : null,
    grades: shown.grades !== undefined && sameLicenceGrades(held.grades, shown.grades) ? held.gradesProvenance ?? null : null,
  };
}

/** Τα δύο λεξιλόγια επικαλύπτονται· όσα η επαφή δομικά δεν παράγει (βιτρίνα/ειδικότητα) πέφτουν στο «λείπει αριθμός». */
function narrowRejection(reason: ShowcaseLicenceRejection): ContactLicenceRejection {
  return reason === 'licence-duplicate' || reason === 'licence-chapter-missing' || reason === 'licence-grade-unknown'
    ? reason
    : 'licence-number-missing';
}

/** Σταθερή σειρά (του λεξιλογίου) ⇒ καμία ψευδής αλλαγή στο ίχνος από αναδιάταξη. */
export function sortByVocabulary(licences: readonly ContactLicence[]): readonly ContactLicence[] {
  return [...licences].sort((a, b) => PROFESSIONAL_LICENCES.indexOf(a.licence) - PROFESSIONAL_LICENCES.indexOf(b.licence));
}
