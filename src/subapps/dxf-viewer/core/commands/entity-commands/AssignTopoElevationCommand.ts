/**
 * AssignTopoElevationCommand — ADR-731 · η **απόδοση υψομέτρου από την επιφάνεια** ως undoable
 * εντολή, και η γόμα της.
 *
 * **Ίδια οικογένεια με το `MoveTopoSurveyPointCommand`, για τον ίδιο λόγο** (ADR-662 §13): η
 * αλήθεια δεν ζει σε οντότητα — ζει στον `TopoPointStore`, και η οντότητα `topo-surface` είναι
 * το **παράγωγο**. Snapshot-based undo σκόπιμα χονδροειδές (ολόκληρος ο πίνακας σημείων): ο
 * πίνακας είναι ήδη immutable-replaced από τον store, οπότε το κόστος είναι μία αναφορά.
 *
 * ── 🎯 Γιατί ΔΕΝ ξαναχτίζει το footprint (σε αντίθεση με το MoveTopoSurveyPoint) ─────────────
 * Επειδή **η επιφάνεια δεν αλλάζει**. Το παράγωγο υψόμετρο φέρει `zSource: 'derived'`, και το
 * `surfacePointsOf` — η **μία** πόρτα προς την τριγωνοποίηση — το αποκλείει. Άρα το σύνολο των
 * κορυφών του TIN είναι **πανομοιότυπο** πριν και μετά, και μαζί του το περίγραμμα, οι
 * ισοϋψείς, οι όγκοι εκσκαφής. Αλλάζει **μόνο** τι γνωρίζει το κάθε σημείο για τον εαυτό του:
 * ετικέτα, tooltip, πίνακας συντεταγμένων.
 *
 * Αυτό δεν είναι παράλειψη — είναι **ολόκληρη η ασφάλεια της εντολής**. Αν το footprint άλλαζε,
 * θα σήμαινε ότι το παράγωγο υψόμετρο μπήκε στην τριγωνοποίηση, δηλαδή ότι η επιφάνεια τράφηκε
 * από τον εαυτό της. Βλ. ADR-731 §1 για τη μετρημένη συνέπεια αυτού.
 *
 * ── Ένα undo για N σημεία, χωρίς προσπάθεια ─────────────────────────────────────────────────
 * Είναι **μία** εντολή που κρατά **έναν** πίνακα «πριν» και **έναν** «μετά», όχι N εντολές. Άρα
 * δεν χρειάζεται το `runAsSingleUndo` του ADR-729 — η ατομικότητα είναι εγγενής. (Το ADR-729 §7
 * προειδοποιεί για το αντίθετο σχήμα: βρόχος πάνω σε N commands **πρέπει** να τυλιχτεί ρητά.)
 *
 * @see ../../../systems/topography/topo-elevation-assign — ο καθαρός πυρήνας + η πολιτική
 * @see ./MoveTopoSurveyPointCommand — η αδελφή εντολή (planimetric μετακίνηση)
 * @see docs/centralized-systems/reference/adrs/ADR-731-elevation-assignment-from-surface.md
 */

import type { ICommand } from '../interfaces';
import type { TopoPoint, TopoSurfaceId } from '../../../systems/topography/topo-types';
import type { ElevationAssignmentPlan } from '../../../systems/topography/topo-elevation-assign';
import { BaseCommand } from '../base-command';
import { getTopoPoints, setTopoPoints } from '../../../systems/topography/TopoPointStore';
import {
  applyElevationAssignment,
  clearDerivedElevations,
} from '../../../systems/topography/topo-elevation-assign';

/** Τι έκανε η εντολή — καθορίζει μόνο το κείμενο του ιστορικού, ποτέ τη συμπεριφορά. */
type ElevationEdit = 'assign' | 'clear';

export class AssignTopoElevationCommand extends BaseCommand {
  readonly name = 'AssignTopoElevation';
  readonly type = 'assign-topo-elevation';

  private constructor(
    private readonly surfaceId: TopoSurfaceId,
    private readonly previousPoints: readonly TopoPoint[],
    private readonly nextPoints: readonly TopoPoint[],
    private readonly edit: ElevationEdit,
    private readonly affectedCount: number,
  ) {
    super();
  }

  /**
   * Από ένα **ήδη εγκεκριμένο** πλάνο. Το πλάνο υπολογίζεται στο UI ώστε ο χρήστης να δει τι θα
   * γίνει (πόσα εκτός επιφάνειας, πόσα πάνω σε γέφυρα) **πριν** πατήσει — και εκτελείται εδώ
   * **αυτούσιο**, ώστε αυτό που εγκρίθηκε να είναι ακριβώς αυτό που γράφεται.
   *
   * `null` όταν δεν αλλάζει τίποτα (κενό πλάνο, ή τα σημεία μετακινήθηκαν στο μεταξύ ώστε το
   * αποτέλεσμα να ταυτίζεται) — ώστε να μη γεννηθεί κενή εγγραφή στο ιστορικό (N.7.2 #3).
   */
  static fromPlan(
    surfaceId: TopoSurfaceId,
    plan: ElevationAssignmentPlan,
  ): AssignTopoElevationCommand | null {
    const previousPoints = getTopoPoints(surfaceId);
    const nextPoints = applyElevationAssignment(previousPoints, plan.assignments);
    if (nextPoints === previousPoints) return null;
    return new AssignTopoElevationCommand(
      surfaceId, previousPoints, nextPoints, 'assign', plan.assignments.length,
    );
  }

  /**
   * Η γόμα: **κάθε** παράγωγο υψόμετρο φεύγει και το σημείο ξαναγίνεται δισδιάστατο, όπως ήρθε
   * από την αποτύπωση. `null` όταν δεν υπάρχει τίποτα παράγωγο.
   */
  static clearDerived(surfaceId: TopoSurfaceId): AssignTopoElevationCommand | null {
    const previousPoints = getTopoPoints(surfaceId);
    const nextPoints = clearDerivedElevations(previousPoints);
    if (nextPoints === previousPoints) return null;
    const cleared = previousPoints.filter((p) => p.zSource === 'derived').length;
    return new AssignTopoElevationCommand(
      surfaceId, previousPoints, nextPoints, 'clear', cleared,
    );
  }

  execute(): void {
    setTopoPoints(this.nextPoints, this.surfaceId);
  }

  undo(): void {
    setTopoPoints(this.previousPoints, this.surfaceId);
  }

  /**
   * **Δεν συγχωνεύεται ποτέ.** Κάθε εκτέλεση είναι ρητή απόφαση του μηχανικού πάνω σε ένα πλάνο
   * που είδε — δύο τέτοιες αποφάσεις δεν επιτρέπεται να καταρρεύσουν σε ένα βήμα αναίρεσης, γιατί
   * τότε η πρώτη γίνεται μη-αναιρέσιμη. (Αντίθετα με το drag λαβής, που είναι **μία** χειρονομία
   * δειγματοληπτημένη πολλές φορές — εκεί η συγχώνευση είναι το σωστό.)
   */
  canMergeWith(_other: ICommand): boolean {
    return false;
  }

  getDescription(): string {
    return this.edit === 'assign'
      ? `Assign elevation from surface to ${this.affectedCount} survey point(s) of «${this.surfaceId}»`
      : `Clear ${this.affectedCount} derived elevation(s) of surface «${this.surfaceId}»`;
  }

  /**
   * Καμία — και αυτό είναι το σημείο. Η εντολή γράφει στον `TopoPointStore`, όχι σε οντότητα, και
   * τα ορατά παράγωγα (ετικέτες σημείων, πίνακες παραδοτέων) διαβάζουν τον store **αντιδραστικά**.
   * Το ίδιο το `topo-surface` **δεν** αλλάζει (βλ. επικεφαλίδα), οπότε δεν υπάρχει οντότητα να
   * δηλωθεί — και μια ψεύτικη δήλωση θα πυροδοτούσε ανώφελο cascade αναδημιουργίας.
   */
  getAffectedEntityIds(): string[] {
    return [];
  }

  protected serializeData(): Record<string, unknown> {
    return {
      surfaceId: this.surfaceId,
      edit: this.edit,
      affectedCount: this.affectedCount,
    };
  }
}
