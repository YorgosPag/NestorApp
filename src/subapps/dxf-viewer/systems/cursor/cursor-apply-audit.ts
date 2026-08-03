/**
 * 🔬 ADR-739 §31.11 — **ΤΟ ΟΡΓΑΝΟ**: ποιος γράφει τον δείκτη του ΟΣ, πότε, με τι, και γιατί.
 *
 * ## Γιατί χρειάστηκε νέο όργανο
 * Ο ιδιοκτήτης ανέφερε (2026-08-03): «ο κέρσορας τρεμοπαίζει και όταν σταματώ εξαφανίζεται».
 * Δύο διαδοχικές αναγνώσεις του κώδικα **απέκλεισαν** τις προφανείς αιτίες αντί να τις
 * επιβεβαιώσουν, και αυτό ακριβώς είναι το σχήμα όπου η εικασία κοστίζει περισσότερο από τη
 * μέτρηση:
 *
 *  1. Το `TableIndicatorCursorStore` δηλώνει `equals: Object.is` και ο πυρήνας
 *     `createExternalStore.set` κάνει bail χωρίς notify ⇒ κίνηση **μέσα** στο ίδιο γράμμα
 *     **δεν** μπορεί να καλέσει `apply()`. Η υπόθεση «ξαναχτίζει PNG σε κάθε κίνηση» έπεσε.
 *  2. Ο ιδιοκτήτης μέτρησε στην οθόνη ότι το **σκέτο σταυρόνημα δεν τρεμοπαίζει**. Αν κάποιος
 *     τρίτος συνδρομητής (π.χ. το always-notify `gripStyleStore`) καλούσε `apply()` 60 φορές
 *     το δευτερόλεπτο, θα τρεμόπαιζε **και** το σταυρόνημα με τον ίδιο τρόπο. Έπεσε κι αυτή.
 *
 * Απομένει: **ταλαντώνεται ο ρόλος** — δηλαδή η ίδια περιοχή της λωρίδας δίνει διαφορετική
 * απάντηση σε διαδοχικές κινήσεις. Ποια απάντηση, από ποιον δρόμο, και σε ποια συντεταγμένη,
 * **δεν** το λέει ο κώδικας· το λέει μόνο η καταγραφή.
 *
 * ## 🔴 Η ερώτηση που πρέπει να απαντήσει, διατυπωμένη πριν γραφτεί
 * *«Όταν το χέρι στέκεται ακίνητο και ο δείκτης εξαφανίζεται, ποια ήταν η ΤΕΛΕΥΤΑΙΑ εγγραφή
 * και με ποιον λόγο;»* Γι' αυτό καταγράφονται **και οι καθαρισμοί με τον λόγο τους**
 * (`no-entity` / `no-world` / `leave`) και όχι μόνο οι επιτυχείς σαρώσεις: ένα σιωπηλό
 * `clearTableIndicatorFeedback()` είναι ακριβώς το είδος γεγονότος που δεν αφήνει ίχνος.
 *
 * ## Γιατί καταγράφει **δύο** επίπεδα και όχι ένα
 * Η σάρωση (`probe`) είναι η **αιτία**, η εγγραφή στο `style.cursor` (`apply`) το
 * **αποτέλεσμα**. Με μόνο το δεύτερο δεν ξεχωρίζεις «ο ρόλος άλλαξε» από «ο ρόλος έμεινε αλλά
 * κάποιος άλλος ξαναέγραψε» — και οι δύο διαγνώσεις οδηγούν σε **διαφορετική** θεραπεία.
 *
 * ## Μηδενικό κόστος όταν είναι σβηστό — και είναι απαίτηση, όχι ευγένεια
 * Ο `probe` τρέχει σε **κάθε** κίνηση ποντικιού πάνω από τον καμβά. Γι' αυτό η υπογραφή δέχεται
 * **θέσιμα πρωτογενή ορίσματα** και όχι αντικείμενο επιλογών: ένα `note({ ... })` θα κατένειμε
 * αντικείμενο στο σημείο κλήσης **πριν** προλάβει να τρέξει ο έλεγχος «είμαι ανοιχτό;».
 * Το `hit` περνά ως **η ίδια αναφορά** που ήδη υπάρχει και μορφοποιείται μόνο μέσα στον φρουρό.
 *
 * ## USAGE (κονσόλα browser)
 * ```js
 *   window.__cursorAudit.on()      // ξεκίνα καταγραφή (δακτύλιος 600 εγγραφών)
 *   // …κούνα το χέρι πάνω στη λωρίδα ως το τρεμόπαιγμα, ΜΕΤΑ σταμάτα το χέρι…
 *   window.__cursorAudit.dump()    // κείμενο για αντιγραφή
 *   window.__cursorAudit.download()// το ίδιο κείμενο ως .txt
 *   window.__cursorAudit.off()
 * ```
 *
 * @module subapps/dxf-viewer/systems/cursor/cursor-apply-audit
 * @see systems/cursor/useCrosshairCursor.ts — ο ΕΝΑΣ γραφέας του `style.cursor` (πηγή των `apply`)
 * @see ui/table-cell-editor/use-table-indicator-hover.ts — ο ΕΝΑΣ ακροατής κίνησης (πηγή των `probe`)
 * @see bim-3d/scene/bim3d-perf-diag.ts — το μοτίβο (`window.__bim3dPerf`)
 * @see bim-3d/systems/section/clip-scope-guard.ts — το μοτίβο δακτυλίου + αναφοράς
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §31
 */

import { nowISO } from '@/lib/date-local';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import type { TableIndicatorCursorRole } from '../../bim/table/table-indicator-cursor-role';
import type { TableIndicatorHit } from '../../bim/table/table-indicator-geometry';

/** Ποιον κλάδο του `apply()` πήρε η εγγραφή — η **σειρά προτεραιότητας** του §31.3(α). */
export type CursorApplyBranch = 'navwheel' | 'table' | 'crosshair-off' | 'crosshair';

/**
 * Γιατί ο ακροατής κίνησης κατέληξε σε αυτή την απάντηση.
 *
 * Τα τρία «μη-`ok`» είναι τα σημεία όπου ο δείκτης **σβήνει σιωπηλά**. Αν το τελευταίο
 * συμβάν πριν την εξαφάνιση είναι ένα από αυτά, η διάγνωση τελείωσε εκεί.
 */
export type CursorProbeReason = 'ok' | 'no-entity' | 'no-world' | 'leave';

/** Μία εγγραφή του δακτυλίου. Αμετάβλητη — ο καλών δεν μπορεί να τη μολύνει. */
export interface CursorAuditRecord {
  readonly kind: 'probe' | 'apply';
  /** `performance.now()` τη στιγμή του συμβάντος. */
  readonly atMs: number;
  /** Μόνο για `apply`. */
  readonly branch: CursorApplyBranch | null;
  /** Μόνο για `probe`. */
  readonly reason: CursorProbeReason | null;
  readonly role: TableIndicatorCursorRole | null;
  /** Ποια υποδιαίρεση φωτίστηκε (§30) — `'-'` όταν καμία. */
  readonly hit: string;
  /** Συντεταγμένες συμβάντος· `-1` όταν δεν υπάρχει συμβάν (οι `apply`). */
  readonly x: number;
  readonly y: number;
  /** Ταυτότητα της τιμής `cursor` — δες {@link fingerprintCursorValue}. */
  readonly fingerprint: string;
  readonly dpr: number;
}

/**
 * Πόσες εγγραφές κρατά ο δακτύλιος. Στα ~60 συμβάντα/δευτ. καλύπτει **δέκα δευτερόλεπτα**
 * συνεχούς κίνησης — αρκετά για ένα τρεμόπαιγμα **και** τη σιωπή που το ακολουθεί.
 */
const MAX_RECORDS = 600;

const records: CursorAuditRecord[] = [];
let enabled = false;

/**
 * Ταυτότητα μιας τιμής `cursor`, χωρίς τα ~2 KB του data-URL.
 *
 * 🔑 **Ο λόγος ύπαρξης**: το τεκμηριωμένο flicker των custom cursors προϋποθέτει ότι ο browser
 * βλέπει **νέα** εικόνα. Ίδιο σχήμα ⇒ ίδιο base64 ⇒ ίδιο URL ⇒ cache hit ⇒ κανένα flicker.
 * Άρα η ερώτηση «είναι η ίδια συμβολοσειρά κάθε φορά;» **είναι** η διάγνωση, και απαντιέται
 * μόνο με σταθερή αποτύπωση. Οι λέξεις-κλειδιά (`col-resize`, `none`, `default`) περνούν
 * αυτούσιες: εκεί δεν υπάρχει εικόνα να ταυτοποιηθεί.
 */
export function fingerprintCursorValue(value: string): string {
  if (!value.startsWith('url(') && !value.startsWith('image-set(')) return value;
  // djb2 — φθηνό, σταθερό, και αρκετά διακριτικό για να ξεχωρίσει δύο ράστερ. Δεν είναι
  // κρυπτογραφικό και δεν χρειάζεται να είναι: συγκρίνουμε με τον εαυτό του, όχι με τον κόσμο.
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  const kind = value.startsWith('image-set(') ? 'set' : 'url';
  return `${kind}:${value.length}:${(hash >>> 0).toString(16)}`;
}

/** Η υποδιαίρεση ως σταθερό κείμενο. Μορφοποιείται **μέσα** στον φρουρό — δες την κεφαλίδα. */
function formatHit(hit: TableIndicatorHit | null): string {
  if (!hit) return '-';
  return hit.axis === 'column' ? `col#${hit.index}` : `row#${hit.index}`;
}

/** Προσθήκη με κόψιμο του παλαιότερου. Ο δακτύλιος δεν μεγαλώνει ποτέ. */
function push(record: CursorAuditRecord): void {
  records.push(record);
  if (records.length > MAX_RECORDS) records.shift();
}

/**
 * 🔴 Καταγραφή **σάρωσης** — καλείται από τον ΕΝΑ ακροατή κίνησης της λειτουργίας πίνακα.
 *
 * Πρώτη γραμμή ο φρουρός: όταν το όργανο είναι σβηστό, το κόστος είναι μία σύγκριση boolean.
 * Κανένα όρισμα δεν κατανέμει μνήμη στο σημείο κλήσης (δες την κεφαλίδα).
 */
export function noteCursorProbe(
  reason: CursorProbeReason,
  role: TableIndicatorCursorRole | null,
  hit: TableIndicatorHit | null,
  x: number,
  y: number,
): void {
  if (!enabled) return;
  push({
    kind: 'probe',
    atMs: typeof performance !== 'undefined' ? performance.now() : 0,
    branch: null,
    reason,
    role,
    hit: formatHit(hit),
    x: Math.round(x),
    y: Math.round(y),
    fingerprint: '-',
    dpr: 0,
  });
}

/**
 * 🔴 Καταγραφή **εγγραφής στο `style.cursor`** — καλείται από τον ΕΝΑ γραφέα (`apply()`).
 *
 * Η τιμή περνά ολόκληρη γιατί **έχει ήδη υπολογιστεί** από τον καλούντα· η συρρίκνωσή της σε
 * αποτύπωμα γίνεται μέσα στον φρουρό, ώστε το σβηστό όργανο να μη διαβάσει ούτε ένα byte της.
 */
export function noteCursorApply(
  branch: CursorApplyBranch,
  role: TableIndicatorCursorRole | null,
  value: string,
  dpr: number,
): void {
  if (!enabled) return;
  push({
    kind: 'apply',
    atMs: typeof performance !== 'undefined' ? performance.now() : 0,
    branch,
    reason: null,
    role,
    hit: '-',
    x: -1,
    y: -1,
    fingerprint: fingerprintCursorValue(value),
    dpr,
  });
}

/** Οι εγγραφές (αντίγραφο). */
export function getCursorAuditRecords(): readonly CursorAuditRecord[] {
  return [...records];
}

/** Ανοιχτό/κλειστό. Το άνοιγμα **μηδενίζει**: μια μέτρηση αρχίζει από καθαρό δακτύλιο. */
export function setCursorAuditEnabled(next: boolean): void {
  if (next) records.length = 0;
  enabled = next;
}

/** Είναι ανοιχτό; (για tests και για την κεφαλίδα της αναφοράς). */
export function isCursorAuditEnabled(): boolean {
  return enabled;
}

/** Μηδενισμός δακτυλίου **χωρίς** να αλλάξει η κατάσταση ανοιχτό/κλειστό. */
export function resetCursorAudit(): void {
  records.length = 0;
}

/** Test helper — πλήρης επαναφορά μεταξύ tests, ίδιο μοτίβο με τα stores. */
export function __resetCursorAuditForTests(): void {
  records.length = 0;
  enabled = false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Η αναφορά
// ──────────────────────────────────────────────────────────────────────────────

/** Ένα «τρέξιμο» ίδιων διαδοχικών απαντήσεων — η **συμπίεση** που κάνει ορατό το τρεμόπαιγμα. */
interface AuditRun {
  readonly key: string;
  count: number;
  readonly fromMs: number;
  toMs: number;
}

/**
 * Συμπίεση διαδοχικών ίδιων απαντήσεων σε «τρεξίματα».
 *
 * 🔑 Εδώ ζει όλη η αξία της αναφοράς: 300 σειρές ωμών εγγραφών δεν διαβάζονται, ενώ
 * `column-select ×14 → (no-world) ×1 → column-select ×9 → …` δείχνει **αμέσως** αν
 * παρεμβάλλεται ξένη απάντηση, πόσο συχνά, και ποια είναι η **τελευταία**.
 */
function collapse(rows: readonly CursorAuditRecord[], keyOf: (r: CursorAuditRecord) => string): AuditRun[] {
  const runs: AuditRun[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    const last = runs[runs.length - 1];
    if (last && last.key === key) {
      last.count++;
      last.toMs = row.atMs;
      continue;
    }
    runs.push({ key, count: 1, fromMs: row.atMs, toMs: row.atMs });
  }
  return runs;
}

/** Το κλειδί μιας σάρωσης: ο λόγος όταν απέτυχε, αλλιώς ο ρόλος. */
function probeKey(row: CursorAuditRecord): string {
  if (row.reason !== 'ok') return `(${row.reason})`;
  return row.role ?? 'null';
}

/** Το κλειδί μιας εγγραφής: κλάδος + αποτύπωμα — δύο ίδια αποτυπώματα = καμία νέα εικόνα. */
function applyKey(row: CursorAuditRecord): string {
  return `${row.branch}/${row.fingerprint}`;
}

function formatRuns(title: string, runs: readonly AuditRun[]): string {
  if (runs.length === 0) return `${title}\n  (καμία εγγραφή)`;
  const body = runs
    .map((run) => `  ${run.key} ×${run.count}  [+${(run.fromMs / 1000).toFixed(2)}s → +${(run.toMs / 1000).toFixed(2)}s]`)
    .join('\n');
  return `${title}  — ${runs.length} μεταβάσεις\n${body}`;
}

/** Οι τελευταίες ωμές σειρές — για την περίπτωση που η συμπίεση κρύψει κάτι. */
function formatTail(rows: readonly CursorAuditRecord[], count: number): string {
  const tail = rows.slice(-count);
  const body = tail
    .map((r) => r.kind === 'probe'
      ? `  +${(r.atMs / 1000).toFixed(3)}s probe ${r.reason} role=${r.role ?? 'null'} hit=${r.hit} @${r.x},${r.y}`
      : `  +${(r.atMs / 1000).toFixed(3)}s apply ${r.branch} role=${r.role ?? 'null'} dpr=${r.dpr} ${r.fingerprint}`)
    .join('\n');
  return `ΤΕΛΕΥΤΑΙΕΣ ${tail.length} ΩΜΕΣ ΕΓΓΡΑΦΕΣ (η τελευταία είναι αυτή που «έμεινε στην οθόνη»)\n${body}`;
}

/** Πόσα **διαφορετικά** ράστερ είδε ο browser — η απάντηση στο «ξαναφορτώνει εικόνα;». */
function formatFingerprints(rows: readonly CursorAuditRecord[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== 'apply') continue;
    counts.set(row.fingerprint, (counts.get(row.fingerprint) ?? 0) + 1);
  }
  if (counts.size === 0) return 'ΔΙΑΚΡΙΤΑ ΑΠΟΤΥΠΩΜΑΤΑ: (καμία εγγραφή)';
  const body = [...counts.entries()].map(([fp, n]) => `  ${fp}  ×${n}`).join('\n');
  return `ΔΙΑΚΡΙΤΑ ΑΠΟΤΥΠΩΜΑΤΑ: ${counts.size}\n${body}`;
}

/** Το κείμενο της αναφοράς — ίδιο για `dump()` και `download()`, ώστε να μην αποκλίνουν. */
export function buildCursorAuditReport(): string {
  const rows = getCursorAuditRecords();
  const probes = rows.filter((r) => r.kind === 'probe');
  const applies = rows.filter((r) => r.kind === 'apply');
  const header = [
    `=== ADR-739 §31 — ΕΛΕΓΧΟΣ ΔΕΙΚΤΗ — ${nowISO()} ===`,
    `κατάσταση: ${enabled ? 'ΑΝΟΙΧΤΟ' : 'ΚΛΕΙΣΤΟ'} · εγγραφές: ${rows.length}/${MAX_RECORDS}` +
    ` (σαρώσεις ${probes.length} · εγγραφές δείκτη ${applies.length})`,
  ].join('\n');
  if (rows.length === 0) {
    return `${header}\n\n(κενό — τρέξε window.__cursorAudit.on() και κούνα το χέρι πάνω στη λωρίδα)`;
  }
  return [
    header,
    '',
    formatRuns('ΣΑΡΩΣΕΙΣ (η ΑΙΤΙΑ)', collapse(probes, probeKey)),
    '',
    formatRuns('ΕΓΓΡΑΦΕΣ ΔΕΙΚΤΗ (το ΑΠΟΤΕΛΕΣΜΑ)', collapse(applies, applyKey)),
    '',
    formatFingerprints(rows),
    '',
    formatTail(rows, 25),
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Χειριστήριο κονσόλας — ίδιο μοτίβο με `__bim3dPerf` / `__bim3dClipGuard`
// ──────────────────────────────────────────────────────────────────────────────

/** Το σχήμα που εκτίθεται στο `window`. */
export interface CursorAuditConsole {
  on(): void;
  off(): void;
  records(): readonly CursorAuditRecord[];
  dump(): void;
  download(): void;
  reset(): void;
}

function createConsoleHandle(): CursorAuditConsole {
  return {
    on() {
      setCursorAuditEnabled(true);
      // eslint-disable-next-line no-console -- διαγνωστικό χειριστήριο κονσόλας
      console.log('[ADR-739 §31] έλεγχος δείκτη ΑΝΟΙΧΤΟΣ — κούνα το χέρι, μετά .dump()');
    },
    off() {
      setCursorAuditEnabled(false);
      // eslint-disable-next-line no-console -- διαγνωστικό χειριστήριο κονσόλας
      console.log('[ADR-739 §31] έλεγχος δείκτη ΚΛΕΙΣΤΟΣ');
    },
    records: getCursorAuditRecords,
    dump() {
      // eslint-disable-next-line no-console -- διαγνωστικό χειριστήριο κονσόλας
      console.log(buildCursorAuditReport());
    },
    download() {
      const text = buildCursorAuditReport();
      if (typeof document === 'undefined') {
        // eslint-disable-next-line no-console -- διαγνωστικό χειριστήριο κονσόλας
        console.log(text);
        return;
      }
      triggerExportDownload({
        blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
        filename: `dxf-cursor-audit-${nowISO().replace(/[:.]/g, '-')}.txt`,
      });
    },
    reset: resetCursorAudit,
  };
}

/** Προσάρτηση του χειριστηρίου στο `window` (no-op εκτός browser). */
export function attachCursorAuditConsole(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __cursorAudit?: CursorAuditConsole };
  if (!w.__cursorAudit) w.__cursorAudit = createConsoleHandle();
}

// Προσάρτηση στη φόρτωση του module (το εισάγει ο ΕΝΑΣ γραφέας του δείκτη), ώστε το
// `window.__cursorAudit` να ζει από τη στιγμή που μονταρίζεται ο καμβάς — όχι μετά το συμβάν.
attachCursorAuditConsole();
