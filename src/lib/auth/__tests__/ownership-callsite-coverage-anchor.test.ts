/**
 * ⚓ ADR-742 §7terdecies.3 — **ο πίνακας κάλυψης δεν επιτρέπεται να ξεχάσει σημείο**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΦΥΛΑΕΙ — ΓΙΑΤΙ ΔΕΝ ΑΡΚΟΥΝ ΟΙ ΣΟΥΙΤΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι σουίτες `ownership-empty-pair-*` οδηγούνται από **πίνακα**. Αν κάποιος
 * σβήσει μια γραμμή του πίνακα, το test **παύει να τρέχει** και όλα μένουν
 * πράσινα — *κατώφλι δεν πιάνει αφαίρεση* (ADR-742 μάθημα #7). Το ίδιο ισχύει
 * αν προστεθεί **νέο** σημείο κλήσης: κανείς δεν ρωτά «το κάλυψες;».
 *
 * Αυτός ο anchor κλείνει και τα δύο: σαρώνει το δέντρο για κλήσεις του SSoT και
 * απαιτεί **κάθε αρχείο** να έχει ρητή ταξινόμηση, **και** το αρχείο σουίτας
 * που επικαλείται η ταξινόμηση να **περιέχει όντως** τη διαδρομή. Η γραμμή που
 * σβήστηκε από τον πίνακα κοκκινίζει εδώ.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ **ΔΕΝ** ΒΛΕΠΕΙ (δηλωμένο — «πράσινο που κοίταξε το τίποτα»)
 * ─────────────────────────────────────────────────────────────────────────────
 * - **Την ποιότητα** του test της σουίτας. Ελέγχει ότι η διαδρομή αναφέρεται,
 *   όχι ότι το test είναι καλό. Την ποιότητα την κρίνει η **μετάλλαξη**, που
 *   τρέχει με το χέρι (`scripts` του ADR) και είναι καταγεγραμμένη στο §7terdecies.
 * - **Σημεία εκτός της περιμέτρου της Φάσης Γ.** Ο SSoT καλείται και από άλλες
 *   φάσεις (Α/Β/Δ) με **δικές τους** σουίτες. Μετρημένα και δηλωμένα στο
 *   {@link OUTSIDE_PHASE_C_PERIMETER} ώστε το πράσινο να μη διαβάζεται ως «όλα
 *   καλυμμένα από εμάς».
 * - **Κειμενικός** ο έλεγχος: κλήση γραμμένη με άλλο όνομα (alias import) δεν
 *   βρίσκεται. Το κόστος του εναλλακτικού (AST) δεν δικαιολογείται για ένα
 *   σύμβολο που κανείς δεν μετονομάζει· δηλώνεται ρητά αντί να αποσιωπηθεί.
 *
 * @module lib/auth/__tests__/ownership-callsite-coverage-anchor
 * @see adrs/ADR-742 §7terdecies
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const SRC_ROOT = join(process.cwd(), 'src');

/**
 * Τα σύμβολα του οποίου οι κλήσεις μετριούνται: ο SSoT **και** το περιτύλιγμά του `ownedOrNull` (ίδιο module,
 * ίδια κρίση — ρωτά `isPayloadOwnedByCompany`). Χωρίς το δεύτερο, κάθε σημείο που περνά από τη σιωπηλή πολιτική
 * ήταν **αόρατο** εδώ — και το `procurement-handler` της Φάσης Γ «μπαγιάτικο» μόλις μετανάστευσε σε αυτήν (ADR-783 Ε2).
 */
const CALL_PATTERN = /\b(isPayloadOwnedByCompany|ownedOrNull)\s*\(/;

/**
 * Το ίδιο το module ορισμού: περιέχει την κλήση μέσα στους δικούς του
 * φύλακες, αλλά **δεν είναι** σημείο κλήσης πεδίου ορισμού.
 */
const DEFINITION_MODULE = 'lib/auth/tenant-ownership.ts';

// =============================================================================
// Η ταξινόμηση
// =============================================================================

type Classification =
  /**
   * Αποδεδειγμένο με **ζεύγος κενό/κενό**: μετάλλαξη του SSoT το κοκκινίζει.
   * Το `suite` **πρέπει** να αναφέρει τη διαδρομή — έτσι πιάνεται η αφαίρεση
   * γραμμής από τον πίνακα.
   *
   * `callsiteIn`: η κλήση **μετακόμισε** σε φράχτη που το αρχείο καλεί (η σουίτα ασκεί το αρχείο από άκρη σε
   * άκρη, με τον φράχτη αληθινό). Η γραμμή **ξαναβρίσκεται** στο νέο σπίτι — δεν σβήνεται από την ιστορική περίμετρο.
   */
  | { readonly kind: 'empty-pair'; readonly suite: string; readonly callsiteIn?: string }
  /**
   * Το ζεύγος κενό/κενό είναι **απρόσιτο** λόγω φύλακα ανάντη, άρα ο SSoT είναι
   * εκεί αποδεδειγμένα ισοδύναμος με σκέτο `===`. Φυλάμε τον **ανάντη**.
   */
  | { readonly kind: 'upstream-guarded'; readonly suite: string; readonly why: string };

/**
 * 🔴 Η **περίμετρος της Φάσης Γ** — τα 12 αρχεία / 14 σημεία που η Φάση Γ
 * μετέτρεψε από σκέτο `!==` σε κλήση του SSoT, και που στις 2026-08-01
 * μετρήθηκε ότι **επιζούσαν** της μετάλλαξης (215 από 224 σουίτες πράσινες).
 */
const PHASE_C_PERIMETER: Readonly<Record<string, Classification>> = {
  'services/assignment/AssignmentPolicyRepository.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/opportunities-server.service.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/brokerage-server.service.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/property-showcase/load-text-digest.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/agent-capability/capabilities/boq/boq-tenant-guard.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/floorplan-background/floor-wipe-queries.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/ai-pipeline/tools/handlers/attachment-handler.ts': {
    kind: 'empty-pair',
    suite: 'src/services/ai-pipeline/tools/__tests__/handlers/ownership-empty-pair-handlers.test.ts',
  },
  'services/ai-pipeline/tools/handlers/org-structure-handler-utils.ts': {
    kind: 'empty-pair',
    suite: 'src/services/ai-pipeline/tools/__tests__/handlers/ownership-empty-pair-handlers.test.ts',
  },
  // ADR-923 κύμα 3 Λ5β (`d5a7b50a`) — ο έλεγχος βγήκε στον φράχτη `findOwnedPO` (πρόθεση `compose` ⇒ `ownedOrNull`)·
  // η σουίτα τρέχει τον handler με τον φράχτη ΑΛΗΘΙΝΟ, άρα η απόδειξη μένει δική του.
  'services/ai-pipeline/tools/handlers/procurement-handler.ts': {
    kind: 'empty-pair',
    suite: 'src/services/ai-pipeline/tools/__tests__/handlers/ownership-empty-pair-handlers.test.ts',
    callsiteIn: 'services/procurement/po-tenant-scope.ts',
  },
  'services/saved-reports/saved-reports-service.ts': {
    kind: 'empty-pair',
    suite: 'src/services/saved-reports/__tests__/saved-reports-service.test.ts',
  },
  'services/communications-triage-actions.ts': {
    kind: 'upstream-guarded',
    suite: 'src/services/__tests__/ownership-upstream-guarded.test.ts',
    why: '`if (!companyId || !adminUid)` στην ίδια συνάρτηση απορρίπτει τον κενό καλούντα',
  },
  'services/showcase-core/api/create-unified-public-pdf-route.ts': {
    kind: 'upstream-guarded',
    suite: 'src/services/__tests__/ownership-upstream-guarded.test.ts',
    why: 'η πύλη κοινοποίησης (`normalizeUnifiedShare`, ADR-884 Φ0.12) επιστρέφει `null` σε share χωρίς `companyId`',
  },
  'app/api/showcase/[token]/pdf/route.ts': {
    kind: 'upstream-guarded',
    suite: 'src/services/__tests__/ownership-upstream-guarded.test.ts',
    why: 'η πύλη κοινοποίησης ΚΑΙ το `loadEntityHeader` επιστρέφουν `null` σε κενό `companyId`',
  },
};

/**
 * 🔴 Σημεία **μεταγενέστερα της Φάσης Γ**, αποδεδειγμένα με την **ίδια** αυστηρότητα.
 *
 * Γεννήθηκαν μετά τις 2026-08-01 (βιτρίνα ADR-841 · βεβαίωση ADR-864 · πρόσκληση ADR-853)
 * και ο anchor τα έπιασε στις 2026-09-21 **χωρίς** απόδειξη. Δεν μπαίνουν στο
 * {@link PHASE_C_PERIMETER}: εκείνος είναι **ιστορικό γεγονός** (13 αρχεία, 10+3) και οι
 * αριθμοί του κλειδώνονται παρακάτω. Ούτε στο {@link OUTSIDE_PHASE_C_PERIMETER}: εκεί μια
 * γραμμή **δεν αποδεικνύει τίποτα** — θα ήταν το «ψεύτικο 0».
 *
 * ⇒ Ίδιος τύπος, **ίδιος** έλεγχος «η σουίτα ονομάζει τη διαδρομή», ίδιο τριπλό συμβόλαιο
 * (`describeOwnershipCallSites`). Μετάλλαξη `x?.companyId === y` στη θέση του SSoT:
 * **3/3 κόκκινα**, μετρημένα (ADR-742 §7terdecies).
 */
const PROVEN_AFTER_PHASE_C: Readonly<Record<string, Classification>> = {
  'lib/agency/showcase-canonical-segment.ts': {
    kind: 'empty-pair',
    suite: 'src/lib/agency/__tests__/showcase-canonical-segment.test.ts',
  },
  'lib/mandate/attestation-document-verdict.ts': {
    kind: 'empty-pair',
    suite: 'src/lib/mandate/__tests__/attestation-document-verdict.test.ts',
  },
  'server/auth/workspace-invitation.ts': {
    kind: 'empty-pair',
    suite: 'src/server/auth/__tests__/workspace-invitation.test.ts',
  },
  // ADR-884 Κ2α — ο κριτής μισθωτή της περιήγησης εταιρικής αγγελίας (`mayManageTour`).
  'lib/spatial-tour/tour-authority.ts': {
    kind: 'empty-pair',
    suite: 'src/lib/spatial-tour/__tests__/tour-authority.test.ts',
  },
  // ADR-884 Φ0.12 — η ανάκληση κοινοποίησης μετακόμισε στον διακομιστή (ADR-315).
  'server/sharing/share-revoke.ts': {
    kind: 'empty-pair',
    suite: 'src/server/sharing/__tests__/share-create-revoke.test.ts',
  },
  // ADR-829 §7.1 — ο στόχος ενός δεσμού κτιρίου → έργου κρίνεται απέναντι στο κτίριο.
  'app/api/buildings/_shared/building-ownership.ts': {
    kind: 'empty-pair',
    suite: 'src/app/api/buildings/__tests__/building-write-fields.test.ts',
  },
  // ADR-876 §5 Σ15 (`8a317580`) — διαπιστευτήριο ↔ πρόσκληση: Α3′ «κενό και στα δύο». Μετάλλαξη
  // `snap.data()?.companyId !== credential.companyId`: κόκκινο, μετρημένο 2026-11-20 (ADR-783 Ε2).
  'subapps/procurement/services/vendor-invite-resolver.ts': {
    kind: 'empty-pair',
    suite: 'src/subapps/procurement/services/__tests__/vendor-invite-resolver.test.ts',
  },
};

/** Το αρχείο όπου ζει **σήμερα** η κλήση μιας αποδεδειγμένης γραμμής. */
const callsiteOf = (file: string, c: Classification): string =>
  (c.kind === 'empty-pair' ? c.callsiteIn : undefined) ?? file;

/** Κάθε σημείο με **απόδειξη** — ό,τι ελέγχει ο πίνακας «η σουίτα ονομάζει τη διαδρομή». */
const PROVEN_CALLSITES: Readonly<Record<string, Classification>> = {
  ...PHASE_C_PERIMETER,
  ...PROVEN_AFTER_PHASE_C,
};

/**
 * Σημεία **εκτός** της περιμέτρου της Φάσης Γ — άλλες φάσεις, δικές τους
 * σουίτες. **Μετρημένα 2026-08-01: 16 αρχεία.**
 *
 * ⚠️ Ο αριθμός υπάρχει για να **μη διαβάζεται** το πράσινο ως «όλα καλυμμένα
 * από τη Φάση Γ». Αν κάποιο από αυτά μεταναστεύσει στην περίμετρο, μετακινείται
 * παραπάνω — δεν διαγράφεται από εδώ σιωπηλά.
 */
const OUTSIDE_PHASE_C_PERIMETER: readonly string[] = [
  'app/api/admin/role-management/project-members/route.ts',
  'app/api/contacts/resolve/resolve-helpers.ts',
  'app/api/floorplan-backgrounds/floorplan-backgrounds.handlers.ts',
  'app/api/projects/[projectId]/customers/route.ts',
  'app/api/properties/[id]/showcase/generate/helpers.ts',
  'app/api/quotes/_shared/quote-comments.ts',
  'app/api/storages/route.ts',
  'lib/auth/resource-ownership-guard.ts',
  'lib/auth/tenant-isolation.ts',
  // ADR-931 — ο πυρήνας `requireDocInTenant` μετακόμισε εδώ από το `tenant-isolation.ts` (ίδιος έλεγχος, ίδια κάλυψη).
  'lib/auth/tenant-isolation-core.ts',
  // ADR-931 — ιδιοκτησίες αποκλειστικής χρήσης κοινόχρηστου: ζωντανές, του καλούντος, στο ΙΔΙΟ κτίριο.
  'lib/common-spaces/common-space-legal.server.ts',
  'lib/firestore/entity-creation.service.ts',
  // Ήταν `lib/firestore/soft-delete-engine.ts`: η φόρτωση + ο έλεγχος μισθωτή βγήκαν στο
  // `lifecycle-target` όταν η μηχανή απέκτησε το αρχείο (ADR-329 §3.9). Ίδιος έλεγχος, ίδια
  // κάλυψη (`soft-delete-tenant-concealment.test.ts`) — άλλαξε μόνο το αρχείο που τον κρατά.
  'lib/firestore/lifecycle-target.ts',
  'services/ai-pipeline/tools/tool-tenant-guard.ts',
  'services/banking/bank-accounts-server.service.ts',
  // ADR-862 Φ0 Β14 — κάθε κρίκος οντότητα → κτίριο → έργο ανήκει στον μισθωτή του ΑΡΧΕΙΟΥ·
  // ξένο/κενό ⇒ `chain-broken` (project-team-birth-anchor Α30.5, μετάλλαξη M7).
  'lib/files/container-project.ts',
  //
  // 🗂️ **ΑΦΑΙΡΕΘΗΚΑΝ ΤΡΙΑ — ΟΧΙ ΣΙΩΠΗΛΑ** (ADR-866 βήμα 2β.3β, 2026-09-17):
  //     `services/iso19650/container-succession-policy.ts`
  //     `services/iso19650/container-transition-policy.ts`
  //     `services/iso19650/version-stack.ts`
  // Δεν **έφυγαν** από τον έλεγχο ιδιοκτησίας: **άλλαξαν πρωτογενές**. Το `isPayloadOwnedByCompany`
  // ρωτά *«ανήκει σε αυτή την ΕΤΑΙΡΕΙΑ;»* και ο ιδιώτης δεν έχει εταιρεία (ADR-787 Ε-3 §3), οπότε
  // τα τρία πέρασαν στο `isOwnedByCustody` (`lib/workspace/custody-scope`) — τη **γενίκευσή** του
  // στα δύο διαμερίσματα, με την **ίδια** παγίδα του κενού και **διαμέρισμα πριν την ταυτότητα**.
  // ⚠️ Αυτή η σάρωση μετρά καλούντες του `isPayloadOwnedByCompany`· μένοντας εδώ θα κοκκίνιζαν ως
  //    **μπαγιάτικες** καταχωρήσεις. Η κάλυψή τους ζει στο `custody-scope.test.ts` **Α2.ε** (11
  //    περιπτώσεις, incl. ταυτόσημα ids σε **άλλο** διαμέρισμα) + `container-personal-custody-anchor`
  //    **Α34.4/Α34.5** + `container-supersession-anchor` Α20.4 + `container-transitions-anchor` Α17.12.
  // 🔶 Όταν το `isOwnedByCustody` αποκτήσει **δικό του** μητρώο σημείων κλήσης, οι τρεις γραμμές
  //    μετακινούνται εκεί — δεν ξαναγράφονται εδώ.
  // ADR-884 Φ0.12 — ο έλεγχος «μπορεί ο μισθωτής να κοινοποιήσει;» μετακόμισε από τον browser
  // (`services/sharing/resolver-core/share-entity-access.ts`, διαγράφηκε) στον διακομιστή.
  'server/sharing/share-entity-access.ts',
  // ADR-923 T5 (`a8f96e3f`) — ο έλεγχος της επαφής-παραλήπτη μετακόμισε από το `rfq-service.ts`.
  'subapps/procurement/services/vendor-recipient.ts',
  //
  // ─── ADR-783 Ε2 (2026-11-20) — η σάρωση μετρά ΚΑΙ το `ownedOrNull` · σημεία μεταγενέστερα της Φάσης Γ ───
  // Ταξινομημένα, ΟΧΙ αποδεδειγμένα: καμία σουίτα κενό/κενό δεν ονομάζει τη διαδρομή. Δεν βρέθηκε κανένα
  // πραγματικό κενό ιδιοκτησίας (ανάγνωση)· `property-anchor-guard.ts` με αντεστραμμένα ορίσματα = συμμετρικό.
  // ADR-742 (`cedeeee6`, ενοποίηση «ανήκει σε εμένα;») · ADR-759 (`dfb446df`) · ADR-742 (`4c676f72`)
  'services/floorplan-background/floorplan-background.service.ts',
  'services/measurements/boq-tenant-ownership.ts',
  'services/title-block-apply/survey-record-write.ts',
  'subapps/procurement/services/procurement-owned-doc.ts',
  // ADR-876 §5.8 Σ15-Σ21 (`8a317580`) — γρ. 218 (`revokeVendorInvite`) χωρίς ζεύγος κενό/κενό ⇒ όχι PROVEN.
  'services/vendor-portal/vendor-invite-credential-store.ts',
  'subapps/procurement/services/vendor-invite-service.ts',
  'subapps/procurement/services/vendor-portal-submit-service.ts',
  // ADR-905 / μεταβίβαση (`a228f670` · `0f84e9b5`)
  'services/conveyance/conveyance-case.service.ts',
  'services/conveyance/conveyance-dependency-relay.server.ts',
  'services/conveyance/conveyance-subject.server.ts',
  // ADR-898 (`f9144c87`) · ADR-909 (`5b0d23a7`) · ADR-907 (`b30659e2`)
  'app/api/properties/[id]/property-anchor-guard.ts',
  'app/api/properties/[id]/floorplan/route.ts',
  'services/listings/floorplan-declaration.service.ts',
  'services/listings/floor-plate-declaration.service.ts',
  'services/listings/floor-plate.reader.ts',
  // ADR-915 (`90990f2f` · `5154230e` · `b9d69a7d` · `ff36ac87`) · ADR-942 (`eccf9ded`) · ADR-916 (`80c3672c`)
  'server/lib/owned-contact-docs.ts',
  'services/document-registry/registry-owners.server.ts',
  'server/lib/property-site-address.server.ts',
  'services/professional-registry/registry-check-record.service.ts',
  'services/document-registry/issuance-request-files.server.ts',
  'services/property-handover/property-handover-line-closure.service.ts',
  // ADR-917 (`030f8030` · `02497789`) · ADR-016 (`ea6df9f6`)
  'services/ai-pipeline/tools/financial-query-tools.ts',
  'services/project-cost/expense-cost-allocations.server.ts',
  'app/api/communications/email/record-sent-email.ts',
  // ADR-ACC-007 (`3883c60c`) · ADR-ACC-010 (`892162b6` · `cc539740`) · ADR-ACC-030 (`c290622a`) ·
  // ADR-917 F4.0 (`5d604140`) · ADR-ACC-018 (`fd7013ea`)
  'subapps/accounting/services/repository/accounting-repo-depreciation.ts',
  'subapps/accounting/services/repository/accounting-repo-fiscal-periods.ts',
  'subapps/accounting/services/repository/accounting-repo-journal-reversal.ts',
  'subapps/accounting/services/repository/accounting-repo-invoice-payments.ts',
  'subapps/accounting/services/repository/tenant-owned-doc.ts',
  'server/accounting/public-invoice/tenant-invoice.ts',
  // ADR-923 κατάλογος (`42fc385f` · `0b5ab077` · `8ce13693`) · §5.12 (`d14e0d0d` · `3c7c730a`) ·
  // ADR-934 (`27c3cadc` · `23097706`) · προμήθειες (`668b768b`)
  'server/catalog/catalog-store.server.ts',
  'server/catalog/catalog-library-reads.server.ts',
  'server/catalog/pricing-party-reads.server.ts',
  'server/catalog/editions/catalog-edition-reads.server.ts',
  'server/catalog/editions/catalog-edition-writer.server.ts',
  'server/supply-relationships/boq-supplier-price.server.ts',
  'server/supply-relationships/supply-foreign-search.server.ts',
  'subapps/catalog/import/media-source-identity.ts',
  'subapps/catalog/import/import-asset-fetch-document.ts',
  'subapps/procurement/services/framework-agreement-scope-guard.ts',
  // ADR-928 υπεργολαβία (`f41781e5` · `b354fe04`)
  'server/subcontracts/subcontract-store.server.ts',
  'server/subcontracts/agreement-parties.server.ts',
];

/**
 * 🔴 Ο **μάρτυρας** (μάθημα #7). Αν η σάρωση σπάσει — λάθος ρίζα, εξαίρεση σε
 * `readdirSync`, αλλαγμένο pattern — το σύνολο αδειάζει και **όλοι** οι έλεγχοι
 * πληρότητας γίνονται κενά αληθείς. Αυτά τα δύο αρχεία **πρέπει** να βρεθούν:
 * ένα υπηρεσίας και ένα διαδρομής, ώστε ο μάρτυρας να καλύπτει **δύο δέντρα**,
 * όχι ένα (η επέκταση του Βήματος Β για τον ίδιο ακριβώς λόγο).
 */
const WITNESS_FILES: readonly string[] = [
  'services/saved-reports/saved-reports-service.ts',
  'app/api/showcase/[token]/pdf/route.ts',
];

/** Κατώφλι κατά της άδειας σάρωσης, συντηρητικό (μετρημένα 29 στις 2026-08-01). */
const MIN_CALLSITE_FILES = 20;

// =============================================================================
// Σάρωση
// =============================================================================

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Αγνοεί κλήσεις μέσα σε σχόλιο ή γραμμή `import` — μετράει **κώδικα**. */
function hasCall(source: string): boolean {
  return source
    .split('\n')
    .some(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return false;
      if (trimmed.startsWith('import ')) return false;
      return CALL_PATTERN.test(line);
    });
}

const callSiteFiles: readonly string[] = collectSourceFiles(SRC_ROOT)
  .filter(file => hasCall(readFileSync(file, 'utf8')))
  .map(file => relative(SRC_ROOT, file).split(sep).join('/'))
  .filter(file => file !== DEFINITION_MODULE)
  .sort();

// =============================================================================
// Οι έλεγχοι
// =============================================================================

describe('⚓ ADR-742 — πληρότητα κάλυψης των σημείων ιδιοκτησίας', () => {
  describe('φύλακας κατά της άδειας σάρωσης', () => {
    test(`βρίσκει τουλάχιστον ${MIN_CALLSITE_FILES} αρχεία με κλήση`, () => {
      expect(callSiteFiles.length).toBeGreaterThanOrEqual(MIN_CALLSITE_FILES);
    });

    test.each(WITNESS_FILES)('ο μάρτυρας «%s» βρίσκεται στη σάρωση', witness => {
      expect(callSiteFiles).toContain(witness);
    });
  });

  describe('κάθε σημείο κλήσης είναι ρητά ταξινομημένο', () => {
    test('καμία κλήση χωρίς ταξινόμηση (νέο σημείο ⇒ κόκκινο)', () => {
      const classified = new Set([
        ...Object.entries(PROVEN_CALLSITES).map(([file, c]) => callsiteOf(file, c)),
        ...OUTSIDE_PHASE_C_PERIMETER,
      ]);
      const unclassified = callSiteFiles.filter(file => !classified.has(file));

      expect(unclassified).toEqual([]);
    });

    test('καμία μπαγιάτικη καταχώρηση (αρχείο χωρίς κλήση πια ⇒ κόκκινο)', () => {
      const known = [
        ...Object.entries(PROVEN_CALLSITES).map(([file, c]) => callsiteOf(file, c)),
        ...OUTSIDE_PHASE_C_PERIMETER,
      ];
      const stale = known.filter(file => !callSiteFiles.includes(file));

      expect(stale).toEqual([]);
    });
  });

  describe('η επικαλούμενη σουίτα αναφέρει όντως τη διαδρομή', () => {
    const entries = Object.entries(PROVEN_CALLSITES);

    test.each(entries)('%s → η σουίτα υπάρχει και την ονομάζει', (file, classification) => {
      const suiteSource = readFileSync(join(process.cwd(), classification.suite), 'utf8');

      // Οι σουίτες `empty-pair` κρατούν τη διαδρομή στο πεδίο `file` του πίνακα·
      // οι `upstream-guarded` την ονομάζουν στην κεφαλίδα τους. Και στις δύο
      // περιπτώσεις η **αφαίρεση** της γραμμής σβήνει τη συμβολοσειρά.
      expect(suiteSource).toContain(file);
    });
  });

  describe('η περίμετρος της Φάσης Γ είναι πλήρης', () => {
    test('και τα 13 αρχεία της Φάσης Γ είναι ταξινομημένα', () => {
      // 12 αρχεία με 14 σημεία + το `saved-reports` που ήταν ήδη καλυμμένο.
      expect(Object.keys(PHASE_C_PERIMETER)).toHaveLength(13);
    });

    test('δέκα αποδεικνύονται με ζεύγος κενό/κενό, τρία είναι φυλαγμένα ανάντη', () => {
      const byKind = Object.values(PHASE_C_PERIMETER).reduce<Record<string, number>>(
        (acc, c) => ({ ...acc, [c.kind]: (acc[c.kind] ?? 0) + 1 }),
        {},
      );

      expect(byKind).toEqual({ 'empty-pair': 10, 'upstream-guarded': 3 });
    });
  });

  describe('μεταγενέστερα της Φάσης Γ: απόδειξη, ποτέ σκέτη λίστα', () => {
    test('κανένα αρχείο δεν ταξινομείται ΔΥΟ φορές', () => {
      const proven = Object.keys(PROVEN_AFTER_PHASE_C);
      const doubled = proven.filter(
        file => file in PHASE_C_PERIMETER || OUTSIDE_PHASE_C_PERIMETER.includes(file),
      );
      // Και το νέο σπίτι μιας κλήσης που μετακόμισε δεν δηλώνεται δεύτερη φορά ως «εκτός».
      const relocated = Object.entries(PROVEN_CALLSITES)
        .map(([file, c]) => callsiteOf(file, c))
        .filter(home => OUTSIDE_PHASE_C_PERIMETER.includes(home));
      expect(relocated).toEqual([]);

      expect(doubled).toEqual([]);
    });

    /**
     * Όλα — όχι «τα τρία»: ο αριθμός μεγαλώνει με κάθε νέο σημείο (4ο: `share-revoke`,
     * ADR-884 Φ0.12), το δόγμα όχι. Ο «ανάντη φύλακας» ανήκει στην ιστορική περίμετρο.
     */
    test('ΟΛΑ αποδεικνύονται με ζεύγος κενό/κενό — κανένα «upstream-guarded»', () => {
      const notEmptyPair = Object.entries(PROVEN_AFTER_PHASE_C)
        .filter(([, c]) => c.kind !== 'empty-pair')
        .map(([file]) => file);

      expect(Object.keys(PROVEN_AFTER_PHASE_C).length).toBeGreaterThan(0);
      expect(notEmptyPair).toEqual([]);
    });
  });
});
