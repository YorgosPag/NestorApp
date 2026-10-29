/**
 * ☎️ SSoT — **το λεξιλόγιο του τύπου τηλεφώνου** μιας επαφής, και **ποιο υποσύνολό του προσφέρει κάθε κάτοχος**.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-29, ADR-327 §8.5.4 — μετρημένο ζωντανά)**: το τηλέφωνο της MACON ATEE (εταιρεία) είχε
 * `type: 'mobile'` και η λίστα «Τύπος» της φόρμας έμενε **κενή**: για εταιρεία το UI προσφέρει μόνο
 * `main/department/secretariat/sales/support/fax/other`. Και η διόρθωση της ίδιας μέρας (`inferPhoneType`: σταθερό
 * εταιρείας ⇒ `work`) θα έδινε **επίσης** κενό. Το λεξιλόγιο δηλωνόταν σε **έξι** σημεία που διαφωνούσαν
 * (`PhoneInfo.type`, `OrgPhoneInfo.type`, `PhoneEntry.type`, `CommunicationConfigs`, οι χάρτες του AI, ο server)·
 * ο τύπος `PhoneInfo` δεν ήξερε καν το `main` που το UI προτείνει ως προεπιλογή.
 *
 * 🔑 **ΕΝΑ σύνολο τιμών, υποσύνολα ανά κάτοχο** — όπως το Google People API (ένα επίπεδο λεξιλόγιο για όλες τις
 * επαφές, με `main`) και το vCard (RFC 6350 `TEL;TYPE` + RFC 7852 `main-number`). Η ρίζα είναι η ΕΝΩΣΗ· ο κάτοχος
 * αποφασίζει τι **προσφέρεται** και ποια είναι η **προεπιλογή**. Σε εταιρεία/υπηρεσία ο άξονας είναι ο **ρόλος** της
 * γραμμής (κεντρικό, τμήμα, πωλήσεις…), όχι το αν είναι κινητό ή σταθερό.
 *
 * Καθαρό (χωρίς ετικέτες/React/metadata) ⇒ το διαβάζουν και πελάτης και server. Οι ετικέτες ζουν στο
 * `constants/domains/communication-labels.ts`, τυπωμένες πάνω σε αυτή τη ρίζα.
 *
 * @module lib/contact/phone-type-vocabulary
 */

import { contactOwnerKindOf, type ContactOwnerKind } from './contact-owner-kind';
import { isOfferedBy, isVocabularyMember } from './owned-type-vocabulary';

/** Όλοι οι τύποι τηλεφώνου που μπορεί να έχει αποθηκευμένη επαφή (CHECK 3.73 — ρίζα `phone-type`). */
export const PHONE_TYPES = [
  'mobile', 'home', 'work', 'main', 'department', 'secretariat', 'sales', 'support', 'helpdesk', 'fax', 'internal', 'other',
] as const;

export type PhoneType = (typeof PHONE_TYPES)[number];

/** Τίνος είναι ο αριθμός — ψευδώνυμο του ΕΝΟΣ άξονα κατόχου (`contact-owner-kind.ts`), κοινού με email/ιστοσελίδα/social. */
export type PhoneOwnerKind = ContactOwnerKind;

/** Ο κάτοχος από το πεδίο `type` ενός εγγράφου επαφής — ψευδώνυμο του `contactOwnerKindOf`. */
export const phoneOwnerKindOf = contactOwnerKindOf;

/**
 * Οι τύποι που **προσφέρει** κάθε κάτοχος, με τη σειρά της λίστας της φόρμας. Κυριολεκτικοί πίνακες (`as const`) ώστε
 * ο πίνακας ετικετών κάθε κατόχου να ελέγχεται από τον μεταγλωττιστή: τιμή χωρίς ετικέτα ⇒ σφάλμα, όχι κενό στην οθόνη.
 */
export const PHONE_TYPES_BY_OWNER = {
  individual: ['mobile', 'home', 'work', 'fax', 'other'],
  company: ['main', 'department', 'secretariat', 'sales', 'support', 'fax', 'other'],
  service: ['main', 'department', 'secretariat', 'helpdesk', 'fax', 'other'],
} as const satisfies Readonly<Record<PhoneOwnerKind, readonly PhoneType[]>>;

/** Οι τύποι που προσφέρει ο κάτοχος `O` — το κλειδί του πίνακα ετικετών του. */
export type OfferedPhoneType<O extends PhoneOwnerKind> = (typeof PHONE_TYPES_BY_OWNER)[O][number];

/**
 * Ο πίνακας ετικετών τύπου τηλεφώνου ενός κατόχου: ΥΠΟΧΡΕΩΤΙΚΑ κάθε τύπος που προσφέρει, και μόνο τιμές της ρίζας
 * (επιτρέπονται επιπλέον τιμές της ρίζας, π.χ. `internal` για PBX).
 */
export type PhoneTypeLabels<O extends PhoneOwnerKind> = Record<OfferedPhoneType<O>, string> & Partial<Record<PhoneType, string>>;

/** Η προεπιλογή κάθε κατόχου — ό,τι γράφεται όταν κανείς (άνθρωπος, AI, βιβλιοθήκη) δεν είπε κάτι άλλο. */
export const DEFAULT_PHONE_TYPE: Readonly<Record<PhoneOwnerKind, PhoneType>> = {
  individual: 'mobile',
  company: 'main',
  service: 'main',
};

/** `true` όταν η τιμή ανήκει στη ρίζα — το σύνορο εισόδου από φόρμα/εξωτερικά δεδομένα, αντί για τυφλό `as`. */
export function isPhoneType(value: unknown): value is PhoneType {
  return isVocabularyMember(PHONE_TYPES, value);
}

/** `true` όταν ο τύπος ανήκει στο υποσύνολο του κατόχου — αλλιώς η φόρμα θα τον έδειχνε κενό. */
export function isPhoneTypeOfferedFor(type: string, owner: PhoneOwnerKind): type is PhoneType {
  return isOfferedBy<PhoneType>(PHONE_TYPES_BY_OWNER, owner, type);
}
