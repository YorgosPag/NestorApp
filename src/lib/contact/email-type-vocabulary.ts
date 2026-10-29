/**
 * 📧 SSoT — **το λεξιλόγιο του τύπου email** μιας επαφής, **ποιο υποσύνολό του προσφέρει κάθε κάτοχος**, και ο ΕΝΑΣ
 * κανόνας για τον τύπο μιας διεύθυνσης που κανείς δεν δήλωσε.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-29, ADR-327 §8.5.4 — ίδια κλάση με το ☎️)**: ο τύπος `EmailInfo` δήλωνε
 * `personal|work|invoice|notification|support|other` ενώ η φόρμα εταιρείας γράφει `general/info/sales…` (αποθηκευμένα:
 * MACON ATEE `info`, τρεις εταιρείες `general`). Και οι γραφείς διαφωνούσαν: το AI έγραφε `work` σε **εταιρεία** (κενή
 * λίστα «Τύπος»), ενώ το `resolve` έγραφε `general`/`info` σε **πρόσωπο** (κενή λίστα, ανάποδα).
 *
 * 🔑 **ΕΝΑ σύνολο τιμών, υποσύνολα ανά κάτοχο** — όπως το Google People API (`EmailAddress.type`: ένα επίπεδο
 * λεξιλόγιο + ελεύθερο κείμενο) και το vCard RFC 6350 `EMAIL;TYPE`. Η ρίζα είναι η ΕΝΩΣΗ· ο κάτοχος αποφασίζει τι
 * **προσφέρεται** και ποια είναι η **προεπιλογή**· το ελεύθερο κείμενο ζει στο `label`. Οι `invoice`/`notification`
 * είναι γραμμές δρομολόγησης του οργανογράμματος (ADR-326) — μέλη της ρίζας, όχι της φόρμας.
 *
 * Καθαρό (χωρίς ετικέτες/React/`server-only`) ⇒ το διαβάζουν πελάτης (φόρμα, σάρωση προσφοράς) και server.
 *
 * @module lib/contact/email-type-vocabulary
 */

import type { ContactOwnerKind } from './contact-owner-kind';
import { isOfferedBy, isVocabularyMember } from './owned-type-vocabulary';

/** Όλοι οι τύποι email που μπορεί να έχει αποθηκευμένη επαφή (CHECK 3.73 — ρίζα `email-type`). */
export const EMAIL_TYPES = [
  'personal', 'work', 'general', 'department', 'secretariat', 'sales', 'support', 'info', 'invoice', 'notification', 'other',
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number];

/** Οι τύποι που **προσφέρει** κάθε κάτοχος, με τη σειρά της λίστας της φόρμας (`as const` ⇒ ετικέτες ελεγμένες). */
export const EMAIL_TYPES_BY_OWNER = {
  individual: ['personal', 'work', 'other'],
  company: ['general', 'department', 'sales', 'support', 'info', 'other'],
  service: ['general', 'department', 'secretariat', 'info', 'other'],
} as const satisfies Readonly<Record<ContactOwnerKind, readonly EmailType[]>>;

/** Οι τύποι που προσφέρει ο κάτοχος `O` — το κλειδί του πίνακα ετικετών του. */
export type OfferedEmailType<O extends ContactOwnerKind> = (typeof EMAIL_TYPES_BY_OWNER)[O][number];

/** Ο πίνακας ετικετών ενός κατόχου: ΥΠΟΧΡΕΩΤΙΚΑ κάθε τύπος που προσφέρει, και μόνο τιμές της ρίζας. */
export type EmailTypeLabels<O extends ContactOwnerKind> = Record<OfferedEmailType<O>, string> & Partial<Record<EmailType, string>>;

/** Η προεπιλογή κάθε κατόχου — ό,τι γράφεται όταν κανείς (άνθρωπος, AI, σάρωση) δεν είπε κάτι άλλο. */
export const DEFAULT_EMAIL_TYPE = {
  individual: 'personal',
  company: 'general',
  service: 'general',
} as const satisfies { readonly [O in ContactOwnerKind]: OfferedEmailType<O> };

export function isEmailType(value: unknown): value is EmailType {
  return isVocabularyMember(EMAIL_TYPES, value);
}

export function isEmailTypeOfferedFor(type: unknown, owner: ContactOwnerKind): type is EmailType {
  return isOfferedBy<EmailType>(EMAIL_TYPES_BY_OWNER, owner, type);
}

/**
 * Γνωστά τοπικά μέρη ρόλου (`info@`, `sales@`…) — ο **ρόλος** του γραμματοκιβωτίου ενός οργανισμού. Σε πρόσωπο δεν
 * σημαίνουν τίποτα (`info@nikolaou.gr` ενός μηχανικού είναι το δικό του email εργασίας).
 */
const ROLE_MAILBOX_TYPE: Readonly<Record<string, EmailType>> = {
  info: 'info', information: 'info', contact: 'info', office: 'general',
  sales: 'sales', sale: 'sales', orders: 'sales',
  support: 'support', help: 'support', helpdesk: 'support',
  hr: 'department', accounting: 'department', logistics: 'department',
  secretariat: 'secretariat', grammateia: 'secretariat',
};

/**
 * Ο τύπος μιας διεύθυνσης χωρίς δηλωμένη ετικέτα — **πάντα μέσα στο υποσύνολο του κατόχου**.
 *
 * - **Εταιρεία / υπηρεσία** ⇒ ο ρόλος από το τοπικό μέρος (`info@` ⇒ `info`), **μόνο** αν ο κάτοχος τον προσφέρει
 *   (υπηρεσία δεν έχει «πωλήσεις» ⇒ `sales@` ⇒ η προεπιλογή)· αλλιώς η προεπιλογή του κατόχου.
 * - **Πρόσωπο** ⇒ ό,τι ξέρει ο καλών για το πλαίσιο (`work` για υπογράφοντα, αποστολέα, πινακίδα σχεδίου), αλλιώς
 *   η προεπιλογή — ποτέ μαντεψιά από το τοπικό μέρος.
 */
export function inferEmailType(
  address: string,
  owner: ContactOwnerKind,
  individualType: OfferedEmailType<'individual'> = DEFAULT_EMAIL_TYPE.individual,
): EmailType {
  if (owner === 'individual') return individualType;
  const localPart = address.trim().split('@')[0]?.toLowerCase() ?? '';
  const role = Object.hasOwn(ROLE_MAILBOX_TYPE, localPart) ? ROLE_MAILBOX_TYPE[localPart] : undefined;
  return role !== undefined && isEmailTypeOfferedFor(role, owner) ? role : DEFAULT_EMAIL_TYPE[owner];
}
