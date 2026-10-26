/**
 * SetTopoBreaklinesCommand — ADR-920 Β4.8 Β3.3 · κάθε αλλαγή στις ασυνέχειες μιας επιφάνειας ως undoable εντολή.
 *
 * **ΓΙΑΤΙ.** Μέχρι εδώ κάθε γραφή ασυνεχειών ήταν μονόδρομη: το δεύτερο κλικ του εργαλείου την αφαιρούσε, ο
 * «Καθαρισμός» του ribbon τις έσβηνε ΟΛΕΣ, η έγκριση αυτόματων πρόσθετε Ν — και κανένα Ctrl+Z δεν τις έφερνε
 * πίσω. Μια ασυνέχεια αλλάζει την επιφάνεια, άρα τους όγκους, άρα μια τιμή: μια μη αναιρέσιμη αφαίρεση σε μία
 * λίστα είναι ακριβώς το λάθος που ο μηχανικός δεν προλαβαίνει να διορθώσει. Civil 3D: το Delete στον Prospector
 * είναι επισφαλές στο undo (το λένε οι χρήστες του)· εδώ είναι ρητό και ενιαίο.
 *
 * **Οικογένεια `MoveTopoSurveyPointCommand`** (ADR-662 §13): η αλήθεια ζει στο `TopoPointStore`, όχι σε
 * οντότητα, και το undo είναι **snapshot** ολόκληρου του πίνακα — ο store αντικαθιστά τον πίνακα immutable, άρα
 * το κόστος είναι μία αναφορά και η ορθότητα δεν εξαρτάται από το να «ξεκάνουμε» σωστά μια στοχευμένη αλλαγή.
 * Το TIN, οι ισοϋψείς, το 2Δ overlay και το 3Δ layer ακολουθούν μόνα τους (ακούν τον store).
 *
 * **Ιδεμποτία (N.7.2 #3):** κάθε εργοστάσιο επιστρέφει `null` όταν τίποτα δεν θα άλλαζε — ποτέ κενή εγγραφή
 * στο ιστορικό.
 *
 * @see ./MoveTopoSurveyPointCommand — η αδελφή εντολή (σημεία)
 * @see ../../../systems/topography/TopoPointStore — `createBreakline` (η μία γέννηση εγγραφής, N.6)
 */

import {
  withCrossingResolution,
  withoutCrossingResolutions,
  withoutOrphanCrossingResolutions,
} from '@/lib/terrain/breakline-crossing-rule';
import type { BreaklineCrossingResolution, CrossingResolutionKey } from '@/lib/terrain/terrain-types';
import type { Breakline, TopoSurfaceId } from '../../../systems/topography/topo-types';
import { getTopoBreaklines, setTopoBreaklines } from '../../../systems/topography/TopoPointStore';
import { BaseCommand } from '../base-command';

/** Τι έκανε η εντολή — η περιγραφή του ιστορικού και ο λόγος ύπαρξης κάθε εργοστασίου. */
export type TopoBreaklineEdit = 'add' | 'remove' | 'clear' | 'resolve' | 'unresolve';

export class SetTopoBreaklinesCommand extends BaseCommand {
  readonly name = 'SetTopoBreaklines';
  readonly type = 'set-topo-breaklines';

  private constructor(
    private readonly surfaceId: TopoSurfaceId,
    private readonly previous: readonly Breakline[],
    private readonly next: readonly Breakline[],
    private readonly edit: TopoBreaklineEdit,
    /** Οι ασυνέχειες που μπήκαν ή βγήκαν — για την περιγραφή και τα affected ids. */
    private readonly touchedIds: readonly string[],
  ) {
    super();
  }

  /** Πρόσθεσε έτοιμες εγγραφές (`createBreakline`) στο τέλος — Ν εγκρίσεις = ΕΝΑ undo. */
  static add(surfaceId: TopoSurfaceId, added: readonly Breakline[]): SetTopoBreaklinesCommand | null {
    if (added.length === 0) return null;
    const previous = getTopoBreaklines(surfaceId);
    return new SetTopoBreaklinesCommand(
      surfaceId, previous, [...previous, ...added], 'add', added.map((b) => b.id),
    );
  }

  /**
   * Αφαίρεσε τις ασυνέχειες με αυτά τα ids. `null` όταν καμία δεν υπάρχει. Β3.6: οι αποφάσεις επίλυσης των
   * υπολοίπων που αφορούσαν τις αφαιρεμένες φεύγουν στο ΙΔΙΟ βήμα (ένα Ctrl+Z τα φέρνει όλα πίσω).
   */
  static remove(surfaceId: TopoSurfaceId, ids: readonly string[]): SetTopoBreaklinesCommand | null {
    const drop = new Set(ids);
    const previous = getTopoBreaklines(surfaceId);
    const next = withoutOrphanCrossingResolutions(previous.filter((b) => !drop.has(b.id)));
    if (next.length === previous.length) return null;
    const removed = previous.filter((b) => drop.has(b.id)).map((b) => b.id);
    return new SetTopoBreaklinesCommand(surfaceId, previous, next, 'remove', removed);
  }

  /** Άδειασε την επιφάνεια από ασυνέχειες. `null` όταν ήδη δεν έχει. */
  static clear(surfaceId: TopoSurfaceId): SetTopoBreaklinesCommand | null {
    const previous = getTopoBreaklines(surfaceId);
    if (previous.length === 0) return null;
    return new SetTopoBreaklinesCommand(surfaceId, previous, [], 'clear', previous.map((b) => b.id));
  }

  /**
   * ADR-920 Β3.6 — Civil 3D «Crossing Breaklines» › Resolve, για Ν σημεία συνάντησης σε ΕΝΑ βήμα (Ν = 1 από τη
   * γραμμή μιας σύγκρουσης, Ν > 1 από το «Επίλυση όλων»). Κάθε απόφαση αντικαθιστά όποια υπήρχε για το ίδιο σημείο.
   * `null` όταν όλες είναι ήδη αποθηκευμένες ακριβώς έτσι.
   */
  static resolve(
    surfaceId: TopoSurfaceId,
    decisions: readonly { readonly ownerBreaklineId: string; readonly resolution: BreaklineCrossingResolution }[],
  ): SetTopoBreaklinesCommand | null {
    const previous = getTopoBreaklines(surfaceId);
    const next = decisions.reduce(
      (acc, d) => withCrossingResolution(acc, d.ownerBreaklineId, d.resolution), previous,
    );
    if (next === previous) return null;
    return new SetTopoBreaklinesCommand(
      surfaceId, previous, next, 'resolve', [...new Set(decisions.map((d) => d.ownerBreaklineId))],
    );
  }

  /** ADR-920 Β3.6 — πίσω στο «νικά η πρώτη» για αυτά τα σημεία (ή πέτα αποφάσεις που δεν εφαρμόζονται πια). */
  static unresolve(surfaceId: TopoSurfaceId, keys: readonly CrossingResolutionKey[]): SetTopoBreaklinesCommand | null {
    const previous = getTopoBreaklines(surfaceId);
    const next = withoutCrossingResolutions(previous, keys);
    if (next === previous) return null;
    return new SetTopoBreaklinesCommand(
      surfaceId, previous, next, 'unresolve', [...new Set(keys.map((k) => k.ownerBreaklineId))],
    );
  }

  execute(): void {
    setTopoBreaklines(this.next, this.surfaceId);
  }

  undo(): void {
    setTopoBreaklines(this.previous, this.surfaceId);
  }

  getDescription(): string {
    return `${this.edit} ${this.touchedIds.length} breakline(s) on surface «${this.surfaceId}»`;
  }

  /** Οι οντότητες-πηγή των ασυνεχειών που άλλαξαν (όσες προήλθαν από γραμμή του σχεδίου). */
  getAffectedEntityIds(): string[] {
    const touched = new Set(this.touchedIds);
    const sources = [...this.previous, ...this.next].flatMap((b) =>
      touched.has(b.id) && b.sourceEntityId !== undefined ? [b.sourceEntityId] : [],
    );
    return [...new Set(sources)];
  }

  protected serializeData(): Record<string, unknown> {
    return { surfaceId: this.surfaceId, edit: this.edit, breaklineIds: [...this.touchedIds] };
  }
}
