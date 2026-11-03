'use strict';
/**
 * =============================================================================
 * Χ — ΤΑ GOLDEN ΔΕΔΟΜΕΝΑ: ποια οντότητα γεμίζει ποιο δυναμικό τμήμα (ADR-875 §10)
 * =============================================================================
 *
 * Η Φάση 1 γέμισε το `[workspace]` με **συνεδρία**. Τα υπόλοιπα δυναμικά τμήματα
 * (`[id]`, `[poId]`, `[token]`, …) έμεναν `ssr-probe` ⇒ 🔶 `surface-synthetic-id`,
 * 46 από τα 67 του πρώτου run, και η σπορά αρνήθηκε (ταβάνι 20%, ADR-875 §9.2).
 *
 * 🔑 ΜΙΑ ΑΥΘΕΝΤΙΑ, ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ: αυτό το αρχείο το διαβάζουν **και** ο σπορέας
 *    (`emulator-seed-golden.ts`, για να ξέρει ΤΙ να σπείρει) **και** ο χρησμός
 *    (για να ξέρει ΠΟΥ μπαίνει κάθε id). Γι' αυτό είναι CommonJS χωρίς εξαρτήσεις:
 *    ο χρησμός τρέχει χωρίς `node_modules` (ADR-788).
 *
 * 🔑 ΔΥΟ ΒΑΘΜΙΔΕΣ, ΜΕ ΚΡΙΤΗΡΙΟ ΠΟΥ **ΕΚΤΕΛΕΙΤΑΙ** (άγκυρα Γ6):
 *   • `api`     — η οντότητα **διαβάζεται στον server** από τη σελίδα ή από layout της
 *                 διαδρομής (π.χ. `projects/[id]/procurement/layout.tsx` →
 *                 `requireProjectForPage`). Σπέρνεται από το **API της σταλμένης
 *                 εικόνας**, δηλαδή από την ίδια διαδρομή εγγραφής με τον χρήστη:
 *                 πολιτική, zod, audit, ομάδα έργου, υπογεγραμμένο token.
 *   • `witness` — η σελίδα **δεν** τη διαβάζει στον server (client component ή σκέτο
 *                 redirect). Το SSR είναι το ίδιο για κάθε id, άρα αρκεί **μάρτυρας
 *                 ύπαρξης**. Αν αύριο η σελίδα αρχίσει να τη διαβάζει, η Γ6 κοκκινίζει
 *                 και η οντότητα πρέπει να ανέβει σε `api`.
 *   • `value`   — δεν είναι οντότητα: μία τιμή από κλειστό σύνολο (`[type]`), από στατικό αρχείο
 *                 της εικόνας (`/area/[id]`, ευρετήριο ADR-883 · `/…/versions/[version]`, παγωμένα
 *                 νομικά κείμενα ADR-861) ή ο χώρος που έσπειρε ήδη ο `emulator-seed-personas`
 *                 (`/pro/[alias]`). Ο σπορέας golden δεν γράφει τίποτα.
 * =============================================================================
 */

const GOLDEN_TIERS = Object.freeze({ API: 'api', WITNESS: 'witness', VALUE: 'value' });

/**
 * Οι οντότητες — κλειστό σύνολο. `prefix` = αντίγραφο του `ENTERPRISE_ID_PREFIXES`
 * (`src/services/enterprise-id-prefixes.ts`), ΕΛΕΓΧΕΤΑΙ στην άγκυρα Γ2.
 */
const GOLDEN_ENTITIES = Object.freeze({
  project: { tier: GOLDEN_TIERS.API, prefix: 'proj' },
  rfq: { tier: GOLDEN_TIERS.API, prefix: 'rfq' },
  purchaseOrder: { tier: GOLDEN_TIERS.API, prefix: 'po' },
  attendanceToken: { tier: GOLDEN_TIERS.API, prefix: null },
  poShareToken: { tier: GOLDEN_TIERS.API, prefix: null },
  contact: { tier: GOLDEN_TIERS.WITNESS, prefix: 'cont' },
  building: { tier: GOLDEN_TIERS.WITNESS, prefix: 'bldg' },
  property: { tier: GOLDEN_TIERS.WITNESS, prefix: 'prop' },
  parking: { tier: GOLDEN_TIERS.WITNESS, prefix: 'park' },
  storage: { tier: GOLDEN_TIERS.WITNESS, prefix: 'stor' },
  lead: { tier: GOLDEN_TIERS.WITNESS, prefix: 'opp' },
  task: { tier: GOLDEN_TIERS.WITNESS, prefix: 'task' },
  obligation: { tier: GOLDEN_TIERS.WITNESS, prefix: 'obl' },
  invoice: { tier: GOLDEN_TIERS.WITNESS, prefix: 'inv' },
  ownerProperty: { tier: GOLDEN_TIERS.WITNESS, prefix: 'ownp' },
  quote: { tier: GOLDEN_TIERS.WITNESS, prefix: 'qt' },
  engagement: { tier: GOLDEN_TIERS.WITNESS, prefix: 'eng' },
  file: { tier: GOLDEN_TIERS.WITNESS, prefix: 'file' },
  demand: { tier: GOLDEN_TIERS.WITNESS, prefix: 'dmnd' },
  dossier: { tier: GOLDEN_TIERS.WITNESS, prefix: 'pdos' },
  networkThread: { tier: GOLDEN_TIERS.WITNESS, prefix: 'nthr' },
  handoverProtocol: { tier: GOLDEN_TIERS.WITNESS, prefix: 'phpr' },
  reportType: { tier: GOLDEN_TIERS.VALUE, prefix: null },
  area: { tier: GOLDEN_TIERS.VALUE, prefix: null },
  legalVersion: { tier: GOLDEN_TIERS.VALUE, prefix: null },
  agencyAlias: { tier: GOLDEN_TIERS.VALUE, prefix: null },
});

/**
 * Πρότυπο διαδρομής → οντότητες, **θεσιακά** ανά δυναμικό τμήμα (πλην του `[workspace]`).
 * Κλειστό σύνολο: η άγκυρα Γ1 απαιτεί ο κατάλογος **και** το {@link GOLDEN_UNBOUND} να
 * είναι μαζί ΑΚΡΙΒΩΣ τα δυναμικά πρότυπα του `enumerateRoutes` — ούτε ένα λιγότερο
 * (άκριτο, χωρίς κανείς να το αποφάσισε), ούτε ένα περισσότερο (μπαγιάτικο).
 */
const GOLDEN_TEMPLATES = Object.freeze({
  '/o/[workspace]/accounting/invoices/[id]/edit': ['invoice'],
  '/o/[workspace]/accounting/reports/[type]': ['reportType'],
  '/o/[workspace]/buildings/[id]': ['building'],
  '/o/[workspace]/cases/[engagementId]': ['engagement'],
  '/o/[workspace]/contacts/[id]': ['contact'],
  '/o/[workspace]/crm/leads/[id]': ['lead'],
  '/o/[workspace]/crm/tasks/[taskId]': ['task'],
  '/o/[workspace]/files/[id]': ['file'],
  '/o/[workspace]/listings/mandates/[ownerPropertyId]': ['ownerProperty'],
  '/o/[workspace]/obligations/[id]/edit': ['obligation'],
  '/o/[workspace]/parking/[id]': ['parking'],
  '/o/[workspace]/procurement/purchase-orders/[id]': ['purchaseOrder'],
  '/o/[workspace]/procurement/quotes/[id]/review': ['quote'],
  '/o/[workspace]/procurement/rfqs/[id]': ['rfq'],
  '/o/[workspace]/projects/[id]': ['project'],
  '/o/[workspace]/projects/[id]/procurement': ['project'],
  '/o/[workspace]/projects/[id]/procurement/coverage': ['project'],
  '/o/[workspace]/projects/[id]/procurement/overview': ['project'],
  '/o/[workspace]/projects/[id]/procurement/po': ['project'],
  '/o/[workspace]/projects/[id]/procurement/po/[poId]': ['project', 'purchaseOrder'],
  '/o/[workspace]/projects/[id]/procurement/quote': ['project'],
  '/o/[workspace]/projects/[id]/procurement/quote/[quoteId]': ['project', 'quote'],
  '/o/[workspace]/projects/[id]/procurement/quote/[quoteId]/review': ['project', 'quote'],
  '/o/[workspace]/projects/[id]/procurement/rfq': ['project'],
  '/o/[workspace]/projects/[id]/procurement/rfq/[rfqId]': ['project', 'rfq'],
  '/o/[workspace]/properties/[id]': ['property'],
  '/o/[workspace]/storage/[id]': ['storage'],
  // ── Δημόσιες πόρτες με υπογεγραμμένο token (ADR-876) — κρίνονται ΑΝΩΝΥΜΑ ──
  '/attendance/check-in/[token]': ['attendanceToken'],
  // 🔴 ADR-890: η σελίδα περιοχής απαντά ΣΩΣΤΑ 404 σε άγνωστη ταυτότητα, άρα με `ssr-probe` ο χρησμός
  //    έβγαζε ⛔ `route-unreachable`. Με πραγματική περιοχή κρίνεται η ίδια η σελίδα.
  '/area/[id]': ['area'],
  // ⚠️ Η πύλη προμηθευτή ΔΕΝ είναι εδώ (ADR-876 §5 Φ7): ζει στο ΣΤΑΤΙΚΟ `/vendor/quote` και το
  //    διαπιστευτήριο στο fragment — ο server δεν το βλέπει ποτέ, άρα δεν υπάρχει τίποτα να δεθεί.
  '/shared/po/[token]': ['poShareToken'],
  // ── Τα παγωμένα νομικά κείμενα (ADR-861): ζουν στην εικόνα, η σελίδα αποδίδει το ΑΛΗΘΙΝΟ κείμενο ──
  '/data-deletion/versions/[version]': ['legalVersion'],
  '/handover-protocol/versions/[version]': ['legalVersion'],
  '/privacy-policy/versions/[version]': ['legalVersion'],
  '/private-marketing-disclosure/versions/[version]': ['legalVersion'],
  '/terms/versions/[version]': ['legalVersion'],
  '/pro/[alias]': ['agencyAlias'],
  '/handover-protocol/verify/[protocolId]': ['handoverProtocol'],
  // ── Ο ιδιωτικός χώρος `(me)`: client σελίδες, κρίνονται ΑΝΩΝΥΜΑ όπως τα 16 στατικά αδέλφια τους ──
  // 🔑 Ο χρησμός δεν έχει persona «άνθρωπος χωρίς γραφείο». Το αποτέλεσμα λέει τι βλέπει ο ανώνυμος
  //    (κέλυφος, 🔴 ratchet κατά ταυτότητα), ΟΧΙ τι βλέπει ο κάτοχος: αυτό παραμένει ΑΜΕΤΡΗΤΟ.
  '/demands/[demandId]': ['demand'],
  '/dossiers/[dossierId]': ['dossier'],
  '/engagements/[engagementId]': ['engagement'],
  '/messages/[threadId]': ['networkThread'],
  '/offers/[offerId]': ['ownerProperty'],
  '/offers/[offerId]/calendar': ['ownerProperty'],
  '/offers/[offerId]/improve': ['ownerProperty'],
  '/offers/[offerId]/tour': ['ownerProperty'],
});

/** Γιατί ένα δυναμικό πρότυπο ΔΕΝ δένεται με golden id — κλειστό σύνολο, κάθε τιμή με λόγο. */
const UNBOUND_REASONS = Object.freeze({
  /**
   * Υπογεγραμμένο διαπιστευτήριο που ζει ΜΟΝΟ στο email του παραλήπτη: το API δεν το επιστρέφει,
   * και η υπογραφή θέλει το μυστικό του `environment-contract`. Τα δεδομένα από πίσω τα διαβάζει ο
   * server, άρα ούτε μάρτυρας (Γ6). Δένονται μόνο με σπορά που εκδίδει το ΙΔΙΟ το token.
   */
  MAIL_CREDENTIAL: 'mail-credential',
  /** Χρειάζεται ΠΛΗΡΗ ροή τομέα (δημοσίευση, κοινοποίηση αρχείου, PDF)· μάρτυρας θα ήταν δεύτερη αλήθεια. */
  DOMAIN_FIXTURE: 'domain-fixture',
  /** Ανακατευθύνει ΠΑΝΤΑ, για κάθε id: ποτέ `surface-synthetic-id`, μετρούνται ως `route-redirected`. */
  ALWAYS_REDIRECTS: 'always-redirects',
});

/**
 * 🔑 **ΤΑ ΔΥΝΑΜΙΚΑ ΠΡΟΤΥΠΑ ΠΟΥ ΔΕΝ ΔΕΝΟΝΤΑΙ — ΔΗΛΩΜΕΝΑ, ΜΕ ΛΟΓΟ.**
 *
 * 🔴 **Το κενό που κλείνει (run `41349947612`):** το Γ1 κοιτούσε μόνο τα `/o`. Οι δημόσιες δυναμικές
 * σελίδες έμπαιναν στον κάδο 🔶 χωρίς καμία απόφαση, 21 → 34, και το έμαθε **ο χρησμός, μετά το merge**.
 * Τώρα νέα δυναμική σελίδα κοκκινίζει στο jest (Γ1, Γ1ε): ή δένεται, ή δηλώνεται εδώ με λόγο.
 */
const GOLDEN_UNBOUND = Object.freeze({
  '/card-email/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/case-invite/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/contact/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/email/preferences/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/handover-invite/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/hours-question/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/invite/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/mandate/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/supply-invite/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/tour-invite/[token]': UNBOUND_REASONS.MAIL_CREDENTIAL,
  '/listing/[id]': UNBOUND_REASONS.DOMAIN_FIXTURE,
  '/listing/[id]/floorplan': UNBOUND_REASONS.DOMAIN_FIXTURE,
  '/listing/[id]/photos': UNBOUND_REASONS.DOMAIN_FIXTURE,
  '/listing/[id]/tour': UNBOUND_REASONS.DOMAIN_FIXTURE,
  '/share/photo/[id]': UNBOUND_REASONS.DOMAIN_FIXTURE,
  '/shared/[token]': UNBOUND_REASONS.DOMAIN_FIXTURE,
  '/showcase/[token]': UNBOUND_REASONS.DOMAIN_FIXTURE,
  '/supply-request/[token]': UNBOUND_REASONS.DOMAIN_FIXTURE,
  '/[...unprefixed]': UNBOUND_REASONS.ALWAYS_REDIRECTS,
  '/n/[notificationId]': UNBOUND_REASONS.ALWAYS_REDIRECTS,
});

/**
 * 🔑 **ΟΙ ΔΗΜΟΣΙΕΣ ΠΟΡΤΕΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** (ADR-876) — πρότυπα ΕΚΤΟΣ `/o`, που ο χρησμός
 * δένει με πραγματικό token και κρίνει **χωρίς συνεδρία**, όπως τα βλέπει ο παραλήπτης.
 *
 * 🔴 **Γιατί υπάρχει**: η πύλη προμηθευτή και το check-in παρουσιών ζούσαν κάτω από το
 * `/o/[workspace]` (από το `5ff0baa2`) και ο χρησμός τις έκρινε **με συνεδρία μέλους** —
 * δηλαδή ως άνθρωπο που ο πραγματικός παραλήπτης (προμηθευτής, εργάτης) **δεν είναι ποτέ**.
 * Πράσινο για τον λάθος θεατή· `/login` για τον σωστό. Μια πόρτα χωρίς λογαριασμό κρίνεται
 * μόνο ανώνυμα.
 *
 * ⚠️ **ΠΑΡΑΓΕΤΑΙ, δεν γράφεται**: μια δεύτερη χειρόγραφη λίστα θα επαναλάμβανε κλειδιά του
 * `GOLDEN_TEMPLATES` και θα απέκλινε στην πρώτη νέα πόρτα (σχήμα ADR-749). Δημόσιο = κάθε
 * πρότυπο του καταλόγου που **δεν** ζει κάτω από τον χώρο.
 */
const GOLDEN_PUBLIC_TEMPLATES = Object.freeze(
  Object.keys(GOLDEN_TEMPLATES).filter((template) => !template.startsWith('/o/')),
);

/**
 * Τα εφήμερα μυστικά που χρειάζεται η εικόνα για να κόψει τα tokens της βαθμίδας `api`.
 * Ονόματα από το `src/config/environment-contract.ts` (άγκυρα Γ7). Το workflow τα
 * γεννά **ανά run** (`openssl rand` + `::add-mask::`): κανένα μυστικό παραγωγής (ADR-788).
 */
const GOLDEN_EPHEMERAL_SECRETS = Object.freeze(['ATTENDANCE_QR_SECRET']);

/**
 * Οι τιμές της βαθμίδας `value` — μέλη κλειστού συνόλου τύπων (άγκυρα Γ2β: το
 * `profit_and_loss` ΕΙΝΑΙ μέλος του `ReportType`, `src/subapps/accounting/types/reports.ts` ·
 * άγκυρα Γ2γ: το `municipality:4501`, Δήμος Αθηναίων, ΥΠΑΡΧΕΙ στο ευρετήριο περιοχών της εικόνας
 * και έχει σελίδα αγοράς · άγκυρα Γ2ζ: η έκδοση `1` ΥΠΑΡΧΕΙ για ΚΑΘΕ νομικό έγγραφο του μητρώου
 * · άγκυρα Γ2η: το ψευδώνυμο = `COMPANY_ALIAS` του σπορέα personas).
 */
const GOLDEN_VALUES = Object.freeze({
  reportType: 'profit_and_loss',
  area: 'municipality:4501',
  legalVersion: '1',
  agencyAlias: 'alpha-techniki',
});

/** Η σταθερή ταυτότητα ενός τμήματος με golden id — ποτέ το ίδιο το id (αλλάζει ανά run). */
function goldenSegment(entity) {
  return `golden-${entity}`;
}

module.exports = {
  GOLDEN_TIERS,
  GOLDEN_ENTITIES,
  GOLDEN_TEMPLATES,
  GOLDEN_PUBLIC_TEMPLATES,
  GOLDEN_UNBOUND,
  UNBOUND_REASONS,
  GOLDEN_EPHEMERAL_SECRETS,
  GOLDEN_VALUES,
  goldenSegment,
};
