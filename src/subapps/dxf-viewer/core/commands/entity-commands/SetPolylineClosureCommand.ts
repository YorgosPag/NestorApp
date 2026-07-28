/**
 * SET POLYLINE CLOSURE COMMAND — ADR-718 §Β (AutoCAD `PEDIT` → **Close** / **Open**)
 *
 * Η ΜΙΑ undoable διαδρομή που αλλάζει το **αν μια πολυγραμμή είναι κλειστή**, και — για το
 * «Άνοιγμα εδώ» — **ποια ακμή** φεύγει. Τρεις πράξεις, οι τρεις καθαρές συναρτήσεις του
 * `utils/entity-conversion` ({@link closePolyline} / {@link openPolyline} /
 * {@link openPolylineAtEdge}) που μέχρι σήμερα **καμία χειρονομία δεν καλούσε**.
 *
 * ── ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟΣ COMMAND ΚΑΙ ΟΧΙ `UpdateEntityCommand({ closed })` ───────────────────────
 * Δύο λόγοι, και οι δύο σιωπηλοί αν τους προσπεράσεις:
 *
 *  1. **Ο associative cascade.** Το `closed` **δεν είναι σημαία εμφάνισης** — είναι τοπολογία.
 *     Ένα όριο οικοπέδου (ADR-650 M6 Γ) υπάρχει **μόνο** πάνω σε κλειστή πολυγραμμή
 *     (`topo-boundary-pick.closedRingVerticesOf`), οπότε το άνοιγμα της πηγής **σπάει** τον
 *     δεσμό. Ο `UpdateEntityCommand` δεν τρέχει κανέναν reconciler → η κοπή θα έμενε να δείχνει
 *     έναν δακτύλιο που **δεν αντιστοιχεί πια σε τίποτα**, χωρίς καμία ένδειξη. Εδώ τρέχει το
 *     universal `reconcileAssociativeGeometry` (ADR-540) σε execute/undo/redo, οπότε ο δεσμός
 *     γίνεται `'invalid'` και το ribbon το **λέει** — και ξαναγίνεται `'live'` μόνο του μόλις η
 *     πολυγραμμή ξανακλείσει (ή στο undo). Καμία ξεχωριστή διαδρομή «re-link».
 *
 *  2. **Τα per-segment παράλληλα μητρώα.** `bulges` / `startWidths` / `endWidths` δεν είναι
 *     ανά κορυφή αλλά **ανά τμήμα**, και το πλήθος τμημάτων **αλλάζει** με το `closed`
 *     (`SetBulgeCommand`: `closed ? N : N − 1`). Το «Άνοιγμα εδώ» επιπλέον **περιστρέφει** τη
 *     λίστα κορυφών, άρα και τα τμήματα. Ένα σκέτο `{ closed: false }` θα άφηνε τα τόξα
 *     κολλημένα σε **άλλες** ακμές — μια πολυγραμμή με τόξα θα άλλαζε σχήμα από μια εντολή που
 *     υποτίθεται ότι μόνο την ανοίγει.
 *
 * ── Η ΜΙΑ ΠΕΡΜΟΥΤΑΣΗ ────────────────────────────────────────────────────────────────────────
 * Και οι τρεις πράξεις εκφράζονται ως «ποιο **παλιό** τμήμα γίνεται το νέο τμήμα j» (βλ.
 * {@link segmentSourcesFor}). Το σκέτο άνοιγμα είναι *ακριβώς* το άνοιγμα στην τελευταία ακμή —
 * μία φόρμουλα, όχι τρεις παραλλαγές που θα αποκλίνουν στην πρώτη διόρθωση.
 *
 * @see utils/entity-conversion — closePolyline / openPolyline / openPolylineAtEdge (οι καθαρές πράξεις)
 * @see SetBulgeCommand — η σύμβαση πλήθους τμημάτων (`closed ? N : N − 1`)
 * @see PolylineVertexCommand — το αδελφό idiom (κορυφή +/−, index-aligned παράλληλα μητρώα)
 * @see bim/cascade/associative-geometry-reconcile — ADR-540 universal cascade
 * @see docs/centralized-systems/reference/adrs/ADR-718-terrain-crop-to-site-boundary.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { BaseCommand } from '../base-command';
import { deepClone } from '../../../utils/clone-utils';
import { geometryFromSnapshot } from './snapshot-geometry';
import {
  closePolyline,
  openPolyline,
  openPolylineAtEdge,
  type PolylineRing,
} from '../../../utils/entity-conversion';
import { reconcileAssociativeGeometry } from '../../../bim/cascade/associative-geometry-reconcile';

/** Οι τρεις πράξεις — ένα προς ένα με τις τρεις καθαρές συναρτήσεις. */
export type PolylineClosureOp =
  | { readonly kind: 'close' }
  | { readonly kind: 'open' }
  | { readonly kind: 'open-at-edge'; readonly edgeIndex: number };

export interface PolylineClosureParams {
  readonly entityId: string;
  readonly op: PolylineClosureOp;
}

/** Το ελάχιστο που διαβάζει ο command από τη σκηνή — δομικό, ώστε polyline ΚΑΙ lwpolyline. */
type PolyReadView = PolylineRing & {
  readonly bulges?: readonly number[];
  readonly startWidths?: readonly number[];
  readonly endWidths?: readonly number[];
};

/** Ο patch που γράφεται στη σκηνή: πάντα η σημαία, οι κορυφές μόνο όταν αναδιατάχθηκαν. */
interface ClosurePatch {
  readonly closed: boolean;
  readonly vertices?: readonly Point2D[];
  readonly bulges?: number[];
  readonly startWidths?: number[];
  readonly endWidths?: number[];
}

/**
 * Ποιο **παλιό** τμήμα γίνεται το νέο τμήμα `j` — `null` = καινούργιο τμήμα χωρίς ιστορικό
 * (μόνο το κλείσιμο γεννά ένα, και γεννιέται ευθύγραμμο).
 *
 * - `close`: τα `N − 1` υπάρχοντα μένουν στη θέση τους, το κλείσιμο μπαίνει τελευταίο → `null`.
 * - άνοιγμα στην ακμή `k`: η λίστα ξεκινά από την ακμή `k + 1`, και η ακμή `k` **φεύγει**.
 *   Άρα `N − 1` τμήματα, `sources[j] = (k + 1 + j) mod N`.
 */
function segmentSourcesFor(op: PolylineClosureOp, vertexCount: number): (number | null)[] {
  if (op.kind === 'close') {
    const sources: (number | null)[] = [];
    for (let i = 0; i < vertexCount - 1; i += 1) sources.push(i);
    sources.push(null);
    return sources;
  }
  const k = op.kind === 'open-at-edge' ? op.edgeIndex : vertexCount - 1;
  const sources: (number | null)[] = [];
  for (let j = 0; j < vertexCount - 1; j += 1) sources.push((k + 1 + j) % vertexCount);
  return sources;
}

/**
 * Ξαναχτίζει ένα per-segment μητρώο κατά την περμουτάση. Απόν μητρώο ⇒ **παραμένει απόν**: μια
 * πολυγραμμή χωρίς τόξα δεν αποκτά πίνακα μηδενικών επειδή την άνοιξε κάποιος (ίδιος κανόνας με
 * το `PolylineVertexCommand.spliceParallel`).
 */
function rebuildSegmentArray(
  arr: readonly number[] | undefined,
  sources: readonly (number | null)[],
): number[] | undefined {
  if (!arr) return undefined;
  return sources.map((src) => (src === null ? 0 : arr[src] ?? 0));
}

/** Η καθαρή πράξη πάνω στον δακτύλιο — η ΜΙΑ κλήση των τριών συναρτήσεων του §Β. */
function applyRingOp(ring: PolyReadView, op: PolylineClosureOp): PolylineRing {
  if (op.kind === 'close') return closePolyline(ring);
  if (op.kind === 'open') return openPolyline(ring);
  return openPolylineAtEdge(ring, op.edgeIndex);
}

/**
 * Undoable «Κλείσιμο / Άνοιγμα πολυγραμμής» (AutoCAD `PEDIT`). Δουλεύει σε `polyline` και
 * `lwpolyline`· κάθε άλλος τύπος είναι σιωπηλό no-op (ο builder τον έχει ήδη αποκλείσει).
 */
export class SetPolylineClosureCommand extends BaseCommand {
  readonly name = 'SetPolylineClosure';
  readonly type = 'set-polyline-closure';

  private snapshot: SceneEntity | null = null;

  constructor(
    private readonly params: PolylineClosureParams,
    private readonly sceneManager: ISceneManager,
  ) {
    super();
  }

  /** Ο patch της πράξης, ή `null` όταν η οντότητα δεν είναι χρησιμοποιήσιμη πολυγραμμή. */
  private buildPatch(entity: SceneEntity): ClosurePatch | null {
    const type = (entity as { type?: string }).type;
    if (type !== 'polyline' && type !== 'lwpolyline') return null;
    const ring = entity as unknown as PolyReadView;
    const vertexCount = ring.vertices?.length ?? 0;
    // Κάτω από τρεις κορυφές δεν υπάρχει δακτύλιος: το «κλειστό» θα ήταν ένα τμήμα πάνω στον
    // εαυτό του, χωρίς εσωτερικό — και ΚΑΘΕ καταναλωτής του `closed` εδώ (όριο οικοπέδου,
    // εμβαδόν, γραμμοσκίαση) το διαβάζει ως περιοχή. Το αρνούμαστε αντί να το επινοήσουμε.
    if (vertexCount < 3) return null;

    const op = this.params.op;
    if (op.kind === 'open-at-edge' && (op.edgeIndex < 0 || op.edgeIndex >= vertexCount)) return null;
    if (op.kind === 'close' && ring.closed === true) return null;
    if (op.kind !== 'close' && ring.closed !== true) return null;

    const result = applyRingOp(ring, op);
    const sources = segmentSourcesFor(op, vertexCount);
    const patch: ClosurePatch = {
      closed: result.closed === true,
      // Οι κορυφές ταξιδεύουν ΜΟΝΟ όταν αναδιατάχθηκαν — αλλιώς ο patch θα έγραφε νέο πίνακα
      // σε κάθε κλείσιμο/άνοιγμα και θα ακύρωνε memo χωρίς λόγο.
      ...(result.vertices === ring.vertices ? {} : { vertices: result.vertices.map((v) => ({ ...v })) }),
      ...this.parallelArrays(ring, sources),
    };
    return patch;
  }

  /** Τα τρία per-segment μητρώα, μόνο όσα υπάρχουν στην οντότητα. */
  private parallelArrays(
    ring: PolyReadView,
    sources: readonly (number | null)[],
  ): Partial<Pick<ClosurePatch, 'bulges' | 'startWidths' | 'endWidths'>> {
    const bulges = rebuildSegmentArray(ring.bulges, sources);
    const startWidths = rebuildSegmentArray(ring.startWidths, sources);
    const endWidths = rebuildSegmentArray(ring.endWidths, sources);
    return {
      ...(bulges ? { bulges } : {}),
      ...(startWidths ? { startWidths } : {}),
      ...(endWidths ? { endWidths } : {}),
    };
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.params.entityId);
    if (!entity) return;
    const patch = this.buildPatch(entity);
    if (!patch) return;
    this.snapshot = deepClone(entity);
    this.sceneManager.updateEntity(this.params.entityId, patch as Partial<SceneEntity>);
    this.reconcileDependents();
  }

  undo(): void {
    if (!this.snapshot) return;
    this.sceneManager.updateEntity(this.params.entityId, geometryFromSnapshot(this.snapshot));
    this.reconcileDependents();
  }

  redo(): void {
    if (!this.snapshot) return;
    const patch = this.buildPatch(this.snapshot);
    if (!patch) return;
    this.sceneManager.updateEntity(this.params.entityId, patch as Partial<SceneEntity>);
    this.reconcileDependents();
  }

  /**
   * ADR-540 / ADR-718 §Β — τα scene-derived εξαρτημένα, **αφού** η αλλαγή έχει κάτσει στη σκηνή.
   * Το άνοιγμα ενός περιγράμματος είναι ο **δεύτερος** τρόπος να σπάσει ο δεσμός ορίου↔πηγής
   * (πρώτος: η διαγραφή), και ο ΜΟΝΟΣ που ο χρήστης μπορεί να κάνει χωρίς να αγγίξει γεωμετρία.
   */
  private reconcileDependents(): void {
    reconcileAssociativeGeometry(this.getAffectedEntityIds(), this.sceneManager);
  }

  getDescription(): string {
    const op = this.params.op;
    if (op.kind === 'close') return 'Close polyline';
    if (op.kind === 'open') return 'Open polyline';
    return `Open polyline at edge ${op.edgeIndex}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.params.entityId];
  }

  validate(): string | null {
    if (!this.params.entityId) return 'Entity ID required';
    const op = this.params.op;
    if (op.kind === 'open-at-edge' && (!Number.isInteger(op.edgeIndex) || op.edgeIndex < 0)) {
      return 'Edge index must be a non-negative integer';
    }
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return { params: this.params, snapshot: this.snapshot };
  }
}
