/**
 * «Ανήκει αυτό το έγγραφο στον πελάτη που ρωτάει;» — η ερώτηση, μία φορά
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ (μετρημένο 2026-07-31)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ίδια ερώτηση ήταν γραμμένη σε **οκτώ σημεία**, από πέντε διαφορετικές
 * στιγμές, με **τρεις** διαφορετικές σημασιολογίες αστοχίας:
 *
 * | Πού | Τι έκανε όταν η απάντηση ήταν «όχι» |
 * |---|---|
 * | `text-template.service` | έριχνε `TextTemplateCrossTenantError` |
 * | `custom-dictionary.service` | έριχνε `CustomDictionaryCrossTenantError` |
 * | `dxf-layer-state-template.service` | έριχνε `LayerStateTemplateCrossTenantError` |
 * | `floorplan-background.service` ×3 (patch/patch/delete) | έριχνε **σκέτο `Error`** |
 * | `floorplan-background.getById` | επέστρεφε `null` |
 * | `measurements/boq-tenant-ownership` | επέστρεφε `null` |
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΔΙΑΦΟΡΑ ΔΕΝ ΕΙΝΑΙ ΘΕΜΑ ΓΟΥΣΤΟΥ: ΜΑΝΤΕΙΟ ΥΠΑΡΞΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Αν απαντήσεις *«δεν επιτρέπεται να δεις το 12345»*, μόλις **επιβεβαίωσες ότι
 * το 12345 υπάρχει**. Αν απαντήσεις *«δεν βρέθηκε»*, δεν είπες τίποτα. Κάποιος
 * που δοκιμάζει ids ένα-ένα μπορεί έτσι να **χαρτογραφήσει τι έχει άλλος
 * πελάτης** χωρίς ποτέ να δει περιεχόμενο — και ο πράκτορας ΤΝ είναι ακριβώς
 * τέτοιος καλών (ADR-734 §7).
 *
 * Το ζητούμενο **δεν** είναι «όλοι να απαντούν το ίδιο»: υπάρχουν νόμιμοι λόγοι
 * να θέλεις ρητό `403` (π.χ. οθόνη διαχειριστή όπου η σιωπή μπερδεύει τον
 * χρήστη). Το ζητούμενο είναι η επιλογή να είναι **ρητή και ορατή** — να
 * διαβάζεται στο όνομα της συνάρτησης — αντί να προκύπτει από το ποιο αρχείο
 * έτυχε να ανοίξει ο καθένας.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΟΙ ΔΥΟ ΠΟΛΙΤΙΚΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * - **`ownedOrNull()`** — σιωπηλή. Ξένο ≡ ανύπαρκτο. **Δεν μαρτυρά ύπαρξη.**
 *   Προεπιλογή για ό,τι δέχεται id από αναξιόπιστη πηγή.
 * - **`assertOwnedByCompany()`** — ρητή άρνηση. Ρίχνει το σφάλμα του πεδίου
 *   ορισμού, ώστε το route να το γυρίσει σε `403`. **Μαρτυρά ύπαρξη** — είναι
 *   συνειδητή ανταλλαγή, όχι παράβλεψη.
 * - **`concealCrossTenant()`** — η **απόφαση αποκάλυψης** στο σύνορο HTTP:
 *   δεδομένου του ρόλου του καλούντος, λέει αν η άρνηση βγαίνει έξω ως `403`
 *   ή μεταμφιεσμένη σε `404`. Βλ. παρακάτω.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΠΟΙΟΣ ΑΠΟΦΑΣΙΖΕΙ ΤΙ — ΤΟ ΣΥΝΟΡΟ (ADR-742)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η υπηρεσία λέει **πάντα την αλήθεια**: ρίχνει τυποποιημένο
 * `CrossTenantAccessError`. Τι από αυτή την αλήθεια **φεύγει στο σύρμα** το
 * αποφασίζει το route — το μόνο στρώμα που ξέρει *ποιος* ρωτάει και *τι βλέπει
 * ο έξω κόσμος*. Έτσι ο εσωτερικός κώδικας και τα logs κρατούν την πλήρη
 * εικόνα ενώ ο ξένος καλών δεν μαθαίνει τίποτα.
 *
 * Ο κανόνας δεν είναι «διάλεξε κωδικό» αλλά **«θα μπορούσε ο καλών να το μάθει
 * νόμιμα με άλλον τρόπο;»** — το ίδιο κριτήριο που εφαρμόζει το S3 στο
 * `GetObject` μέσω του `s3:ListBucket`. Στον Νέστορα το `list` είναι πάντα
 * tenant-scoped, άρα κανονικός χρήστης **δεν μπορεί ποτέ** να μάθει νόμιμα ότι
 * υπάρχει ξένο id → σιωπή. Ο bypass ρόλος έχει cross-tenant ορατότητα → η
 * ειλικρινής άρνηση δεν του αποκαλύπτει τίποτα νέο και του σώζει τη διάγνωση.
 *
 * ⚠️ Αυτή είναι **η ίδια** εξαίρεση που εφαρμόζει ήδη το `tenant-isolation.ts`
 * (ADR-255) στις έξι `require*InTenant`, όχι νέο δόγμα.
 *
 * ⚠️ **Καθαρό module**: μηδέν Firebase, μηδέν `server-only`. Το καλούν και το
 * client SDK (`boq-repository`) και το Admin SDK (τα υπόλοιπα)· αν εισήγαγε
 * οτιδήποτε από τα δύο, το ένα μονοπάτι θα έσπαγε στο build.
 *
 * @module lib/auth/tenant-ownership
 * @see ADR-734 §7 (το μαντείο ύπαρξης), `lib/auth/tenant-scope.ts` (ποιος tenant)
 */

import { createModuleLogger } from '@/lib/telemetry';
import { isRoleBypass } from './roles';

const logger = createModuleLogger('TenantOwnership');

/** Ό,τι φέρει tenant. Το ελάχιστο που χρειάζεται η ερώτηση. */
export interface TenantOwned {
  readonly companyId: string;
}

/** Τι ζητήθηκε — μπαίνει στο log ώστε η απόπειρα να εντοπίζεται. */
export interface OwnershipSubject {
  /** Ανθρώπινο όνομα πόρου, π.χ. `'BOQ item'`. */
  readonly resource: string;
  /** Το id όπως το έδωσε ο καλών. */
  readonly resourceId: string;
  /** Προαιρετικό: ποιο μονοπάτι ρώτησε (π.χ. `'client'` / `'admin'`). */
  readonly path?: string;
}

/**
 * Η ερώτηση. Τίποτα άλλο — καμία παρενέργεια, καμία πολιτική.
 *
 * Καμία εξαίρεση για super-admin **by design**: το μονοπάτι υπεργραφείου
 * δηλώνει ρητά τον tenant του στόχου και περνά κανονικά. Σιωπηλή εξαίρεση εδώ
 * θα ίσχυε για **κάθε** καλούντα με τον ρόλο, σε κάθε μελλοντική διαδρομή.
 *
 * ⚠️ Μη σύγχυση με το {@link concealCrossTenant}: εκεί ο bypass ρόλος **όντως**
 * αλλάζει το αποτέλεσμα — αλλά αυτό που αλλάζει είναι **τι λέμε στον καλούντα**,
 * όχι **αν του δίνουμε το έγγραφο**. Η ιδιοκτησία δεν έχει εξαίρεση· η
 * ευγένεια της άρνησης έχει.
 */
export function isOwnedByCompany(doc: TenantOwned, companyId: string): boolean {
  return doc.companyId === companyId;
}

/** Ό,τι μόλις βγήκε από τη βάση: το `companyId` είναι **υπόσχεση, όχι γεγονός**. */
export interface MaybeTenantOwned {
  readonly companyId?: string | null;
}

/**
 * Η **ίδια** ερώτηση, για έγγραφο που μόλις βγήκε από τη βάση και δεν έχει
 * αποδεδειγμένα `companyId`. Αυτή είναι η μορφή που καλούν οι φύλακες: το
 * `doc.data()` του Firestore επιστρέφει πάντα «ίσως».
 *
 * 🔴 **Έγγραφο χωρίς `companyId` δεν ανήκει σε ΚΑΝΕΝΑΝ** — ποτέ «ναι από τύχη».
 * Δύο ξεχωριστοί λόγοι το επιβάλλουν:
 *
 * 1. **ADR-232**: έγγραφα φτιαγμένα από το υπεργραφείο έχουν `companyId: null`.
 *    Κανονικός χρήστης δεν τα βλέπει — μόνο ο bypass ρόλος, και αυτό το κρίνει
 *    ο καλών, **όχι** αυτή η συνάρτηση.
 * 2. **Η παγίδα του κενού**: καλών με `companyId: ''` (χαλασμένο token) και
 *    έγγραφο με `companyId: ''` θα «ταίριαζαν» σε αφελή σύγκριση `===`.
 *    Το κενό δεν είναι tenant· είναι **απουσία** tenant.
 *
 * Γι' αυτό η {@link isOwnedByCompany} **δεν** αρκεί εδώ: εκείνη δέχεται τύπο που
 * ήδη **εγγυάται** `companyId: string`, οπότε νόμιμα δεν ρωτά αν λείπει.
 */
export function isPayloadOwnedByCompany(
  doc: MaybeTenantOwned | null | undefined,
  companyId: string,
): boolean {
  const owner = doc?.companyId;
  if (owner === null || owner === undefined || owner === '') return false;
  if (companyId === '') return false;
  return isOwnedByCompany({ companyId: owner }, companyId);
}

/**
 * **Πολιτική «σιωπηλή»** — ξένο έγγραφο επιστρέφει `null`, ίδιο με ανύπαρκτο.
 *
 * Η απόπειρα καταγράφεται: είναι σήμα ασφαλείας, όχι θόρυβος. Το `null` που
 * δέχεται ως είσοδο περνά αυτούσιο, ώστε ο καλών να γράφει μία γραμμή αντί για
 * δύο ελέγχους.
 */
export function ownedOrNull<T extends TenantOwned>(
  doc: T | null | undefined,
  companyId: string,
  subject: OwnershipSubject,
): T | null {
  if (doc === null || doc === undefined) return null;

  if (!isOwnedByCompany(doc, companyId)) {
    logger.warn('Cross-tenant access blocked', {
      resource: subject.resource,
      resourceId: subject.resourceId,
      callerCompanyId: companyId,
      ...(subject.path === undefined ? {} : { path: subject.path }),
    });
    return null;
  }

  return doc;
}

/**
 * Βάση για κάθε σφάλμα «ανήκει σε άλλον πελάτη».
 *
 * Οι υποκλάσεις κρατούν το **δικό τους** μήνυμα, `name` και `code` — τα routes
 * τα πιάνουν με `instanceof` και τα χαρτογραφούν σε `403`, οπότε αλλαγή τους θα
 * ήταν αλλαγή δημόσιου συμβολαίου. Η βάση προσθέτει **δομημένα πεδία** ώστε ένας
 * μελλοντικός γενικός χειριστής να μη χρειάζεται να διαβάζει μήνυμα κειμένου.
 */
export class CrossTenantAccessError extends Error {
  readonly resource: string;
  readonly resourceId: string;
  readonly expectedCompanyId: string;
  readonly actualCompanyId: string;

  constructor(spec: {
    readonly message: string;
    readonly name: string;
    readonly resource: string;
    readonly resourceId: string;
    readonly expectedCompanyId: string;
    readonly actualCompanyId: string;
  }) {
    super(spec.message);
    this.name = spec.name;
    this.resource = spec.resource;
    this.resourceId = spec.resourceId;
    this.expectedCompanyId = spec.expectedCompanyId;
    this.actualCompanyId = spec.actualCompanyId;
  }
}

/**
 * **Πολιτική «ρητή άρνηση»** — ξένο έγγραφο ρίχνει.
 *
 * Το σφάλμα το κατασκευάζει ο καλών (`makeError`), ώστε κάθε πεδίο ορισμού να
 * κρατά τον δικό του τύπο και τα routes του να συνεχίσουν να τον πιάνουν με
 * `instanceof`. Κοινός εδώ είναι ο **έλεγχος** και το **σημείο απόφασης**, όχι
 * το κείμενο.
 *
 * ⚠️ Θυμήσου ότι αυτή η πολιτική **μαρτυρά την ύπαρξη** του id. Χρησιμοποίησέ
 * τη μόνο όταν ο καλών είναι ήδη ταυτοποιημένος **και** η σιωπή θα ήταν
 * χειρότερη εμπειρία από την άρνηση.
 */
export function assertOwnedByCompany<T extends TenantOwned>(
  doc: T,
  expectedCompanyId: string,
  makeError: (actualCompanyId: string) => Error,
): void {
  if (!isOwnedByCompany(doc, expectedCompanyId)) {
    throw makeError(doc.companyId);
  }
}

/**
 * **Η απόφαση αποκάλυψης** — τι από την αλήθεια φεύγει στο σύρμα.
 *
 * Ο κανόνας δεν είναι «διάλεξε κωδικό» αλλά **«θα μπορούσε ο καλών να το μάθει
 * νόμιμα με άλλον τρόπο;»**. Στον Νέστορα το `list` είναι πάντα tenant-scoped,
 * άρα κανονικός χρήστης δεν μπορεί ποτέ να μάθει νόμιμα ότι υπάρχει ξένο id →
 * **σιωπή** (`conceal`). Ο bypass ρόλος έχει ήδη cross-tenant ορατότητα → η
 * ειλικρινής άρνηση δεν του αποκαλύπτει τίποτα νέο και του σώζει τη διάγνωση →
 * **αλήθεια** (`reveal`). Ίδιο κριτήριο με το `s3:ListBucket` του S3.
 *
 * 🔴 **Το `conceal()` πρέπει να παράγει ΠΑΝΟΜΟΙΟΤΥΠΟ αποτέλεσμα με το γνήσιο
 * «δεν βρέθηκε».** Αν το γνήσιο λέει `Text template not found: tpl_x` και το
 * μεταμφιεσμένο σκέτο `Not found`, τότε **το ίδιο το κείμενο γίνεται μαντείο**
 * και η μεταμφίεση δεν κρύβει τίποτα. Παρήγαγέ το από τον **ίδιο constructor**
 * που χρησιμοποιεί το γνήσιο μονοπάτι, ποτέ με χειρόγραφο string.
 *
 * Δεν αγγίζει HTTP: δουλεύει με ό,τι του δώσεις (σφάλμα, `Response`, τιμή), ώστε
 * να μένει σε καθαρό module που φορτώνεται και από client bundle.
 *
 * @param callerGlobalRole Ο **καθολικός** ρόλος του καλούντος (`ctx.globalRole`)
 * @param spec `reveal` = η αλήθεια για bypass ρόλο· `conceal` = η σιωπή για όλους τους άλλους
 */
export function concealCrossTenant<E>(
  callerGlobalRole: string,
  spec: { readonly reveal: () => E; readonly conceal: () => E },
): E {
  return isRoleBypass(callerGlobalRole) ? spec.reveal() : spec.conceal();
}
