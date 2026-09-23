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
 *   • `value`   — δεν είναι οντότητα: μία τιμή από κλειστό σύνολο (`[type]`).
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
  vendorToken: { tier: GOLDEN_TIERS.API, prefix: null },
  attendanceToken: { tier: GOLDEN_TIERS.API, prefix: null },
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
  reportType: { tier: GOLDEN_TIERS.VALUE, prefix: null },
});

/**
 * Πρότυπο διαδρομής → οντότητες, **θεσιακά** ανά δυναμικό τμήμα (πλην του `[workspace]`).
 * Κλειστό σύνολο: η άγκυρα Γ1 απαιτεί να είναι ΑΚΡΙΒΩΣ τα δυναμικά πρότυπα `/o` του
 * `enumerateRoutes` **συν** τις δημόσιες πόρτες του {@link GOLDEN_PUBLIC_TEMPLATES} —
 * ούτε ένα λιγότερο (άκριτο), ούτε ένα περισσότερο (μπαγιάτικο).
 */
const GOLDEN_TEMPLATES = Object.freeze({
  '/o/[workspace]/accounting/invoices/[id]/edit': ['invoice'],
  '/o/[workspace]/accounting/reports/[type]': ['reportType'],
  '/o/[workspace]/buildings/[id]': ['building'],
  '/o/[workspace]/contacts/[id]': ['contact'],
  '/o/[workspace]/crm/leads/[id]': ['lead'],
  '/o/[workspace]/crm/tasks/[taskId]': ['task'],
  '/o/[workspace]/listings/mandates/[ownerPropertyId]': ['ownerProperty'],
  '/o/[workspace]/obligations/[id]/edit': ['obligation'],
  '/o/[workspace]/parking/[id]': ['parking'],
  '/o/[workspace]/procurement/purchase-orders/[id]': ['purchaseOrder'],
  '/o/[workspace]/procurement/quotes/[id]/review': ['quote'],
  '/o/[workspace]/procurement/rfqs/[id]': ['rfq'],
  '/o/[workspace]/projects/[id]': ['project'],
  '/o/[workspace]/projects/[id]/procurement': ['project'],
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
  '/vendor/quote/[token]': ['vendorToken'],
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
const GOLDEN_EPHEMERAL_SECRETS = Object.freeze(['VENDOR_PORTAL_SECRET', 'ATTENDANCE_QR_SECRET']);

/**
 * Οι τιμές της βαθμίδας `value` — μέλη κλειστού συνόλου τύπων (άγκυρα Γ2β: το
 * `profit_and_loss` ΕΙΝΑΙ μέλος του `ReportType`, `src/subapps/accounting/types/reports.ts`).
 */
const GOLDEN_VALUES = Object.freeze({ reportType: 'profit_and_loss' });

/** Η σταθερή ταυτότητα ενός τμήματος με golden id — ποτέ το ίδιο το id (αλλάζει ανά run). */
function goldenSegment(entity) {
  return `golden-${entity}`;
}

module.exports = {
  GOLDEN_TIERS,
  GOLDEN_ENTITIES,
  GOLDEN_TEMPLATES,
  GOLDEN_PUBLIC_TEMPLATES,
  GOLDEN_EPHEMERAL_SECRETS,
  GOLDEN_VALUES,
  goldenSegment,
};
