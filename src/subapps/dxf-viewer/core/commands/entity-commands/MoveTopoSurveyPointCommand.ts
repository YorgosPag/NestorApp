/**
 * MoveTopoSurveyPointCommand — ADR-662 §13 · η μετακίνηση **ενός survey point** από λαβή
 * του περιγράμματος, ως undoable εντολή.
 *
 * **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΟΙΚΟΓΕΝΕΙΑ ΕΝΤΟΛΩΝ.** Όλες οι υπόλοιπες grip εντολές πατούν στο
 * `MergeableUpdateCommand`, που κάνει patch **ένα πεδίο μιας οντότητας** μέσω του
 * `sceneManager`. Εδώ η αλήθεια **δεν ζει σε οντότητα**: ζει στο `TopoPointStore`, και η
 * οντότητα (`topo-surface`) είναι το **παράγωγο**. Αν κάναμε patch το `footprint`, η αλλαγή
 * θα εξατμιζόταν στην επόμενη αναδημιουργία — ακριβώς ο λόγος που η επιφάνεια ήταν grip-less
 * μέχρι σήμερα. Άρα: γράψε στην **πηγή**, ξαναπαράγε το παράγωγο.
 *
 * Είναι επίσης η **πρώτη** undoable μεταβολή του `TopoPointStore` — μέχρι τώρα κάθε γραφή
 * (import, αφαίρεση ακίδων) ήταν μονόδρομη. Το snapshot-based undo εδώ είναι σκόπιμα
 * χονδροειδές (ολόκληρος ο πίνακας σημείων): ο πίνακας είναι ήδη immutable-replaced από τον
 * store, οπότε το κόστος είναι μία αναφορά, και η ορθότητα δεν εξαρτάται από το να
 * «ξεκάνουμε» σωστά μια στοχευμένη μετάλλαξη.
 *
 * **Τρία βήματα, με αυτή τη σειρά — η σειρά ΕΙΝΑΙ το συμβόλαιο:**
 *   1. γράψε τα σημεία στον store  → ο μνημονευμένος TIN ακυρώνεται μόνος του (pointer compare)
 *   2. ξαναπαράγε το `footprint`   → renderer / hit-test / έλξεις / λαβές δείχνουν τη νέα αλήθεια
 *   3. `reconcileAssociativeGeometry` → τα εξαρτημένα (π.χ. ζωντανή ετικέτα εμβαδού) ξανα-derive
 *
 * Το (3) τρέχει **σύγχρονα μέσα στην εντολή**, ποτέ ως reactive effect — ADR-492 §4: ένα
 * effect που άκουγε geometry events και ξανα-εξέπεμπε γεωμετρία έκανε βρόχο με τον proactive
 * analysis cycle → storm/freeze.
 *
 * @see ../../../systems/topography/topo-survey-point-resolve — «ποια κορυφή = ποιο σημείο»
 * @see ../../../systems/topography/topo-surface-entity — ο SSoT builder του footprint
 * @see ../../../bim/cascade/associative-geometry-reconcile — ADR-540 universal cascade
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 */

import type { ICommand, ISceneManager, SceneEntity } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { TopoPoint, TopoSurfaceId } from '../../../systems/topography/topo-types';
import type { TopoSurfaceEntity } from '../../../types/topo-surface';
import { BaseCommand } from '../base-command';
import { isWithinMergeWindow } from '../merge-window';
import { getTopoPoints, setTopoPoints } from '../../../systems/topography/TopoPointStore';
import { buildTopoSurfaceEntity } from '../../../systems/topography/topo-surface-entity';
import { moveSurveyPoint } from '../../../systems/topography/topo-survey-point-resolve';
import { reconcileAssociativeGeometry } from '../../../bim/cascade/associative-geometry-reconcile';

export class MoveTopoSurveyPointCommand extends BaseCommand {
  readonly name = 'MoveTopoSurveyPoint';
  readonly type = 'move-topo-survey-point';

  /** Τα σημεία ΠΡΙΝ — snapshot για undo (immutable αναφορά, μηδέν αντιγραφή). */
  private readonly previousPoints: readonly TopoPoint[];
  /** Τα σημεία ΜΕΤΑ — ξαναϋπολογίζεται σε κάθε merge (το τελευταίο delta νικά). */
  private nextPoints: readonly TopoPoint[];

  constructor(
    private readonly surfaceId: TopoSurfaceId,
    private readonly footprintEntityId: string,
    private readonly pointIndex: number,
    previousPoints: readonly TopoPoint[],
    nextPoints: readonly TopoPoint[],
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
  ) {
    super();
    this.previousPoints = previousPoints;
    this.nextPoints = nextPoints;
  }

  /**
   * Εργοστάσιο από τα δεδομένα της λαβής: διαβάζει τα τρέχοντα σημεία, εφαρμόζει το
   * **WORLD** delta, και επιστρέφει `null` όταν τίποτα δεν άλλαξε (idempotency, N.7.2 #3) —
   * ώστε ένα drag χωρίς μετατόπιση να μη γεννά κενή εγγραφή στο ιστορικό.
   */
  static fromDrag(
    surfaceId: TopoSurfaceId,
    footprintEntityId: string,
    pointIndex: number,
    worldDelta: Point2D,
    sceneManager: ISceneManager,
    isDragging = false,
  ): MoveTopoSurveyPointCommand | null {
    const previousPoints = getTopoPoints(surfaceId);
    const nextPoints = moveSurveyPoint(previousPoints, pointIndex, worldDelta);
    if (nextPoints === previousPoints) return null;
    return new MoveTopoSurveyPointCommand(
      surfaceId, footprintEntityId, pointIndex, previousPoints, nextPoints, sceneManager, isDragging,
    );
  }

  execute(): void {
    this.applyPoints(this.nextPoints);
  }

  undo(): void {
    this.applyPoints(this.previousPoints);
  }

  /**
   * Τα τρία βήματα, μία φορά γραμμένα: πηγή → παράγωγο → εξαρτημένα. Και το `execute` και
   * το `undo` περνούν από εδώ, οπότε η αναίρεση **δεν** μπορεί να ξεχάσει την αναδημιουργία
   * του footprint — το κλασικό «κάνω undo και η επιφάνεια μένει στη νέα θέση».
   */
  private applyPoints(points: readonly TopoPoint[]): void {
    setTopoPoints(points, this.surfaceId);
    this.refreshFootprint();
    reconcileAssociativeGeometry([this.footprintEntityId], this.sceneManager);
  }

  /**
   * Ξαναπαράγει το `footprint` από τον **SSoT builder** (ίδιος με τον interactive producer
   * και το regenerate-on-load — μηδέν δεύτερη create-logic, μηδέν frame drift).
   *
   * Το layer κρατιέται από την **υπάρχουσα** οντότητα: το footprint είναι derived, αλλά η
   * τοποθέτησή του σε layer είναι απόφαση της σκηνής και δεν ξανα-αποφασίζεται εδώ.
   * Εκφυλισμένο αποτέλεσμα (καμία τριγωνοποιήσιμη επιφάνεια) → κρατάμε το προηγούμενο
   * περίγραμμα: καλύτερα μπαγιάτικο περίγραμμα από εξαφανισμένη επιφάνεια.
   */
  private refreshFootprint(): void {
    const existing = this.sceneManager.getEntity(this.footprintEntityId) as
      | (SceneEntity & Partial<TopoSurfaceEntity>)
      | undefined;
    if (!existing) return;
    const rebuilt = buildTopoSurfaceEntity(this.surfaceId, existing.layerId);
    if (!rebuilt) return;
    this.sceneManager.updateEntity(this.footprintEntityId, {
      footprint: rebuilt.footprint,
    } as Partial<SceneEntity>);
  }

  /**
   * Συνεχές drag = **ΕΝΑ** undo (ADR-031 merge window). Συγχωνεύονται μόνο δείγματα του
   * ΙΔΙΟΥ σημείου στην ΙΔΙΑ επιφάνεια — αλλιώς δύο διαδοχικά σύρσιμα διαφορετικών κορυφών
   * θα κατέρρεαν σε ένα και το πρώτο θα γινόταν μη-αναιρέσιμο.
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveTopoSurveyPointCommand)) return false;
    if (other.surfaceId !== this.surfaceId || other.pointIndex !== this.pointIndex) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return isWithinMergeWindow(this, other);
  }

  /** Κρατά το ΠΑΛΑΙΟΤΕΡΟ «πριν» και υιοθετεί το ΝΕΟΤΕΡΟ «μετά» (mirror MergeableUpdateCommand). */
  mergeWith(other: ICommand): ICommand {
    const o = other as MoveTopoSurveyPointCommand;
    this.nextPoints = o.nextPoints;
    return this;
  }

  getDescription(): string {
    return `Move survey point ${this.pointIndex} of surface «${this.surfaceId}»`;
  }

  getAffectedEntityIds(): string[] {
    return [this.footprintEntityId];
  }

  protected serializeData(): Record<string, unknown> {
    return {
      surfaceId: this.surfaceId,
      footprintEntityId: this.footprintEntityId,
      pointIndex: this.pointIndex,
      isDragging: this.isDragging,
    };
  }
}
