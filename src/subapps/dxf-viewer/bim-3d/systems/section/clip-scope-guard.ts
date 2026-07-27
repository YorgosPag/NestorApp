/**
 * clip-scope-guard.ts — «κανένα υποδέντρο δεν κληρονομεί ΞΕΝΟ clip scope» (ADR-665 Φ2).
 *
 * ## Το σφάλμα που παρακολουθεί
 *
 * Το three.js clipping είναι **ανά υλικό**, οπότε το ADR-665 δρομολογεί τα αντικείμενα σε scopes
 * (`'default'` = το κτίριο, `'topo'` = το έδαφος) και το scope **ΚΛΗΡΟΝΟΜΕΙΤΑΙ προς τα κάτω** από
 * το `userData['topoClipScope']` ενός root. Ταυτόχρονα, το `LineBasicMaterial` είναι clippable
 * **ΜΟΝΟ** στο `'topo'`.
 *
 * Αυτά τα δύο μαζί φτιάχνουν μια σιωπηλή παγίδα: **αρκεί ένα υποδέντρο να βρεθεί κάτω από topo
 * root για να αρχίσει να κόβεται από την κοπή του εδάφους** — χωρίς σφάλμα, χωρίς προειδοποίηση,
 * χωρίς ορατή αιτία. Ο ίδιος ο `section-clip-applicator` το γράφει ρητά:
 *
 * > «⚠️ This is deliberately NOT added to the `'default'` scope. `bim-3d/` has ~20 other
 * > `LineBasicMaterial` users — gizmo handles, `Dimension3DRenderer`, `FocusOutlineRenderer`,
 * > `TempAlignmentLineOverlay`, **`DxfToThreeConverter`**, diagrams — and a global allowlist would
 * > silently start clipping every one of them.»
 *
 * Ο κίνδυνος είναι δηλαδή **ήδη γνωστός και γραμμένος**· αυτό που έλειπε ήταν όργανο που να τον
 * **πιάνει όταν συμβεί**. Η ζημιά είναι μέγιστη ακριβώς επειδή είναι αόρατη: ολόκληρο το 2Δ σχέδιο
 * εξαφανίζεται σε μια ζώνη της οθόνης ενώ τα Canvas2D overlays (λαβές, hover, επιλογή) συνεχίζουν
 * κανονικά — γιατί αυτά **δεν** περνούν από GPU clipping. Η ασυμμετρία μοιάζει με «σφάλμα
 * προβολής» και στέλνει τη διάγνωση σε near/far plane, που είναι λάθος δρόμος.
 *
 * ## Τι κάνει
 *
 * Ένα υποδέντρο μπορεί να **κλειδώσει** το scope του ({@link lockClipScope}). Στο σημείο που ο
 * applicator γράφει planes, ο φύλακας συγκρίνει «τι κλείδωσε το υποδέντρο» με «τι προέκυψε από την
 * κληρονομιά». Διαφορά ⇒ διαρροή ⇒ καταγραφή.
 *
 * ## Τι ΔΕΝ κάνει (σκόπιμα)
 *
 * **Δεν αλλάζει συμπεριφορά.** Παρατηρεί και αναφέρει· δεν επιβάλλει. Το σφάλμα που το γέννησε
 * (2026-07-28) είναι **διαλείπον και μη επιβεβαιωμένο**, και η επιβολή θα μπορούσε να ακυρώσει
 * μελλοντική *σκόπιμη* απόθεση σχεδίου πάνω σε έδαφος. Η προαγωγή σε επιβολή είναι το επόμενο
 * βήμα **μετά** από επιβεβαιωμένη αναπαραγωγή — όχι πριν.
 *
 * ## Κόστος
 *
 * Μία ανάγνωση `userData` + μία σύγκριση ανά σχεδιάσιμο αντικείμενο, **μόνο** όταν αλλάζει το set
 * των clip planes (ποτέ ανά καρέ). Η ακριβή δουλειά (διαδρομή αντικειμένου, μήνυμα) γίνεται
 * **μόνο** πάνω σε διαρροή.
 *
 * @see ./section-clip-applicator.ts — ο ιδιοκτήτης της δρομολόγησης ανά scope
 * @see docs/centralized-systems/reference/adrs/ADR-665-terrain-clip-at-active-level.md
 * @see HANDOFFS/3d-wireframe-clipped-before-viewport-bottom.md — το σφάλμα που το γέννησε
 */

import type * as THREE from 'three';
import type { ClipScope } from './section-clip-applicator';
import { nowISO } from '@/lib/date-local';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';

/** `userData` κλειδί με το οποίο ένα root δηλώνει «το υποδέντρο μου μένει σε ΑΥΤΟ το scope». */
export const CLIP_SCOPE_LOCK_KEY = 'clipScopeLock';

/** Πόσες διαρροές κρατά ο δακτύλιος. Αρκετά για να δει κανείς μοτίβο, όχι αρκετά για διαρροή μνήμης. */
const MAX_LEAKS = 64;

/** Μία καταγεγραμμένη διαρροή scope. */
export interface ClipScopeLeak {
  /** Διαδρομή ονομάτων από τη ρίζα της σκηνής — αρκεί για να βρεις ΠΟΙΟΣ το προσάρτησε λάθος. */
  readonly path: string;
  readonly materialType: string;
  /** Τι είχε κλειδώσει το υποδέντρο. */
  readonly lockedScope: ClipScope;
  /** Τι προέκυψε τελικά από την κληρονομιά. */
  readonly resolvedScope: ClipScope;
  /** Πόσα planes θα γράφονταν — `0` σημαίνει δομική διαρροή χωρίς (ακόμη) ορατή ζημιά. */
  readonly planeCount: number;
  /** `performance.now()` τη στιγμή της διαρροής. */
  readonly atMs: number;
}

const leaks: ClipScopeLeak[] = [];
/** Υπογραφές που έχουν ήδη αναφερθεί στην κονσόλα — μία φωνή ανά μοναδικό σφάλμα, όχι ανά καρέ. */
const reportedSignatures = new Set<string>();

/**
 * Κλείδωσε το clip scope ενός υποδέντρου. Καθρέφτης του `seatTopoLayerRoot`: εκεί ένα root
 * **δηλώνει** scope, εδώ ένα root **απαιτεί** scope.
 */
export function lockClipScope(root: THREE.Object3D, scope: ClipScope): void {
  root.userData[CLIP_SCOPE_LOCK_KEY] = scope;
}

/** Το κλειδωμένο scope αυτού του αντικειμένου (όχι κληρονομημένο), ή `null`. */
export function readClipScopeLock(obj: THREE.Object3D): ClipScope | null {
  const raw = obj.userData[CLIP_SCOPE_LOCK_KEY];
  return raw === 'default' || raw === 'topo' ? raw : null;
}

/** `a > b > c` από τη ρίζα προς το αντικείμενο· ανώνυμοι κόμβοι δίνουν τον τύπο τους. */
function describeObjectPath(obj: THREE.Object3D): string {
  const parts: string[] = [];
  let node: THREE.Object3D | null = obj;
  while (node) {
    parts.push(node.name || `<${node.type}>`);
    node = node.parent;
  }
  return parts.reverse().join(' > ');
}

/** Ο τύπος υλικού του αντικειμένου (το πρώτο, αν είναι πίνακας)· `<none>` όταν δεν έχει. */
function materialTypeOf(obj: THREE.Object3D): string {
  const material = (obj as THREE.Mesh | THREE.Line).material;
  if (Array.isArray(material)) return material[0]?.type ?? '<none>';
  return material?.type ?? '<none>';
}

/** Σταθερή υπογραφή διαρροής — ίδια θέση + ίδια μετάπτωση scope ⇒ μία μόνο αναφορά. */
function signatureOf(leak: ClipScopeLeak): string {
  return `${leak.path}|${leak.lockedScope}->${leak.resolvedScope}`;
}

function warnOnce(leak: ClipScopeLeak): void {
  const signature = signatureOf(leak);
  if (reportedSignatures.has(signature)) return;
  reportedSignatures.add(signature);
  if (process.env.NODE_ENV === 'production') return;
  // eslint-disable-next-line no-console -- ίδια σύμβαση με το >6-planes warning του SectionSceneController
  console.warn(
    `[ADR-665] CLIP SCOPE LEAK — «${leak.path}» κλείδωσε scope '${leak.lockedScope}' ` +
    `αλλά κληρονόμησε '${leak.resolvedScope}' (${leak.materialType}, ${leak.planeCount} planes). ` +
    'Αν είναι το υπόστρωμα DXF, το 2Δ σχέδιο κόβεται από την κοπή του εδάφους. ' +
    'Λεπτομέρειες: window.__bim3dClipGuard.dump()',
  );
}

/**
 * Κατέγραψε μια διαρροή scope. Καλείται από τον applicator ΜΟΝΟ όταν το κλειδωμένο scope διαφέρει
 * από το κληρονομημένο — δηλαδή ποτέ στην ομαλή λειτουργία.
 */
export function noteClipScopeLeak(
  obj: THREE.Object3D,
  lockedScope: ClipScope,
  resolvedScope: ClipScope,
  planes: readonly THREE.Plane[] | null,
): void {
  const leak: ClipScopeLeak = {
    path: describeObjectPath(obj),
    materialType: materialTypeOf(obj),
    lockedScope,
    resolvedScope,
    planeCount: planes?.length ?? 0,
    atMs: typeof performance !== 'undefined' ? performance.now() : 0,
  };
  leaks.push(leak);
  if (leaks.length > MAX_LEAKS) leaks.shift();
  warnOnce(leak);
}

/** Οι καταγεγραμμένες διαρροές (αντίγραφο — ο καλών δεν μπορεί να μολύνει τον δακτύλιο). */
export function getClipScopeLeaks(): readonly ClipScopeLeak[] {
  return [...leaks];
}

/** Μηδενίζει δακτύλιο + υπογραφές. Για τα tests και για το `window.__bim3dClipGuard.reset()`. */
export function resetClipScopeGuard(): void {
  leaks.length = 0;
  reportedSignatures.clear();
}

// ── Χειριστήριο κονσόλας ─────────────────────────────────────────────────────
// Ίδιο μοτίβο με το `bim3d-perf-diag` (`window.__bim3dPerf`): ένα διαλείπον σφάλμα δεν πιάνεται με
// χειροκίνητο capture — ο δακτύλιος γεμίζει μόνος του και ο Giorgio τον κατεβάζει ΜΕΤΑ το συμβάν.

/** Το σχήμα που εκτίθεται στο `window`. */
export interface ClipScopeGuardConsole {
  leaks(): readonly ClipScopeLeak[];
  dump(): void;
  download(): void;
  reset(): void;
}

function buildReportText(): string {
  const rows = getClipScopeLeaks();
  const header = `=== ADR-665 CLIP SCOPE GUARD — ${nowISO()} ===`;
  if (rows.length === 0) return `${header}\n\n(καμία διαρροή — το clip scope έμεινε καθαρό)`;
  const body = rows.map((leak, i) => [
    `[${i + 1}] +${(leak.atMs / 1000).toFixed(1)}s  ${leak.lockedScope} → ${leak.resolvedScope}`,
    `    path     : ${leak.path}`,
    `    material : ${leak.materialType}`,
    `    planes   : ${leak.planeCount}`,
  ].join('\n')).join('\n');
  return `${header}\n\nδιαρροές: ${rows.length}\n\n${body}`;
}

function createConsoleHandle(): ClipScopeGuardConsole {
  return {
    leaks: getClipScopeLeaks,
    dump() {
      // eslint-disable-next-line no-console -- διαγνωστικό χειριστήριο κονσόλας
      console.log(buildReportText());
    },
    download() {
      const text = buildReportText();
      if (typeof document === 'undefined') {
        // eslint-disable-next-line no-console -- διαγνωστικό χειριστήριο κονσόλας
        console.log(text);
        return;
      }
      const filename = `bim3d-clip-scope-${nowISO().replace(/[:.]/g, '-')}.txt`;
      triggerExportDownload({
        blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
        filename,
      });
    },
    reset: resetClipScopeGuard,
  };
}

/** Προσάρτηση του χειριστηρίου στο `window` (no-op εκτός browser). */
export function attachClipScopeGuardConsole(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __bim3dClipGuard?: ClipScopeGuardConsole };
  if (!w.__bim3dClipGuard) w.__bim3dClipGuard = createConsoleHandle();
}

attachClipScopeGuardConsole();
