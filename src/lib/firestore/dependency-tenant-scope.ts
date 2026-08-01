/**
 * «Φέρει αυτή η **συλλογή** `companyId`;» — **ο κανόνας του μητρώου, μία φορά**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-742 §7novies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Δύο μηχανές διαβάζουν τους **ίδιους** καταλόγους εξαρτήσεων
 * (`config/contact-dependency-registry.ts` · `config/deletion-registry.ts`),
 * όπου κάθε εξάρτηση δηλώνει `skipCompanyFilter`. Ο κανόνας **εφαρμογής** αυτής
 * της δήλωσης ήταν γραμμένος **έξι φορές σε τρία αρχεία**:
 *
 * ```
 * contact-impact-engine.ts : 87, 108, 142     («τι θα ΕΠΗΡΕΑΣΤΕΙ αν αλλάξω;»)
 * deletion-guard.ts        : 167, 360         («τι θα ΣΠΑΣΕΙ αν σβήσω;»)
 * deletion-link-guard.ts   : 86               («…και αν λύσω τον δεσμό;»)
 * ```
 *
 * 🔴 **Και είχαν ήδη αποκλίνει.** Μέχρι τις 2026-08-01 τα τρία του
 * impact-engine ρωτούσαν `if (!query.skipCompanyFilter && companyId)` ενώ τα
 * άλλα πέντε `if (!dep.skipCompanyFilter)`. Η **δεύτερη συνθήκη** σήμαινε *«αν
 * δεν μου δώσεις tenant, μη φιλτράρεις καθόλου»* — και κανένας από τους έξι
 * καλούντες δεν έδινε tenant ⇒ **το φίλτρο δεν έτρεξε ποτέ** και τα preview
 * μετρούσαν εγγραφές **όλων** των πελατών (ADR-742 §7octies: διαρροή
 * περιεχομένου, όχι μαντείο ύπαρξης).
 *
 * Η **απόκλιση** διορθώθηκε τότε. Η **δομή** που την επέτρεψε — έξι αντίγραφα
 * ενός κανόνα — διορθώνεται εδώ: ο έβδομος που θα γραφτεί δεν έχει πού να
 * αποκλίνει, γιατί δεν υπάρχει πια σημείο να ξαναγραφτεί ο κανόνας.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ **ΔΕΝ** ΕΙΝΑΙ ΑΥΤΟ ΤΟ MODULE — Η ΠΙΟ ΚΡΙΣΙΜΗ ΔΙΑΚΡΙΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Υπάρχει **ήδη** SSoT για tenant filtering: το `tenant-scoped-query.ts`
 * (ADR-702). Απαντά όμως **άλλη ερώτηση**, και η σύγχυση των δύο είναι το
 * πραγματικό ρίσκο:
 *
 * | | ερώτηση | «χωρίς φίλτρο» σημαίνει |
 * |---|---|---|
 * | `scopeQueryToTenant` (ADR-702) | «ποιον tenant **δικαιούται ο καλών**;» | **πολιτική**: super-admin που διαβάζει όλες τις εταιρείες |
 * | `tenantScopedDependencyQuery` (εδώ) | «αυτή η **συλλογή** φέρει `companyId`;» | **δομικό**: το πεδίο δεν υπάρχει καν |
 *
 * Γι' αυτό η σύνθεση γίνεται στο {@link scopeQueryToCompany} — το **μισό που δεν
 * παραλείπει ποτέ** — και **όχι** στο `scopeQueryToTenant`, που έχει τον δικό
 * του, νόμιμο κλάδο παράλειψης. Αν οι δύο λόγοι παράλειψης μοιράζονταν κλάδο,
 * κανείς δεν θα ξεχώριζε **πολιτική** από **σφάλμα** — ακριβώς η αστοχία που
 * γέννησε το §7octies.
 *
 * ⚠️ Και δεν περνά ψεύτικο `TenantScope`: ο τύπος απαιτεί `isSuperAdmin` /
 * `isCrossTenant`, ισχυρισμούς **για τον καλούντα** που αυτό το στρώμα δεν
 * γνωρίζει. Ένα `{ isSuperAdmin: false }` της στιγμής θα ήταν ψέμα που θα
 * γινόταν αληθινό μόνο κατά τύχη.
 *
 * @module lib/firestore/dependency-tenant-scope
 * @see ./tenant-scoped-query — ο SSoT της **άλλης** ερώτησης (ADR-702)
 * @see ADR-742 §3.2, §7octies, §7novies
 */

import 'server-only';

import { scopeQueryToCompany } from './tenant-scoped-query';

/**
 * Ό,τι χρειάζεται ο κανόνας από τη δήλωση της εξάρτησης — και **τίποτα άλλο**.
 *
 * Δομικός τύπος επίτηδες: τον ικανοποιούν ήδη οι `DependencyDef`,
 * `CascadeDependencyDef`, `CompoundDependencyDef` και οι τρεις
 * `ContactQueryStrategy`, χωρίς να χρειαστεί κανένας από τους δύο καταλόγους να
 * μάθει για τον άλλον.
 */
export interface TenantFilterableDependency {
  /**
   * `true` ⇒ η συλλογή **δεν φέρει** πεδίο `companyId` (π.χ.
   * `accounting_invoices`, `external_identities`). Δήλωση **σχήματος**, όχι
   * άδεια πρόσβασης: φιλτράροντας σε ανύπαρκτο πεδίο, το Firestore επιστρέφει
   * μηδέν έγγραφα και ο φύλακας θα έλεγε ψευδώς «καμία εξάρτηση».
   */
  readonly skipCompanyFilter?: boolean;
  /**
   * `true` ⇒ το `collectionPath` είναι id **υποσυλλογής** και ανοίγει με
   * `collectionGroup` (π.χ. `items` κάτω από `dxf_overlay_levels/{id}/items`).
   *
   * Ανήκει εδώ επειδή είναι το «**πώς** ανοίγει η συλλογή» — και αν έμενε έξω,
   * ο μοναδικός καλών του θα ξαναέφτιαχνε αφιλτράριστο ενδιάμεσο query, δηλαδή
   * ακριβώς το πράγμα που αυτό το module κάνει μη-εκφράσιμο.
   */
  readonly useCollectionGroup?: boolean;
}

/**
 * Άνοιξε τη συλλογή μιας εξάρτησης **ήδη περιορισμένη** στον μισθωτή.
 *
 * Το φίλτρο δεν είναι κάτι που *μπορείς* να εφαρμόσεις — είναι ο **τρόπος που
 * αποκτάς** το query. Δεν υπάρχει έκφραση σε αυτά τα τρία αρχεία που να παράγει
 * αφιλτράριστο query πάνω σε συλλογή που φέρει `companyId`: το λάθος δεν
 * πιάνεται, είναι **μη-εκφράσιμο** (ίδιο δόγμα με το `tenantScopedCollection`
 * του ADR-702· OWASP TenantScopedRepository).
 *
 * 🔴 **Το `companyId` είναι υποχρεωτικό — ο τύπος είναι ο φύλακας που δεν
 * ξεχνιέται** (ADR-742 §7octies, μάθημα #6). Η προαιρετικότητά του ήταν όλη η
 * αιτία της διαρροής.
 *
 * ⚠️ **Κενό `companyId` ΔΕΝ ακυρώνει το φίλτρο** — μπαίνει `where(companyId,'==','')`
 * και η ερώτηση αποτυγχάνει **κλειστά**. Το κενό δεν είναι tenant, είναι
 * **απουσία** tenant (ADR-742 §4)· η εναλλακτική («μη φιλτράρεις όταν δεν ξέρεις
 * ποιον») είναι αυτολεξεί η μετάλλαξη που διέρρευσε.
 *
 * @param db             Admin Firestore
 * @param collectionPath Όνομα συλλογής από το `COLLECTIONS` — ή id υποσυλλογής
 *                       όταν `dep.useCollectionGroup`
 * @param dep            Η δήλωση της εξάρτησης, **ολόκληρη** (ποτέ
 *                       ανασυντεθειμένο literal: αν κάποιος ξεχάσει να
 *                       αντιγράψει το `skipCompanyFilter`, η μέτρηση μηδενίζεται
 *                       σιωπηλά)
 * @param companyId      Ο ενεργός μισθωτής, ήδη αποφασισμένος από τον καλούντα
 */
export function tenantScopedDependencyQuery(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  dep: TenantFilterableDependency,
  companyId: string,
): FirebaseFirestore.Query {
  const collection: FirebaseFirestore.Query = dep.useCollectionGroup
    ? db.collectionGroup(collectionPath)
    : db.collection(collectionPath);

  return dep.skipCompanyFilter ? collection : scopeQueryToCompany(collection, companyId);
}
