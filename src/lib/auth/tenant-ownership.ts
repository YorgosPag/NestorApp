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
 *
 * ⚠️ **Καθαρό module**: μηδέν Firebase, μηδέν `server-only`. Το καλούν και το
 * client SDK (`boq-repository`) και το Admin SDK (τα υπόλοιπα)· αν εισήγαγε
 * οτιδήποτε από τα δύο, το ένα μονοπάτι θα έσπαγε στο build.
 *
 * @module lib/auth/tenant-ownership
 * @see ADR-734 §7 (το μαντείο ύπαρξης), `lib/auth/tenant-scope.ts` (ποιος tenant)
 */

import { createModuleLogger } from '@/lib/telemetry';

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
 */
export function isOwnedByCompany(doc: TenantOwned, companyId: string): boolean {
  return doc.companyId === companyId;
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
