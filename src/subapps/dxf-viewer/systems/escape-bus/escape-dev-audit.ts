/**
 * ADR-364 §10.6 Φ2 — Dev-time ESC audit (Μηχανισμός 1)
 *
 * Ο φθηνότερος ανιχνευτής παρακάμψεων: δεν διαβάζει κώδικα, διαβάζει **συμβάντα**.
 * Ενεργός μόνο εκτός production· μηδέν κόστος στο τελικό bundle πέρα από ένα
 * listener που κάνει early-return σε κάθε πλήκτρο εκτός Escape.
 *
 * ── ΓΙΑΤΙ ΣΕΝΤΙΝΕΛΑ ΚΑΙ ΟΧΙ ΣΚΕΤΟΣ ΕΛΕΓΧΟΣ `defaultPrevented` ΜΕΣΑ ΣΤΟΝ BUS ──
 *
 * Το §10.6 πρότεινε «ο bus βλέπει ESC που ήρθε ήδη defaultPrevented». Αυτό πιάνει
 * **μόνο** ανταγωνιστές που (α) τρέχουν ΠΡΙΝ τον bus **και** (β) καλούν
 * preventDefault. Δύο τυφλά σημεία, και τα δύο μετρημένα σε αυτό το δέντρο:
 *
 *   1. Ο bus ΔΕΝ είναι εγγυημένα πρώτος. Οι listeners του ίδιου κόμβου (`window`,
 *      capture) τρέχουν με **σειρά εγγραφής** — δηλαδή σειρά mount, που εξαρτάται
 *      από το δέντρο των components. Ανταγωνιστής που εγγράφεται ΜΕΤΑ τον bus
 *      είναι αόρατος σε έλεγχο κατά την είσοδο.
 *   2. Ανταγωνιστής που καλεί `stopImmediatePropagation()` ΠΡΙΝ τον bus τον
 *      **λιμοκτονεί**: ο bus δεν καλείται καθόλου, άρα δεν μπορεί να ελέγξει
 *      τίποτα. Υπαρκτός κίνδυνος — το `useCanvasKeyboardShortcuts.ts:145` ήδη το
 *      καλεί στη διαδρομή hot-grip.
 *
 * Η σεντινέλα εγκαθίσταται σε **χρόνο import** — πριν τρέξει οποιοδήποτε effect
 * component, άρα πρώτη στη σειρά των window-capture listeners. Βλέπει το ESC
 * ΠΑΝΤΑ, ακόμα κι όταν ο bus λιμοκτονεί, και κρίνει μετά το πέρας της διάδοσης.
 *
 * ── ΤΙ ΔΕΝ ΒΛΕΠΕΙ (ρητά — «0 ευρήματα» δεν σημαίνει «καθαρό») ──
 *
 * Ανταγωνιστή που δεν καλεί **ούτε** `preventDefault` **ούτε**
 * `stopImmediatePropagation` — ενεργεί σιωπηλά και το DOM δεν κρατά ίχνος.
 * Μετρημένα παραδείγματα: `ui/color/eyedropper.ts:132`,
 * `ui/toolbar/ZoomControls.tsx:82`, `hooks/tools/useZoomWindowTool.ts:70`.
 * Αυτούς τους πιάνει **μόνο** ο στατικός ratchet (Μηχανισμός 3) — οι δύο
 * μηχανισμοί είναι **συμπληρωματικοί, όχι εναλλακτικοί**.
 */

import type { EscapeDispatchResult } from './types';

const AUDIT_ENABLED = process.env.NODE_ENV !== 'production';

/** Τι κατέγραψε η σεντινέλα για ΕΝΑ φυσικό πάτημα ESC. */
interface EscapeAuditRecord {
  /** Ο bus κλήθηκε καθόλου για αυτό το συμβάν; */
  busDispatched: boolean;
  /** Είχε ήδη καταναλωθεί πριν φτάσει στον bus; */
  preemptedAtEntry: boolean;
  /** Ποιος handler του bus κατανάλωσε — `null` αν κανείς. */
  consumedBy: string | null;
  /**
   * ADR-364 §10.15 — ο **δηλωμένος** τοπικός ιδιοκτήτης (Κ3), αν υπάρχει.
   * Βλ. {@link noteLocalEscapeOwner} για το γιατί δεν αρκεί το `consumedBy`.
   */
  localOwner: string | null;
  /** Πού βρισκόταν η εστίαση τη στιγμή του πατήματος (διαγνωστικό). */
  focusAt: string;
}

export type EscapeAuditVerdict = 'ok' | 'starved' | 'preempted' | 'shadow-owner';

/** Ένα εύρημα, όπως το επιστρέφει ο έλεγχος — εκτεθειμένο για τα tests. */
export interface EscapeAuditFinding {
  readonly verdict: EscapeAuditVerdict;
  readonly record: Readonly<EscapeAuditRecord>;
}

const records = new WeakMap<KeyboardEvent, EscapeAuditRecord>();
let sentinelInstalled = false;
let lastFinding: EscapeAuditFinding | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function describeFocus(): string {
  const el = isBrowser() ? document.activeElement : null;
  if (!el) return '<none>';
  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList.length > 0 ? `.${Array.from(el.classList).join('.')}` : '';
  return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 120);
}

/**
 * Το κριτήριο. Τρέχει ΜΕΤΑ το πέρας της διάδοσης του συμβάντος, οπότε το
 * `defaultPrevented` έχει την τελική του τιμή — αυτό είναι όλο το νόημα.
 */
function judge(e: KeyboardEvent, rec: EscapeAuditRecord): EscapeAuditVerdict {
  if (!rec.busDispatched) return 'starved';
  if (rec.preemptedAtEntry) return 'preempted';
  // ADR-364 §10.15 — δηλωμένος Κ3: ιδιοκτήτης εντός SSoT, απλώς όχι slot του bus.
  if (rec.localOwner !== null) return 'ok';
  if (rec.consumedBy === null && e.defaultPrevented) return 'shadow-owner';
  return 'ok';
}

const EXPLAIN: Readonly<Record<Exclude<EscapeAuditVerdict, 'ok'>, string>> = {
  starved:
    'Ο bus ΔΕΝ κλήθηκε καθόλου. Κάποιος window-capture listener εγγεγραμμένος ΠΡΙΝ ' +
    'από αυτόν κάλεσε stopImmediatePropagation(). Ο πίνακας ESC_PRIORITY είναι ' +
    'ανενεργός για αυτό το πάτημα.',
  preempted:
    'Το ESC είχε ήδη καταναλωθεί πριν φτάσει στον bus (window-capture listener με ' +
    'νωρίτερο mount). Ό,τι αποφάσισε ο bus είναι ΔΕΥΤΕΡΗ ενέργεια στο ίδιο πάτημα.',
  'shadow-owner':
    'Κανένας handler του bus δεν διεκδίκησε το ESC, αλλά κάποιος άλλος το ' +
    'κατανάλωσε. Υπάρχει ιδιοκτήτης ESC εκτός του SSoT — ανήκει σε slot του ' +
    'ESC_PRIORITY (ADR-364 §10.2).',
};

/** Ποιος κατανάλωσε — slot του bus ή δηλωμένος τοπικός Κ3. */
function describeOwner(rec: EscapeAuditRecord): string | null {
  if (rec.consumedBy !== null) return rec.consumedBy;
  return rec.localOwner === null ? null : `local:${rec.localOwner}`;
}

/**
 * Πόσα ευρήματα κρατά το δακτυλιωτό ιστορικό του {@link exposeAuditToDevConsole}.
 * Αρκετά για μια χειροκίνητη σκάλα ESC· αμελητέο σε μνήμη.
 */
const AUDIT_HISTORY_LIMIT = 20;
const auditHistory: EscapeAuditFinding[] = [];

/**
 * ADR-364 §10.13 — ΓΙΑΤΙ Ο ΕΛΕΓΧΟΣ ΕΙΝΑΙ ΑΝΑΓΝΩΣΙΜΟΣ ΚΑΙ ΣΤΟ `ok`.
 *
 * Το {@link report} κάνει early-return στο `ok`, άρα **η σιωπή της κονσόλας δεν είναι
 * απόδειξη ορθότητας** — μπορεί να σημαίνει «όλα καλά» ή «η σεντινέλα δεν είδε τίποτα».
 * Κάθε ζωντανή μέτρηση της Φ2 χρειάστηκε να στήσει χειροκίνητο θετικό control πριν
 * πιστέψει οτιδήποτε (§10.11.Α, §5 του handoff).
 *
 * Το `window.__escapeAudit` λύνει αυτό ακριβώς: dev-only, read-only, μηδέν κόστος σε
 * production (ο κώδικας δεν καλείται καν), και δίνει το `consumedBy` — δηλαδή **ΠΟΙΟ
 * slot** κατανάλωσε, που είναι το μόνο πράγμα που δεν μπορεί να συναχθεί από έξω, αφού
 * ο Μηχ. 2 κόβει πλέον κάθε παρατηρητή κατάντη.
 *
 *   window.__escapeAudit.last()     → το τελευταίο εύρημα (και στο `ok`)
 *   window.__escapeAudit.history()  → τα τελευταία 20, παλαιότερο πρώτο
 *   window.__escapeAudit.clear()    → μηδενισμός ιστορικού πριν από ένα σενάριο
 */
function exposeAuditToDevConsole(): void {
  if (!AUDIT_ENABLED || !isBrowser()) return;
  (window as unknown as Record<string, unknown>).__escapeAudit = {
    last: (): EscapeAuditFinding | null => lastFinding,
    history: (): readonly EscapeAuditFinding[] => [...auditHistory],
    clear: (): void => { auditHistory.length = 0; lastFinding = null; },
  };
}

function report(finding: EscapeAuditFinding): void {
  const { verdict, record } = finding;
  auditHistory.push(finding);
  if (auditHistory.length > AUDIT_HISTORY_LIMIT) auditHistory.shift();
  if (verdict === 'ok') return;
  console.error(
    `[EscapeBus/audit] ${verdict.toUpperCase()} — ${EXPLAIN[verdict]}`,
    { focusAt: record.focusAt, consumedBy: describeOwner(record) },
  );
}

/**
 * ADR-364 §10.15 — ΔΗΛΩΣΗ ΤΟΠΙΚΟΥ ΙΔΙΟΚΤΗΤΗ ESC (κατηγορία Κ3 του §10.5).
 *
 * ── ΤΟ ΠΡΟΒΛΗΜΑ ──
 *
 * Το {@link judge} έκρινε `shadow-owner` κάθε ESC που καταναλώθηκε χωρίς slot του bus.
 * Αλλά το §10.5 **θεσμοθετεί** τον Κ3: τοπικός `onKeyDown` πάνω στο ίδιο το στοιχείο
 * που κατέχει το πλήκτρο (π.χ. η λίστα @-mention μέσα στο textarea των σχολίων). Ο
 * νόμιμος αυτός ιδιοκτήτης τύπωνε `console.error` σε **κάθε** χρήση — θόρυβος που
 * εκπαιδεύει στην αγνόηση του Μηχ. 1, δηλαδή υπονομεύει το ίδιο το ADR-364.
 *
 * ── ΓΙΑΤΙ ΔΗΛΩΣΗ ΚΑΙ ΟΧΙ ΣΙΩΠΗ ──
 *
 * Η φθηνή «διόρθωση» θα ήταν να μη κρίνεται shadow-owner όταν το focus είναι σε πεδίο
 * κειμένου. Αυτό θα ευλογούσε **σιωπηλά** και κάθε ωμό, αδήλωτο ιδιοκτήτη στην ίδια
 * κατάσταση — δηλαδή θα τύφλωνε τον έλεγχο εκεί ακριβώς όπου τον χρειάζεσαι. Εδώ ο
 * Κ3 γίνεται **ορατός**: το εύρημα αναφέρει `local:<id>` και ο αδήλωτος εξακολουθεί
 * να βγαίνει `shadow-owner`.
 *
 * @param e Το **εγγενές** συμβάν. Από React: `event.nativeEvent` — είναι το ίδιο
 *          αντικείμενο που είδε η σεντινέλα, άρα η αναζήτηση στο WeakMap πετυχαίνει.
 * @param id Σταθερό αναγνωριστικό ιδιοκτήτη, ίδια σύμβαση με τα `EscapeHandler.id`.
 */
export function noteLocalEscapeOwner(e: KeyboardEvent, id: string): void {
  if (!AUDIT_ENABLED) return;
  const rec = records.get(e);
  if (!rec) return; // Συνθετικό συμβάν ή ESC που η σεντινέλα δεν είδε.
  rec.localOwner = id;
}

/**
 * Καλείται από τον bus σε κάθε dispatch ESC.
 * @param preemptedAtEntry `e.defaultPrevented` όπως διαβάστηκε ΠΡΙΝ τρέξει η αλυσίδα.
 */
export function noteBusDispatch(
  e: KeyboardEvent,
  result: EscapeDispatchResult,
  preemptedAtEntry: boolean,
): void {
  if (!AUDIT_ENABLED) return;
  const rec = records.get(e);
  if (!rec) return; // Συνθετικό συμβάν από tests — η σεντινέλα δεν το είδε.
  rec.busDispatched = true;
  rec.preemptedAtEntry = preemptedAtEntry;
  rec.consumedBy = result.consumedBy;
}

function onSentinelKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  const rec: EscapeAuditRecord = {
    busDispatched: false,
    preemptedAtEntry: false,
    consumedBy: null,
    localOwner: null,
    focusAt: describeFocus(),
  };
  records.set(e, rec);
  // setTimeout, ΟΧΙ queueMicrotask: ο microtask checkpoint τρέχει ΑΝΑΜΕΣΑ στους
  // listeners, άρα θα έκρινε πριν προλάβουν να μιλήσουν οι υπόλοιποι.
  window.setTimeout(() => {
    const finding: EscapeAuditFinding = { verdict: judge(e, rec), record: rec };
    lastFinding = finding;
    report(finding);
  }, 0);
}

/**
 * Εγκατάσταση σε χρόνο import — ΠΡΩΤΗ στη σειρά των window-capture listeners.
 * Ιδempotent· no-op σε production και σε SSR.
 */
export function installEscapeAuditSentinel(): void {
  if (!AUDIT_ENABLED || sentinelInstalled || !isBrowser()) return;
  window.addEventListener('keydown', onSentinelKeyDown, { capture: true });
  exposeAuditToDevConsole();
  sentinelInstalled = true;
}

// Το τελευταίο εύρημα ΔΕΝ εκτίθεται ως named export: ο κανονικός του δρόμος
// είναι το dev-console API (`exposeAuditToDevConsole().last()`). Τα tests
// κρίνουν σύγχρονα μέσω __judgeForTests και δεν περνούν από το lastFinding.

/** Test-only — καθαρισμός κατάστασης μεταξύ tests. */
export function __resetAuditForTests(): void {
  lastFinding = null;
  auditHistory.length = 0;
  if (sentinelInstalled && isBrowser()) {
    window.removeEventListener('keydown', onSentinelKeyDown, { capture: true });
    sentinelInstalled = false;
  }
}

/** Test-only — άμεση κρίση χωρίς αναμονή του setTimeout. */
export function __judgeForTests(
  e: KeyboardEvent,
): EscapeAuditFinding | null {
  const rec = records.get(e);
  if (!rec) return null;
  return { verdict: judge(e, rec), record: rec };
}
