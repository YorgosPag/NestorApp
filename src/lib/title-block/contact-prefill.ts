/**
 * @fileoverview Πρόσωπο πινακίδας → **προσυμπληρωμένη φόρμα επαφής** (ADR-759 Φ1, Άξονας Γ).
 *
 * 🔴 **ΔΕΝ είναι μέρος του Λ2 και δεν επιτρέπεται να γίνει.** Ο Λ2 (`title-block-proposals.ts`
 * και κάτω) απαντά «**ποια υπάρχουσα επαφή είναι αυτό το πρόσωπο;**» και είναι αποδεδειγμένα
 * καθαρός. Αυτό εδώ απαντά «**τι θα έγραφε ο άνθρωπος στη φόρμα αν την άνοιγε;**» — προετοιμασία
 * **εγγραφής**, όχι ταιριάσματος. Το ότι δεν το φτάνει κανείς από τον Λ2 το φυλάει άγκυρα στο
 * `__tests__/title-block-purity.test.ts`, όχι αυτό το σχόλιο.
 *
 * 🔑 **Καμία εγγραφή εδώ.** Παράγει `Partial<ContactFormData>` — η αποθήκευση περνά αυτούσια από
 * τον κανονικό δρόμο (`useContactSubmission` → `mapFormDataToContact` → `createContactWithPolicy`),
 * με το ίδιο enterprise id, τους ίδιους φύλακες και την ίδια επικύρωση (N.6, N.12). Δεύτερος
 * γραφέας επαφών θα ήταν sibling clone του χειρότερου είδους: **πιο αδύναμος** από τον υπάρχοντα.
 *
 * ## 🔴 Τα στοιχεία επικοινωνίας μιας πινακίδας ανήκουν στο ΓΡΑΦΕΙΟ — δομικά, όχι πιθανοτικά
 *
 * Δεν είναι εκτίμηση: ο ίδιος ο Λ1 τα αποδίδει **αυτούσια σε κάθε πρόσωπο** του κελιού
 * (`title-block-people.ts:155-161`, με το σχόλιο *«ανήκουν στο γραφείο… ο Λ2 θα αποφασίσει, με
 * άνθρωπο, ποιος τα κρατά στην καρτέλα του»*). Στο G753 **και οι δύο** μηχανικοί φέρουν
 * `info@nikolaou.com.gr` — και το domain ανήκει στον **έναν**.
 *
 * Ο Λ2 έχει ήδη κλείσει την πόρτα της **ταυτοποίησης** (`resolve-people.ts`: το όνομα είναι
 * αναγκαία συνθήκη). Η πόρτα της **δημιουργίας** ήταν ανοιχτή: προσυμπληρώνοντας αβασάνιστα,
 * γράφουμε το e-mail του συνεργάτη στην καρτέλα του Μαυρομιχάλη — δηλαδή **βάζουμε στη βάση
 * ακριβώς το ψέμα που ο ταιριαστής αρνείται να πιστέψει**, και από εκεί και πέρα το ταίριασμα
 * «e-mail» γίνεται αληθινό. Γι' αυτό τα κοινά στοιχεία δηλώνονται ({@link officeDetails}),
 * μπαίνουν ως `work` και **δεν γίνονται ποτέ πρωτεύοντα όταν υπάρχει εναλλακτική**.
 *
 * @module lib/title-block/contact-prefill
 */

import { getBridgeEntry, resolveRoleFromProfession } from '@/config/profession-bridge.config';
import { ensureHttpUrl } from '@/lib/validation/email-validation';
import { EnterpriseContactSaver } from '@/utils/contacts/EnterpriseContactSaver';
import { splitGreekPersonName, type GreekNameOrderSignal } from '@/utils/greek-name-order';
import type { ProjectRole } from '@/types/entity-associations';
import type { EmailInfo, PhoneInfo, WebsiteInfo } from '@/types/contacts/contracts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { BindingProposal } from '@/types/title-block-binding';
import type { TitleBlockPerson, TitleBlockReading } from '@/types/title-block-reading';

/** Ένα πρόσωπο πινακίδας γίνεται πάντα **φυσικό πρόσωπο** — ποτέ εταιρεία ή υπηρεσία. */
const CONTACT_TYPE = 'individual' as const;

/** Το πρόσωπο μιας πρότασης, **μαζί με τους συναδέλφους του στο ίδιο κελί**. */
export interface ProposalPerson {
  readonly person: TitleBlockPerson;
  readonly everyone: readonly TitleBlockPerson[];
}

/**
 * Από ποιο πρόσωπο της ανάγνωσης γεννήθηκε αυτή η πρόταση.
 *
 * 🔑 **Το `everyone` δεν είναι συνοδευτικό — είναι ο μισός λόγος ύπαρξης της συνάρτησης.** Το
 * `TitleBlockPerson` από μόνο του **δεν μπορεί** να πει αν το `info@nikolaou.com.gr` είναι δικό
 * του ή του γραφείου· η απάντηση υπάρχει μόνο σε σχέση με τα **υπόλοιπα** πρόσωπα του κελιού.
 * Επιστρέφοντας μόνο το πρόσωπο, ο καταναλωτής θα ήταν υποχρεωμένος να ξαναβρεί το κελί — και
 * κάποιος, κάποτε, δεν θα το έκανε.
 *
 * Η αναζήτηση γίνεται με το `displayName`, που είναι και το `personName` της πρότασης
 * (`resolve-people.ts`). Δύο ομώνυμοι στο **ίδιο** κελί δίνουν το ίδιο αποτέλεσμα, και αυτό
 * είναι σωστό: μοιράζονται ούτως ή άλλως ολόκληρη τη γραμμή επικοινωνίας του γραφείου.
 */
export function findProposalPerson(
  proposal: BindingProposal,
  readings: readonly TitleBlockReading[],
): ProposalPerson | null {
  if (!proposal.personName) return null;
  const everyone = readings[proposal.titleBlockIndex]?.people;
  if (!everyone) return null;
  const person = everyone.find((p) => p.displayName === proposal.personName);
  return person ? { person, everyone } : null;
}

/**
 * Ένα στοιχείο επικοινωνίας που γράφτηκε **μία φορά για όλους** τους μηχανικούς του κελιού.
 *
 * Το `value` είναι ωμό επίτηδες: αυτό ακριβώς δείχνεται στον άνθρωπο, όπως και η μαρτυρία του
 * Λ2 δείχνει την τιμή που ταίριαξε αντί για ποσοστό.
 */
export interface OfficeDetail {
  readonly kind: 'phone' | 'email' | 'website';
  readonly value: string;
}

export interface TitleBlockContactPrefill {
  /** Τα πεδία που θα δει συμπληρωμένα ο άνθρωπος. Ό,τι λείπει μένει στις προεπιλογές. */
  readonly formData: Partial<ContactFormData>;
  /** Κοινά στοιχεία γραφείου — **δηλωμένα**, όχι κρυμμένα (ADR-745 §8 κανόνας 3). */
  readonly officeDetails: readonly OfficeDetail[];
  /** Πόσο βέβαιη είναι η σειρά `όνομα`/`επώνυμο` — δες {@link GreekNameOrderSignal}. */
  readonly nameSignal: GreekNameOrderSignal;
  /** Ο ρόλος που δίνει η ειδικότητα, όταν δίνει **έναν**· αλλιώς `null`. */
  readonly role: ProjectRole | null;
}

/**
 * Τα στοιχεία που εμφανίζονται σε **περισσότερα από ένα** πρόσωπα του ίδιου κελιού.
 *
 * Σύγκριση στο **ωμό** κείμενο, χωρίς κανονικοποίηση, και αυτό είναι σκόπιμο: όταν ο Λ1 γράφει
 * μία φορά για όλους, οι συμβολοσειρές είναι **ταυτόσημες** — άρα η ωμή σύγκριση είναι ακριβής
 * και δεν μπορεί να παραγάγει ψευδώς θετικό. Μια κανονικοποίηση εδώ θα έλεγε «κοινό» σε δύο
 * γραφές του ίδιου νούμερου κάτω από **διαφορετικούς** ανθρώπους, που είναι άλλο γεγονός.
 */
function officeValues(
  everyone: readonly TitleBlockPerson[],
  pick: (person: TitleBlockPerson) => readonly string[],
): ReadonlySet<string> {
  const counts = new Map<string, number>();
  for (const person of everyone) {
    for (const value of new Set(pick(person))) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([value]) => value));
}

/**
 * Ποιο στοιχείο γίνεται πρωτεύον.
 *
 * 🔴 Ο έλεγχος του `validateCommunicationArrays` απαιτεί **ακριβώς ένα** `isPrimary` σε μη κενό
 * πίνακα, οπότε το «κανένα» δεν είναι επιλογή: θα έφραζε την αποθήκευση σε δεδομένα που ο
 * άνθρωπος δεν πληκτρολόγησε. Άρα προτιμάται το πρώτο **μη κοινό** και, όταν όλα είναι κοινά
 * (η περίπτωση του G753), το πρώτο — με τη διαφορά να είναι δηλωμένη στο {@link officeDetails}.
 */
function primaryIndexOf(values: readonly string[], office: ReadonlySet<string>): number {
  const own = values.findIndex((value) => !office.has(value));
  return own === -1 ? 0 : own;
}

function toPhones(values: readonly string[], office: ReadonlySet<string>): PhoneInfo[] {
  const primary = primaryIndexOf(values, office);
  // `work` για όλα, χωρίς ανίχνευση κινητού: η γραμμή επικοινωνίας μιας πινακίδας **είναι** το
  // γραφείο (δες την κεφαλίδα), και ένα «mobile» θα ήταν συμπέρασμα από τη μορφή του αριθμού —
  // δηλαδή δεύτερο αντίγραφο γνώσης που ζει στο `GREEK_PHONE_REGEX`, για μηδέν κέρδος.
  return values.map((number, i) => ({ number, type: 'work', isPrimary: i === primary }));
}

function toEmails(values: readonly string[], office: ReadonlySet<string>): EmailInfo[] {
  const primary = primaryIndexOf(values, office);
  return values.map((email, i) => ({ email, type: 'work', isPrimary: i === primary }));
}

function toWebsites(values: readonly string[]): WebsiteInfo[] {
  // Ο Λ1 εξάγει και **γυμνό** host (`www.nikolaou.com.gr`) — δες `WEB_URL_EXTRACT_REGEX`. Χωρίς
  // σχήμα, ο `isValidUrl` που φυλά την αποθήκευση το απορρίπτει: παραγωγός και επικυρωτής
  // διαφωνούσαν εκ κατασκευής. Το `ensureHttpUrl` είναι η **μία** απάντηση.
  return values.map((url) => ({
    url: ensureHttpUrl(url),
    type: EnterpriseContactSaver.getWebsiteTypeForContactType(CONTACT_TYPE),
    label: EnterpriseContactSaver.getWebsiteLabelForContactType(CONTACT_TYPE),
  }));
}

/** Τα πεδία ESCO — **μόνο** όταν η ειδικότητα ονομάζει ακριβώς έναν ρόλο. */
function escoFields(role: ProjectRole | null): Partial<ContactFormData> {
  const entry = role ? getBridgeEntry(role) : null;
  if (!entry) return {};
  return { escoUri: entry.escoUri ?? '', escoLabel: entry.escoLabel, iscoCode: entry.iscoCode };
}

function markOffice(
  kind: OfficeDetail['kind'],
  values: readonly string[],
  office: ReadonlySet<string>,
): OfficeDetail[] {
  return values.filter((value) => office.has(value)).map((value) => ({ kind, value }));
}

/**
 * Ό,τι γνωρίζει η πινακίδα για **αυτό** το πρόσωπο, σε μορφή φόρμας επαφής.
 *
 * @param person το πρόσωπο που δεν βρέθηκε στη βάση (`blockedBy: 'no-match'`)
 * @param everyone **όλα** τα πρόσωπα του ίδιου κελιού — χωρίς αυτά δεν ξεχωρίζει τι είναι
 *   στοιχείο γραφείου, και η προσυμπλήρωση γράφει σιωπηλά τον έναν μηχανικό πάνω στον άλλο
 */
export function buildContactPrefill(
  person: TitleBlockPerson,
  everyone: readonly TitleBlockPerson[],
): TitleBlockContactPrefill {
  const name = splitGreekPersonName(person.displayName);
  const role = resolveRoleFromProfession(person.professionText);

  const officePhones = officeValues(everyone, (p) => p.phones);
  const officeEmails = officeValues(everyone, (p) => p.emails);
  const officeSites = officeValues(everyone, (p) => p.websites);

  return {
    formData: {
      type: CONTACT_TYPE,
      firstName: name.firstName,
      lastName: name.lastName,
      // Το αρχικό (`ΕΥ.`) **δεν είναι όνομα** και δεν προσποιείται ότι είναι — αλλά είναι ό,τι
      // γνωρίζει το σχέδιο για το πατρώνυμο, και το πεδίο το δείχνει ώστε να συμπληρωθεί ή να
      // σβηστεί από άνθρωπο. Σιωπηλή απόρριψη θα ήταν απώλεια χωρίς μάρτυρα.
      fatherName: name.patronymicInitial,
      // Η **ωμή** ειδικότητα όπως τη γράφει ο τοπογράφος («ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.») — ποτέ η
      // εξομαλυμένη ετικέτα του ρόλου: το «Τ.Ε.» είναι πληροφορία που η γέφυρα δεν κουβαλά.
      profession: person.professionText,
      ...escoFields(role),
      ...(person.officeSeat ? { city: person.officeSeat } : {}),
      phones: toPhones(person.phones, officePhones),
      emails: toEmails(person.emails, officeEmails),
      websites: toWebsites(person.websites),
    },
    officeDetails: [
      ...markOffice('phone', person.phones, officePhones),
      ...markOffice('email', person.emails, officeEmails),
      ...markOffice('website', person.websites, officeSites),
    ],
    nameSignal: name.signal,
    role,
  };
}
