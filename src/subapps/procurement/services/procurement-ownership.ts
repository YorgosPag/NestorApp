/**
 * «Ανήκει αυτό το έγγραφο;» — για το πεδίο ορισμού των προμηθειών
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΥΠΗΡΧΕ ΠΡΙΝ (μετρημένο 2026-07-31, ADR-742 §7ter)
 * ─────────────────────────────────────────────────────────────────────────────
 * Είκοσι σημεία σε επτά υπηρεσίες έγραφαν την ίδια ερώτηση με το χέρι, και το
 * «όχι» έβγαινε με **δύο** διαφορετικούς τρόπους μέσα στο **ίδιο αρχείο**:
 *
 * | Μορφή | Πού | Τι έλεγε |
 * |---|---|---|
 * | `throw new Error('Forbidden')` | 14 σημεία (mutations) | **μαρτυρά ύπαρξη** |
 * | `return null` | 5 σημεία (`getX`) | σιωπά |
 * | `if (data.companyId && …)` | 1 σημείο (fan-out) | σιωπά **και** αφήνει το κενό να περάσει |
 *
 * Το `'Forbidden'` δεν ήταν απλώς άτυπο σφάλμα: το ίδιο το **κείμενό** του ήταν
 * ο έλεγχος πρόσβασης. Το `resolveProcurementErrorStatus` ρωτούσε
 * `msg.includes('Forbidden')` για να βγάλει 403 — δηλαδή μια αλλαγή διατύπωσης
 * σε μήνυμα υπηρεσίας θα μετέτρεπε **σιωπηλά** την άρνηση ασφαλείας σε 400.
 * Ακριβώς το σφάλμα που εξάλειψε η Φάση Β στο DXF (ADR-742 §7.4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ ΓΝΗΣΙΟ «ΔΕΝ ΒΡΕΘΗΚΕ» ΓΕΝΝΙΕΤΑΙ **ΕΔΩ** ΚΑΙ ΟΧΙ ΣΤΗΝ ΥΠΗΡΕΣΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κανόνας του ADR-742 §3.4 λέει ότι το μεταμφιεσμένο 404 πρέπει να είναι
 * **πανομοιότυπο** με το γνήσιο. Στο DXF αυτό επιτεύχθηκε με ένα `notFound`
 * callback που το route έδινε **μία φορά** και εξυπηρετούσε **και τους δύο**
 * κλάδους (§7.1).
 *
 * Εδώ ο κλάδος του γνήσιου ζει στην **υπηρεσία** (`if (!snap.exists) throw …`)
 * και ο κλάδος της μεταμφίεσης στο **σύνορο HTTP** — δύο αρχεία, δύο στιγμές.
 * Ένα callback δεν τα γεφυρώνει. Τα γεφυρώνει το ίδιο το **εργοστάσιο**:
 * και οι δύο κλάδοι καλούν την {@link procurementNotFound} με τα **ίδια** δύο
 * ορίσματα, τα οποία ταξιδεύουν μέσα στο ίδιο το σφάλμα ιδιοκτησίας
 * (`resource` + `resourceId`, κληρονομημένα από το `CrossTenantAccessError`).
 * Δεν υπάρχει τρόπος να αποκλίνουν χωρίς να αλλάξει **αυτό** το αρχείο.
 *
 * Γι' αυτό το `'Material x not found'` **έπαψε** να γράφεται με το χέρι στις
 * υπηρεσίες: χειρόγραφο γνήσιο μήνυμα σημαίνει ότι η ταυτότητα είναι θέμα
 * προσοχής — και η §7.1 λέει ρητά ότι πρέπει να είναι **δομική**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΚΑΘΑΡΟ MODULE (μηδέν `server-only`, μηδέν Firebase)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το καλούν **και** οι υπηρεσίες (Admin SDK, `server-only`) **και** το σύνορο
 * των routes. Ό,τι εισαγόταν από τα δύο περιβλήματα θα έσπαγε το ένα μονοπάτι
 * — ο ίδιος λόγος για τον οποίο ο πυρήνας `lib/auth/tenant-ownership` είναι
 * καθαρός (ADR-742 §3.1).
 *
 * ⚠️ **Καμία εξαίρεση bypass εδώ, και αυτό ΔΕΝ είναι παράλειψη.** Οι επτά
 * υπηρεσίες προμηθειών δεν είχαν **ποτέ** `isRoleBypass` — μπλοκάρουν και τον
 * υπεργραφέα. Είναι από τα λίγα σημεία που κάνουν το σωστό κατά ZSP (ADR-742
 * §7ter.3)· η μετανάστευση **δεν αλλάζει ποιος βλέπει τι**, αλλάζει *τι λέμε*
 * στην άρνηση. Το `concealCrossTenant` στο σύνορο αφορά μόνο τη **διατύπωση**.
 *
 * @module subapps/procurement/services/procurement-ownership
 * @see ADR-742 §3.3 (κανόνας αποκάλυψης), §3.4 (ποιος αποφασίζει), §7.1 (η ταυτότητα)
 * @see lib/auth/tenant-ownership (ο SSoT της ερώτησης)
 */

import {
  assertOwnedByCompany,
  CrossTenantAccessError,
  type MaybeTenantOwned,
} from '@/lib/auth/tenant-ownership';

/**
 * Τα ανθρώπινα ονόματα των πόρων — **SSoT**, γιατί μπαίνουν αυτούσια στο
 * γνήσιο μήνυμα «δεν βρέθηκε» και άρα **και** στο μεταμφιεσμένο. Μια
 * αναντιστοιχία εδώ (`'RfqLine'` vs `'RFQ line'`) θα έκανε το ίδιο το κείμενο
 * μαντείο ύπαρξης.
 *
 * ⚠️ Οι τιμές είναι **ακριβώς** αυτές που έγραφαν τα χειρόγραφα μηνύματα πριν
 * τη μετανάστευση — το σύρμα δεν αλλάζει.
 */
export const PROCUREMENT_RESOURCE = {
  FRAMEWORK_AGREEMENT: 'Framework agreement',
  MATERIAL: 'Material',
  QUOTE: 'Quote',
  RFQ: 'RFQ',
  RFQ_LINE: 'RfqLine',
  SOURCING_EVENT: 'SourcingEvent',
} as const;

export type ProcurementResource =
  (typeof PROCUREMENT_RESOURCE)[keyof typeof PROCUREMENT_RESOURCE];

/** Τι ζητήθηκε — ταξιδεύει μαζί με κάθε άρνηση ώστε να αναπαράγεται το μήνυμα. */
export interface ProcurementSubject {
  readonly resource: ProcurementResource;
  readonly resourceId: string;
}

/**
 * Το **γνήσιο** «δεν βρέθηκε» — και, στο σύνορο, το μεταμφιεσμένο.
 *
 * Τυποποιημένο αντί για σκέτο `Error` ώστε το σύνορο να το πιάνει με
 * `instanceof` και να μη ρωτά ποτέ `msg.includes('not found')`.
 */
export class ProcurementNotFoundError extends Error {
  readonly resource: ProcurementResource;
  readonly resourceId: string;

  constructor(subject: ProcurementSubject) {
    super(`${subject.resource} ${subject.resourceId} not found`);
    this.name = 'ProcurementNotFoundError';
    this.resource = subject.resource;
    this.resourceId = subject.resourceId;
  }
}

/**
 * Το **ένα** εργοστάσιο του «δεν βρέθηκε». Καλείται από δύο σημεία:
 *
 * 1. την υπηρεσία, όταν το έγγραφο **όντως** λείπει
 * 2. το σύνορο HTTP, όταν το έγγραφο υπάρχει αλλά **ανήκει αλλού** και ο
 *    καλών δεν δικαιούται να το μάθει
 *
 * Η ταυτότητα των δύο είναι **δομική**: ίδιος constructor, ίδια ορίσματα.
 */
export function procurementNotFound(
  subject: ProcurementSubject,
): ProcurementNotFoundError {
  return new ProcurementNotFoundError(subject);
}

/**
 * Η **ρητή άρνηση** του πεδίου ορισμού.
 *
 * ⚠️ Το `message` μένει σκέτο `'Forbidden'` — **ταυτόσημο byte-προς-byte** με τα 14
 * χειρόγραφα `throw new Error('Forbidden')` που αντικατέστησε. Ο μόνος καλών
 * που το βλέπει πλέον στο σύρμα είναι ο bypass ρόλος (κλάδος `reveal`), και
 * γι' αυτόν τίποτα δεν αλλάζει. Η **αλήθεια** ταξιδεύει στα δομημένα πεδία
 * (`resource`, `resourceId`, `expectedCompanyId`, `actualCompanyId`), ώστε ο
 * χειριστής να μη χρειάζεται ποτέ να διαβάσει κείμενο (ADR-742 §7.4).
 */
export class ProcurementCrossTenantError extends CrossTenantAccessError {
  /**
   * Ο πόρος στον **στενό** τύπο του πεδίου ορισμού.
   *
   * Η βάση εκθέτει `resource: string` (εξυπηρετεί όλα τα πεδία ορισμού). Το
   * σύνορο χρειάζεται τον στενό τύπο για να ξαναφτιάξει το γνήσιο «δεν
   * βρέθηκε» — και κρατιέται ως **δικό** πεδίο αντί για `as` στο σημείο
   * χρήσης: εδώ η τιμή είναι αποδεδειγμένα στενή (ήρθε από τον constructor),
   * ενώ ένα `as` στο σύνορο θα ήταν υπόσχεση χωρίς απόδειξη (§7.5).
   */
  readonly procurementSubject: ProcurementSubject;

  constructor(spec: {
    readonly resource: ProcurementResource;
    readonly resourceId: string;
    readonly expectedCompanyId: string;
    readonly actualCompanyId: string;
  }) {
    super({
      message: 'Forbidden',
      name: 'ProcurementCrossTenantError',
      resource: spec.resource,
      resourceId: spec.resourceId,
      expectedCompanyId: spec.expectedCompanyId,
      actualCompanyId: spec.actualCompanyId,
    });
    this.procurementSubject = { resource: spec.resource, resourceId: spec.resourceId };
  }
}

/**
 * «Ανήκει ΑΥΤΟ;» — ρητή άρνηση, για τα σημεία μεταβολής.
 *
 * 🔴 Δέχεται `MaybeTenantOwned`, **όχι** τον τύπο του εγγράφου: κάθε καλών
 * περνά `{ ...snap.data() } as XDoc`, δηλαδή ο **τύπος υπόσχεται** `companyId:
 * string` ενώ η **βάση δεν το εγγυάται**. Το `as` ήταν το ψέμα (ADR-742 §7.5).
 * Ο SSoT ρωτά {@link assertOwnedByCompany} → `isPayloadOwnedByCompany`, οπότε
 * έγγραφο **χωρίς** tenant δεν ανήκει σε κανέναν και καλών με χαλασμένο token
 * (`companyId: ''`) δεν ταιριάζει με τίποτα.
 */
export function assertOwnedProcurementDoc(
  doc: MaybeTenantOwned,
  expectedCompanyId: string,
  subject: ProcurementSubject,
): void {
  assertOwnedByCompany(
    doc,
    expectedCompanyId,
    (actualCompanyId) =>
      new ProcurementCrossTenantError({
        resource: subject.resource,
        resourceId: subject.resourceId,
        expectedCompanyId,
        actualCompanyId,
      }),
  );
}
