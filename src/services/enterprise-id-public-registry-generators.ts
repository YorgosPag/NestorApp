/**
 * ENTERPRISE ID GENERATION — PUBLIC REGISTRY (ADR-777 ΕΠΙΠΕΔΟ Α) + ΔΙΑΘΕΣΕΙΣ
 *
 * Extracted from `enterprise-id-class.ts` when that file crossed the N.7.1 500-line
 * ceiling — a **split, not a trim**, following the same move that produced
 * `enterprise-id-bim-generators.ts`: the ADR-777 public registry (γη, δημόσιο κτίριο)
 * plus the διάθεση that hangs off it form one coherent domain group, so they move out
 * whole instead of being shaved off one line at a time.
 *
 * Composition model — abstract base chain, not a mixin:
 *
 *   BimEntityIdGenerators        (ADR-363 drawing entities)
 *     ↑ extends
 *   PublicRegistryIdGenerators   (this file — ADR-777 level Α + offers)
 *     ↑ extends
 *   EnterpriseIdService          (owns the engine: retry loop, cache, stats)
 *
 * The engine stays in exactly one place; this file adds **naming**, never generation
 * logic. Consumers see no change — every method below stays on the
 * `enterpriseIdService` singleton surface.
 *
 * 🔴 **Οι ταυτότητες του επιπέδου Α γεννιούνται ΜΟΝΟ στον διακομιστή** (SPEC-777A §14.4):
 * το επίπεδο Α το βλέπουν όλοι οι πελάτες, άρα μια ταυτότητα που γεννήθηκε στον πελάτη
 * είναι ταυτότητα χωρίς επαλήθευση πηγής — και όχι για έναν χρήστη, για όλους.
 *
 * @module services/enterprise-id-public-registry-generators
 * @version 1.0.0
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { BimEntityIdGenerators } from './enterprise-id-bim-generators';

// Alias for compact generator methods
const P = ENTERPRISE_ID_PREFIXES;

export abstract class PublicRegistryIdGenerators extends BimEntityIdGenerators {
  // `generateId` κληρονομείται ως protected abstract από τη βάση — η μηχανή μένει μία.

  /**
   * ADR-777 Α1 — id ενός κομματιού ΓΗΣ (`land_*`). Διακομιστής μόνο (§14.4 κανόνες 1-2).
   */
  generatePublicLandId(): string { return this.generateId(P.PUBLIC_LAND).id; }

  /**
   * ADR-777 Α11 — id δημόσιου ΚΤΙΡΙΟΥ (`pbld_*`). Διακομιστής μόνο, όπως και η γη.
   *
   * ⚠️ Δεν είναι το `generateBuildingId` — εκείνο δίνει `bldg_*` στο **εμπορικό** κτίριο
   * ενός έργου (επίπεδο Β).
   */
  generatePublicBuildingId(): string { return this.generateId(P.PUBLIC_BUILDING).id; }

  /**
   * ADR-777 Α20 — id μιας ΔΙΑΘΕΣΗΣ (`offr_*`).
   *
   * 🔴 Καλείται **μία φορά**, όταν γεννιέται η διάθεση, και ποτέ ξανά — ίδιο συμβόλαιο με
   * το `UniqueId` του Revit. Η ταυτότητα είναι το υποκείμενο του «το κλείσιμο μιας
   * διάθεσης αποσύρει τις άλλες»: χωρίς αυτήν, το «οι άλλες» δεν ονομάζεται.
   */
  generatePropertyOfferId(): string { return this.generateId(P.PROPERTY_OFFER).id; }

  /**
   * ADR-777 Α9 — id μιας ΖΗΤΗΣΗΣ (`dmnd_*`).
   *
   * 🔴 **Σε αντίθεση με τη γη και το δημόσιο κτίριο, αυτή ΔΕΝ είναι ταυτότητα του
   * επιπέδου Α — άρα ΔΕΝ περιορίζεται στον διακομιστή.** Η ζήτηση είναι **επίπεδο Β**
   * (SPEC-777A §14.2): ιδιωτικό δεδομένο **ενός ανθρώπου**, όχι κοινό γεγονός. Ένα
   * λάθος εδώ αφορά **έναν** χρήστη· ένα λάθος στο `land_*` αφορά **όλους ταυτόχρονα**
   * (§14.4). Γι' αυτό μοιράζεται το αρχείο αλλά **όχι** τον περιορισμό.
   */
  generatePropertyDemandId(): string { return this.generateId(P.PROPERTY_DEMAND).id; }

  /**
   * ADR-777 Α14 — id μιας **ΠΡΟΣΦΟΡΑΣ ΙΔΙΩΤΗ** (`ownp_*`).
   *
   * 🔑 **Το κάτοπτρο του `dmnd`, με τον ίδιο ακριβώς λόγο να ΜΗΝ περιορίζεται στον
   * διακομιστή**: είναι **επίπεδο Β** (SPEC-777A §14.2), ιδιωτικό δεδομένο **ενός
   * ανθρώπου**. Ένα λάθος εδώ αφορά **έναν** χρήστη· ένα λάθος στο `land_*` αφορά
   * **όλους ταυτόχρονα** (§14.4).
   *
   * ⚠️ Η **δημόσια προβολή** που γεννιέται από αυτό (`public_listings`) **δεν παίρνει
   * νέα ταυτότητα** — καθρεφτίζει αυτήν εδώ, όπως ακριβώς κάνει και για τα
   * `properties`. Δες `types/public-listing.ts`: *«ταυτότητα παραγόμενη, όχι νέα»*.
   */
  generateOwnerPropertyId(): string { return this.generateId(P.OWNER_PROPERTY).id; }

  /**
   * ADR-827 §8.7 — id ενός **ΑΙΤΗΜΑΤΟΣ ΑΝΑΘΕΣΗΣ** (`mreq_*`).
   *
   * 🔴 **ΔΙΑΚΟΜΙΣΤΗΣ ΜΟΝΟ, και ο λόγος ΔΕΝ είναι ο ίδιος με του `land_*`.** Εκεί το
   * κριτήριο ήταν *«ποιους αφορά ένα λάθος»*· εδώ είναι ότι το αίτημα έχει **δύο
   * μέρη** και **κανένα** από τα δύο δεν γράφει το έγγραφο: το `mandate_requests` έχει
   * `read: false` **και** `write: false` (§8.2). Ταυτότητα γεννημένη στον πελάτη θα
   * προϋπέθετε πελάτη που γράφει — που εδώ **δεν υπάρχει**.
   *
   * ⚠️ Η **εντολή** που γεννιέται από την αποδοχή **δεν παίρνει δική της ταυτότητα**:
   * είναι πεδίο μέσα στο `ownp_*` *(«αλλάζει χέρια, όχι ταυτότητα»)*. Αυτό εδώ
   * ταυτοποιεί το **αίτημα**, που επιβιώνει και της άρνησης.
   */
  generateMandateRequestId(): string { return this.generateId(P.MANDATE_REQUEST).id; }

  /**
   * ADR-835 §6.1 — id μιας **ΚΡΑΤΗΣΗΣ ΒΡΑΧΥΧΡΟΝΙΑΣ ΔΙΑΜΟΝΗΣ** (`stay_*`).
   *
   * 🔴 **ΔΙΑΚΟΜΙΣΤΗΣ ΜΟΝΟ, με το κριτήριο του `mreq_*` και όχι του `land_*`.** Δεν
   * είναι «ποιους αφορά ένα λάθος»: είναι ότι η κράτηση έχει **δύο μέρη** και κανένα
   * από τα δύο δεν είναι μόνο του αρμόδιο να τη γράψει. Ο επισκέπτης **ζητά**, ο
   * οικοδεσπότης **δέχεται**, και η επιβεβαίωση τρέχει τον κριτή κατάληψης **μέσα σε
   * συναλλαγή** (ADR-835 §6.1 · Κ1). Ταυτότητα γεννημένη στον πελάτη θα προϋπέθετε
   * πελάτη που γράφει — που εδώ **δεν υπάρχει**.
   *
   * 🔑 **Η ταυτότητα ΔΕΝ είναι διακοσμητική για τον κριτή**: με πολιτική
   * `sameHolder: 'conflicts'` (ADR-835 Φ2), μια κράτηση που ξαναϋπολογίζεται θα
   * συγκρουόταν **με τον εαυτό της** αν δεν μπορούσε να αναγνωριστεί. Δες
   * `Occupancy.occupancyId`.
   */
  generateStayBookingId(): string { return this.generateId(P.STAY_BOOKING).id; }

  /**
   * ADR-843 — id μιας **ΠΡΑΞΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ** (`fcon_*`).
   *
   * 🔴 **ΔΙΑΚΟΜΙΣΤΗΣ ΜΟΝΟ, με το κριτήριο του `mreq_*` και όχι του `land_*`.** Εκεί το
   * κριτήριο ήταν *«ποιους αφορά ένα λάθος»*· εδώ είναι ότι η πράξη έχει **δύο μέρη**
   * και **κανένα** από τα δύο δεν γράφει το έγγραφο: το `first_contacts` έχει
   * `read: false` **και** `write: false`. Ταυτότητα γεννημένη στον πελάτη θα
   * προϋπέθετε πελάτη που γράφει — που εδώ **δεν υπάρχει**.
   *
   * 🔑 **Και υπάρχει δεύτερος λόγος, που δεν τον έχει το `mreq`: η ΧΩΡΗΤΙΚΟΤΗΤΑ.** Το
   * ΠΕ5 δίνει στον ζητούντα ορισμένες πράξεις **ανοιχτές ταυτόχρονα**, και το όριο
   * κρίνεται **μετρώντας τις υπάρχουσες**. Πελάτης που γεννά ταυτότητες θα μπορούσε να
   * γεννήσει την ενδέκατη **παράλληλα** με τη δέκατη· ο έλεγχος θα έτρεχε δύο φορές
   * πάνω στην ίδια κατάσταση και θα περνούσε δύο φορές. Το όριο **δεν είναι
   * παρουσίαση** — είναι ο φρουρός του Κ5 *(«η πράξη γίνεται μαζική αποστολή»)*.
   *
   * ⚠️ Η **απόσυρση** του ΠΕ6 **δεν** γεννά δεύτερη ταυτότητα: είναι **μετάβαση
   * κατάστασης** πάνω σε αυτό εδώ. Δύο έγγραφα για «άνοιξα» και «έκλεισα» θα ήταν
   * δεύτερη αλήθεια στον ίδιο άξονα (ADR-749), και θα ξαναγέννησαν ακριβώς το φάντασμα
   * που το ΠΕ5 εξαφάνισε: πράξη που **δείχνει** κλειστή και **συμπεριφέρεται** ανοιχτή.
   */
  generateFirstContactId(): string { return this.generateId(P.FIRST_CONTACT).id; }
}
