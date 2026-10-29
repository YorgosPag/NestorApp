/**
 * @fileoverview **Το ενεργειακό πιστοποιητικό (ΠΕΑ) μιας αγγελίας** — κλάση, κατανάλωση, εκπομπές (ADR-777 §8.94).
 * @related `services/listings/public-listing-attributes.ts` (η προβολή — καλεί τον ΕΝΑΝ αναγνώστη) ·
 *   `lib/listings/public-listing-migrations-21-30.ts` (ο κρίκος 22, ίδιος κριτής) ·
 *   `lib/energy-certificate/energy-certificate-claim.ts` (η αξίωση νομιμότητας που γράφεται μαζί) ·
 *   `components/listing-detail/ListingEnergyCertificate.tsx` (η οθόνη του κοινού)
 * @module lib/energy-certificate/energy-certificate
 *
 * 🔑 **ΕΝΑ μπλοκ για ιδιώτη ΚΑΙ εταιρεία**: ο ίδιος τύπος, ο ίδιος αναγνώστης, ο ίδιος κριτής «τίθεται η ερώτηση;».
 *
 * 🔑 **Η κλάση είναι το κλειδί του μπλοκ.** Ό,τι άλλο γράφει το ΠΕΑ (αριθμοί, ημερομηνία) **προσδιορίζει** την κλάση
 * και δεν στέκει χωρίς αυτή· και η `absence` λέει **γιατί δεν υπάρχει κλάση** — άρα δεν συνυπάρχει ποτέ με κλάση.
 *
 * ⚠️ **Η κλάση ΔΕΝ ελέγχεται απέναντι στα kWh, και είναι απόφαση**: στον ΚΕΝΑΚ η κατηγορία βγαίνει από τον λόγο προς
 * το **κτίριο αναφοράς** (ΤΟΤΕΕ 20701-1, πίν. 1.3) — δύο κτίρια με τα ίδια kWh/m² έχουν νόμιμα διαφορετική κλάση. Ένας
 * έλεγχος «συμφωνίας» θα απέρριπτε αληθινά πιστοποιητικά.
 *
 * ⛔ **Τι ΔΕΝ ζει εδώ, επίτηδες**: αριθμός πρωτοκόλλου, αριθμός ασφαλείας, επιθεωρητής. Το μπλοκ ταξιδεύει (εν μέρει)
 * δημόσια· η ταυτότητα του εγγράφου σε μητρώο όχι.
 */

import { z } from 'zod';

import { ENERGY_CLASSES, isEnergyClass, type EnergyClass } from '@/constants/energy-classes';
import { isLandProperty } from '@/constants/property-classification';
import { documentKindSpec } from '@/config/document-validity/document-validity';
import { normalizeCalendarDay, normalizeToMillisOrNull, utcDateOf } from '@/lib/date-local';
import { calendarDaySchema } from '@/lib/date/calendar-day-schema';
import { ruleExpiresOn } from '@/lib/document-validity/document-expiry';
import { raisedClaimKinds } from '@/lib/legality/legality-offer-matrix';
import { isPlainRecord } from '@/lib/type-guards';
import { isOfferKind } from '@/types/property-offers';

import {
  finalEnergySchema,
  isUsefulArea,
  readFinalEnergy,
  sameFinalEnergy,
  usefulAreaSchema,
  type FinalEnergyLine,
} from './certificate-final-energy';

/** Γιατί δεν υπάρχει κλάση: το πιστοποιητικό **εκδίδεται**, ή το ακίνητο **εξαιρείται** (άρθ. 4 §7 ν. 4122/2013). */
export const ENERGY_CERTIFICATE_ABSENCES = ['pending', 'exempt'] as const;
export type EnergyCertificateAbsence = (typeof ENERGY_CERTIFICATE_ABSENCES)[number];

/**
 * **Τι πιστοποιεί το ΠΕΑ** (ADR-777 §8.96): τη **μονάδα**, ή **ολόκληρο το κτήριο** — η κοινή πιστοποίηση του
 * ν. 4122/2013 άρθ. 11 §5, νόμιμη για πώληση/μίσθωση μονάδας. Στη δεύτερη περίπτωση οι αριθμοί ανά m² είναι **του
 * κτηρίου** (ίδιο με το GEG §87 της Γερμανίας) — η αγγελία το λέει, και η εκτίμηση κόστους της μονάδας δεν βγαίνει.
 */
export const ENERGY_CERTIFICATE_SCOPES = ['unit', 'building'] as const;
export type EnergyCertificateScope = (typeof ENERGY_CERTIFICATE_SCOPES)[number];

/** Αναγνωριστικό αρχείου του συστήματος αρχείων — μορφή, όχι ύπαρξη (εκείνη κρίνεται στον server). */
const SOURCE_FILE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Άνω όρια λογικής — πάνω από αυτά είναι λάθος πληκτρολόγησης (συνολικά kWh αντί για kWh ανά m²). */
export const MAX_PRIMARY_ENERGY = 2000;
export const MAX_CO2_EMISSIONS = 500;

export interface EnergyCertificate {
  /** Η ενεργειακή κατηγορία του ΠΕΑ. `null` = δεν δηλώθηκε (δες {@link EnergyCertificate.absence}). */
  readonly class: EnergyClass | null;
  /** Υπολογιζόμενη ετήσια κατανάλωση **πρωτογενούς** ενέργειας, kWh/m²·έτος, ένα δεκαδικό. **Μόνο** με κλάση. */
  readonly primaryEnergy: number | null;
  /** Ετήσιες εκπομπές CO₂, kg/m²·έτος, ένα δεκαδικό. **Μόνο** με κλάση. */
  readonly co2Emissions: number | null;
  /** Ημέρα έκδοσης, `YYYY-MM-DD`. **Μόνο** με κλάση· δεν ταξιδεύει δημόσια ως πεδίο — τρέφει την ισχύ. */
  readonly issuedOn: string | null;
  /** Ωφέλιμη επιφάνεια **όπως τη γράφει το ΠΕΑ**, m², ένα δεκαδικό. **Μόνο** με κλάση (ADR-777 §8.95). */
  readonly usefulArea: number | null;
  /** Τελική ενέργεια ανά πηγή (στήλη «Συνολική»), σε σειρά εντύπου. **Μόνο** με κλάση· `null` = δεν δηλώθηκε. */
  readonly finalEnergy: readonly FinalEnergyLine[] | null;
  /** Μονάδα ή ολόκληρο κτήριο (ADR-777 §8.96). **Μόνο** με κλάση· `null` = δεν δηλώθηκε. */
  readonly scope: EnergyCertificateScope | null;
  /**
   * **Από ποιο έγγραφο ήρθαν οι τιμές** — το ΠΕΑ στα «Έγγραφα» του ακινήτου (ADR-777 §8.96). **Μόνο** με κλάση.
   * 🔒 Ιδιωτικό: το δημόσιο κουτί δεν το περιλαμβάνει. Σβήνει μόλις αλλάξει χειροκίνητα τιμή που γράφει το έγγραφο.
   */
  readonly sourceFileId: string | null;
  /** Γιατί δεν υπάρχει κλάση. **Μόνο** χωρίς κλάση· `null` = δεν απαντήθηκε. */
  readonly absence: EnergyCertificateAbsence | null;
}

/**
 * Το μπλοκ **όπως κάθεται στο έγγραφο του γραφείου** (`Property.energy`): κάθε πεδίο μπορεί να λείπει, και τα τρία
 * τελευταία είναι το **παλιό** σχήμα (πριν από το ADR-777 §8.94). Κανείς δεν τα γράφει πλέον· η `certificateDate`
 * διαβάζεται ως εφεδρεία της `issuedOn`, και το showcase τα δείχνει όπου υπάρχουν.
 *
 * ⚠️ Ποτέ ανάγνωση πεδίο-πεδίο: το κανονικοποιημένο μπλοκ το δίνει **μόνο** το {@link readEnergyCertificate}.
 */
export type StoredEnergyCertificate = Partial<EnergyCertificate> & {
  readonly certificateId?: string;
  readonly certificateDate?: unknown;
  readonly validUntil?: unknown;
};

export const UNDECLARED_ENERGY_CERTIFICATE: EnergyCertificate = {
  class: null,
  primaryEnergy: null,
  co2Emissions: null,
  issuedOn: null,
  usefulArea: null,
  finalEnergy: null,
  scope: null,
  sourceFileId: null,
  absence: null,
};

// ============================================================================
// ΑΝΑΓΝΩΣΗ — αυστηρή ανά πεδίο: άκυρη τιμή ⇒ `null` (ποτέ ρίψη, ποτέ «διόρθωση»)
// ============================================================================

/** Μη αρνητικός, έως το όριο, με **το πολύ ένα** δεκαδικό — η ακρίβεια που τυπώνει το ΠΕΑ. */
function isCertificateFigure(raw: unknown, max: number): raw is number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > max) return false;
  return Math.abs(raw * 10 - Math.round(raw * 10)) < 1e-6;
}

export function isPrimaryEnergy(raw: unknown): raw is number {
  return isCertificateFigure(raw, MAX_PRIMARY_ENERGY);
}

export function isCo2Emissions(raw: unknown): raw is number {
  return isCertificateFigure(raw, MAX_CO2_EMISSIONS);
}

function isAbsence(raw: unknown): raw is EnergyCertificateAbsence {
  return ENERGY_CERTIFICATE_ABSENCES.some((absence) => absence === raw);
}

export function isEnergyCertificateScope(raw: unknown): raw is EnergyCertificateScope {
  return ENERGY_CERTIFICATE_SCOPES.some((scope) => scope === raw);
}

function isSourceFileId(raw: unknown): raw is string {
  return typeof raw === 'string' && SOURCE_FILE_ID.test(raw);
}

/**
 * Η ημέρα έκδοσης. Το παλιό σχήμα του `Property.energy` την κρατούσε ως `certificateDate` (Timestamp)· διαβάζεται
 * ώστε τα υπάρχοντα έγγραφα να μη χάσουν ό,τι ήδη ξέρουν.
 *
 * ⚠️ **Η εφεδρεία ισχύει ΜΟΝΟ όταν το `issuedOn` λείπει ως κλειδί.** Ρητό `null` είναι **απάντηση** («έσβησα την
 * ημερομηνία»)· αν έπεφτε κι αυτό στην παλιά τιμή, η ημερομηνία δεν θα μπορούσε ποτέ να σβηστεί.
 */
function issuedOnOf(record: Record<string, unknown>): string | null {
  if (record.issuedOn !== undefined) return normalizeCalendarDay(record.issuedOn);
  const legacyMs = normalizeToMillisOrNull(record.certificateDate);
  return legacyMs === null ? null : utcDateOf(legacyMs);
}

/**
 * Ό,τι είναι αποθηκευμένο (ή λείπει) → κανονικοποιημένο μπλοκ. Το σύνορο ανάγνωσης κάθε εγγράφου το καλεί.
 *
 * ⚠️ **Ποτέ ορφανός προσδιοριστής** (ίδιος κανόνας με τα κοινόχρηστα, ADR-777 §8.93): αριθμοί ή ημερομηνία χωρίς
 * κλάση, και «υπό έκδοση» δίπλα σε κλάση, δεν προσδιορίζουν τίποτα ⇒ `null`.
 */
export function readEnergyCertificate(raw: unknown): EnergyCertificate {
  const record = isPlainRecord(raw) ? raw : {};
  if (!isEnergyClass(record.class)) {
    return { ...UNDECLARED_ENERGY_CERTIFICATE, absence: isAbsence(record.absence) ? record.absence : null };
  }
  return {
    class: record.class,
    primaryEnergy: isPrimaryEnergy(record.primaryEnergy) ? record.primaryEnergy : null,
    co2Emissions: isCo2Emissions(record.co2Emissions) ? record.co2Emissions : null,
    issuedOn: issuedOnOf(record),
    usefulArea: isUsefulArea(record.usefulArea) ? record.usefulArea : null,
    finalEnergy: readFinalEnergy(record.finalEnergy),
    scope: isEnergyCertificateScope(record.scope) ? record.scope : null,
    sourceFileId: isSourceFileId(record.sourceFileId) ? record.sourceFileId : null,
    absence: null,
  };
}

/**
 * Ως πότε ισχύει το πιστοποιητικό — `YYYY-MM-DD`, ή `null` όταν η έκδοση δεν είναι γνωστή.
 *
 * ⚠️ `null` σημαίνει **«δεν ξέρουμε»**, ποτέ «ισχύει»: το κανάλι νομιμότητας το ονομάζει `expiry-unknown`.
 */
export function certificateValidUntil(issuedOn: string | null): string | null {
  // ADR-915 Φ1 — ο ΕΝΑΣ κανόνας και ο ΕΝΑΣ υπολογισμός, ίδιοι με του καταλόγου μεταβίβασης.
  return ruleExpiresOn(documentKindSpec('energy-certificate').rule, issuedOn);
}

// ============================================================================
// ΔΙΟΡΘΩΣΗ — μερική: αλλάζουν ΜΟΝΟ τα κλειδιά που στάλθηκαν· ρητό `null` = «σβήσε την απάντηση»
// ============================================================================

// Η ημερομηνία έκδοσης: υπαρκτή `YYYY-MM-DD` — το κοινό σχήμα (ADR-919), όχι τοπικό αντίγραφο.

/** Ολόκληρο το μπλοκ — η φόρμα της εταιρείας το στέλνει ακέραιο. `.strict()`: άγνωστο κλειδί ⇒ απόρριψη. */
export const energyCertificateSchema = z
  .object({
    class: z.enum(ENERGY_CLASSES).nullable(),
    primaryEnergy: z.number().refine(isPrimaryEnergy).nullable(),
    co2Emissions: z.number().refine(isCo2Emissions).nullable(),
    issuedOn: calendarDaySchema.nullable(),
    usefulArea: usefulAreaSchema.nullable(),
    finalEnergy: finalEnergySchema.nullable(),
    // ADR-777 §8.96 — ΠΡΟΑΙΡΕΤΙΚΑ επίτηδες (ανεκτικός αναγνώστης): μια ανοιχτή καρτέλα του χθεσινού πελάτη στέλνει
    // ακέραιο μπλοκ ΧΩΡΙΣ αυτά, και δεν πρέπει να πάρει 400 στην «Αποθήκευση». Η απουσία διαβάζεται `null`.
    scope: z.enum(ENERGY_CERTIFICATE_SCOPES).nullable().optional(),
    sourceFileId: z.string().regex(SOURCE_FILE_ID).nullable().optional(),
    absence: z.enum(ENERGY_CERTIFICATE_ABSENCES).nullable(),
  })
  .strict();

/** Το μπλοκ **όπως θα αποθηκευτεί** — περασμένο από τον ΕΝΑΝ αναγνώστη, ώστε να μη γραφτεί ποτέ ορφανός αριθμός. */
export const storedEnergyCertificateSchema = energyCertificateSchema.transform((block) => readEnergyCertificate(block));

/** Η μερική διόρθωση — η οθόνη «Βελτίωσε την αγγελία σου» αποθηκεύει κάθε απάντηση χωριστά. */
export const energyCertificatePatchSchema = energyCertificateSchema
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0);

export type EnergyCertificatePatch = z.infer<typeof energyCertificatePatchSchema>;

/**
 * Ό,τι **γράφει το έγγραφο** — οι τιμές που η προέλευση εγγυάται. Η `scope` λείπει επίτηδες: είναι ερμηνεία του
 * ανθρώπου (το έντυπο δεν λέει «κοινή πιστοποίηση»), άρα η αλλαγή της δεν κάνει τις τιμές λιγότερο «του εγγράφου».
 */
function sameDocumentFigures(a: EnergyCertificate, b: EnergyCertificate): boolean {
  return (
    a.class === b.class &&
    a.primaryEnergy === b.primaryEnergy &&
    a.co2Emissions === b.co2Emissions &&
    a.issuedOn === b.issuedOn &&
    a.usefulArea === b.usefulArea &&
    sameFinalEnergy(a.finalEnergy, b.finalEnergy)
  );
}

/**
 * Η ίδια συνάρτηση στον server και στην αισιόδοξη επικάλυψη της οθόνης — καμία δεύτερη αλήθεια.
 *
 * 🔑 **Κανόνας προέλευσης** (ADR-777 §8.96): διόρθωση που αλλάζει τιμή του εγγράφου **χωρίς** να φέρει δική της
 * `sourceFileId` σβήνει την προέλευση — οι τιμές δεν είναι πια «του ΠΕΑ», και το «από ΠΕΑ …» θα ήταν ψέμα. Ζει εδώ,
 * όχι στην οθόνη, ώστε να ισχύει σε κάθε δρόμο γραφής.
 */
export function applyEnergyCertificatePatch(
  current: EnergyCertificate,
  patch: EnergyCertificatePatch,
): EnergyCertificate {
  const next = readEnergyCertificate({ ...current, ...patch });
  if (patch.sourceFileId !== undefined || sameDocumentFigures(current, next)) return next;
  return { ...next, sourceFileId: null };
}

/** Ίδια δήλωση; Και τα δύο μπλοκ είναι κανονικοποιημένα ⇒ αρκεί σύγκριση ανά πεδίο. */
export function sameEnergyCertificate(a: EnergyCertificate, b: EnergyCertificate): boolean {
  return (
    sameDocumentFigures(a, b) &&
    a.scope === b.scope &&
    a.sourceFileId === b.sourceFileId &&
    a.absence === b.absence
  );
}

// ============================================================================
// Ο ΚΡΙΤΗΣ — «τίθεται η ερώτηση για αυτή την αγγελία;»
// ============================================================================

/** Ό,τι χρειάζεται ο κριτής — δομικό, ώστε να τον τρέφει και η προβολή και ένα παλιό αποθηκευμένο έγγραφο. */
export interface EnergyCertificateSubject {
  readonly type: unknown;
  readonly offerKinds: readonly unknown[];
}

/**
 * **Ο ΕΝΑΣ κριτής — και ΔΕΝ έχει δικό του πίνακα.** Το «ποια διάθεση σηκώνει ΠΕΑ» το απαντά ήδη, με διάταξη ανά
 * κελί, το `LEGALITY_OFFER_MATRIX` (ADR-838)· δεύτερη λίστα εδώ θα ήταν ελεύθερη να αποκλίνει. Η γη δεν είναι κτίριο
 * (το άρθ. 12 μιλά για «κτίριο ή κτιριακή μονάδα»), άρα εκεί η γραμμή **δεν υπάρχει** — ένα «Δεν έχει δηλωθεί» θα
 * κατηγορούσε τον κάτοχο για πεδίο που δεν του ζητήθηκε.
 *
 * ⚠️ Τα κελιά `unresolved` (βραχυχρόνια · αντιπαροχή) **σηκώνουν** την ερώτηση, όπως και στη νομιμότητα: η παράλειψη
 * θα ήταν ισχυρισμός «δεν χρειάζεται», που δεν επαληθεύτηκε.
 */
export function raisesEnergyCertificateQuestion({ type, offerKinds }: EnergyCertificateSubject): boolean {
  if (isLandProperty(type)) return false;
  return raisedClaimKinds(offerKinds.filter(isOfferKind)).includes('energy-performance');
}

/**
 * Ό,τι από το μπλοκ ταξιδεύει δημόσια **πέρα από την κλάση** (εκείνη είναι το `PublicListing.energyClass`).
 *
 * ⛔ Η `issuedOn` λείπει επίτηδες: η ισχύς φεύγει **μόνο** ως κατάσταση του καναλιού νομιμότητας.
 */
export type ListedEnergyCertificate = Pick<
  EnergyCertificate,
  'primaryEnergy' | 'co2Emissions' | 'usefulArea' | 'finalEnergy' | 'scope' | 'absence'
>;

/** Το κουτί **όπως το έγραφε η έκδοση 22** του σχήματος — το σχήμα που δίνει ο παγωμένος κρίκος 22. */
export type ListedEnergyFiguresV22 = Pick<EnergyCertificate, 'primaryEnergy' | 'co2Emissions' | 'absence'>;

/** Το κουτί **όπως το έγραφε η έκδοση 23** — το σχήμα που δίνει ο παγωμένος κρίκος 23 (χωρίς `scope`). */
export type ListedEnergyFiguresV23 = Omit<ListedEnergyCertificate, 'scope'>;

/**
 * **Το κουτί της δημόσιας αγγελίας**, από το μπλοκ της **πηγής**: `null` ⇔ η ερώτηση δεν τίθεται· αλλιώς ό,τι
 * δηλώθηκε, από τον ΕΝΑΝ αναγνώστη. Το καλεί η προβολή.
 */
export function listedEnergyCertificateOf(
  subject: EnergyCertificateSubject,
  raw: unknown,
): ListedEnergyCertificate | null {
  if (!raisesEnergyCertificateQuestion(subject)) return null;
  const { primaryEnergy, co2Emissions, usefulArea, finalEnergy, scope, absence } = readEnergyCertificate(raw);
  return { primaryEnergy, co2Emissions, usefulArea, finalEnergy, scope, absence };
}

/**
 * **Το ίδιο κουτί, από ήδη αποθηκευμένη αγγελία** — για τον κρίκο του σχήματος. Ίδιος κριτής με την προβολή, ώστε
 * παλιό και νέο έγγραφο να απαντούν το ίδιο· ό,τι λείπει γίνεται «δεν δηλώθηκε», ποτέ ψευδής αριθμός.
 *
 * ⚠️ Δεν περνά από το {@link readEnergyCertificate}: το κουτί **δεν κουβαλά κλάση** (εκείνη είναι το `energyClass`),
 * άρα ο κανόνας «αριθμός μόνο με κλάση» θα έσβηνε εδώ κάθε αριθμό.
 */
export function relistedEnergyCertificateOf(
  subject: EnergyCertificateSubject,
  stored: unknown,
): ListedEnergyFiguresV22 | null {
  if (!raisesEnergyCertificateQuestion(subject)) return null;
  const record = isPlainRecord(stored) ? stored : {};
  return {
    primaryEnergy: isPrimaryEnergy(record.primaryEnergy) ? record.primaryEnergy : null,
    co2Emissions: isCo2Emissions(record.co2Emissions) ? record.co2Emissions : null,
    absence: isAbsence(record.absence) ? record.absence : null,
  };
}

/**
 * **Το κουτί της έκδοσης 23** (ADR-777 §8.95), από ήδη αποθηκευμένη αγγελία: ό,τι έδινε ο κρίκος 22, **συν** την
 * ωφέλιμη επιφάνεια και την τελική ενέργεια — `null` όπου κανείς δεν είχε πού να τα γράψει.
 *
 * 🔑 Χτίζεται **πάνω** στο {@link relistedEnergyCertificateOf} αντί να το αλλάξει: ο κρίκος 22 είναι παγωμένος και
 * πρέπει να συνεχίσει να δίνει **ακριβώς** το κουτί της έκδοσης 22.
 */
export function relistedFinalEnergyOf(
  subject: EnergyCertificateSubject,
  stored: unknown,
): ListedEnergyFiguresV23 | null {
  const figures = relistedEnergyCertificateOf(subject, stored);
  if (figures === null) return null;
  const record = isPlainRecord(stored) ? stored : {};
  return {
    ...figures,
    usefulArea: isUsefulArea(record.usefulArea) ? record.usefulArea : null,
    finalEnergy: readFinalEnergy(record.finalEnergy),
  };
}

/**
 * **Το κουτί της έκδοσης 24** (ADR-777 §8.96): ό,τι έδινε ο κρίκος 23, **συν** την εμβέλεια του πιστοποιητικού —
 * `null` («δεν δηλώθηκε») όπου κανείς δεν είχε πού να τη γράψει. Χτίζεται **πάνω** στον παγωμένο κρίκο 23.
 */
export function relistedScopeOf(subject: EnergyCertificateSubject, stored: unknown): ListedEnergyCertificate | null {
  const figures = relistedFinalEnergyOf(subject, stored);
  if (figures === null) return null;
  const record = isPlainRecord(stored) ? stored : {};
  return { ...figures, scope: isEnergyCertificateScope(record.scope) ? record.scope : null };
}
