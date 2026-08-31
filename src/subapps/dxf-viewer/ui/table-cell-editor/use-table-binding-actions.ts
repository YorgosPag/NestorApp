'use client';

/**
 * 🔴 ADR-767 Δ3 — **Η ΡΗΤΗ ΕΝΕΡΓΕΙΑ**: το «Ανανέωση» αποκτά σημείο εισόδου.
 *
 * ## Καμία νέα μηχανή — μόνο νέα πόρτα
 * Κάθε γραμμή εδώ δείχνει σε κώδικα που **υπάρχει και είναι ελεγμένος** από τις 07/08:
 *
 * ```
 *   τα δεδομένα      → readTableSourceContext        (binding/table-source-context)
 *   η ανανέωση       → refreshTableBinding           (binding/table-binding-refresh) ← οι 4 φάσεις του §5
 *   η ετυμηγορία     → setTableBindingFreshness      (state/table-binding-freshness-store)
 *   η δέσμευση       → buildTableBindingRefreshCommand (table-cell-edit-session)
 * ```
 *
 * Ό,τι είναι όντως καινούριο είναι **η μετάφραση**: τι σημαίνει κάθε μία από τις τέσσερις
 * εκβάσεις της ανανέωσης για την **οθόνη**. Αυτή είναι μία `switch` και ζει εδώ.
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΑΥΤΟΜΑΤΗ ΑΝΑΝΕΩΣΗ
 * Το Δ3 είναι **απόφαση του Giorgio** (06/08) και δεσμευτική: ο πίνακας δεν ξαναγεμίζει
 * **ποτέ** μόνος του. Δεν είναι παράλειψη ούτε «επόμενο βήμα»:
 *
 *  - θα απαιτούσε **ανά-οντότητα ειδοποίηση αλλαγής** που **δεν υπάρχει** (το `SceneStore`
 *    μετρά ανά level — κάθε μετακίνηση τοίχου θα κήρυσσε μπαγιάτικο τον πίνακα συντεταγμένων)·
 *  - και θα άλλαζε **νούμερα κάτω από τα χέρια του χρήστη**, πάνω σε σχέδιο που υπογράφεται.
 *
 * ⛔ Αν βρεθείς να γράφεις `subscribe…(() => refresh())`, **σταμάτα**: αυτό είναι η Φ.Η.
 *
 * ## 🔴 Ο ΕΛΕΓΧΟΣ ΔΕΝ ΕΙΝΑΙ ΑΝΑΝΕΩΣΗ
 * Το {@link TableBindingPort.refresh} **γράφει**· το {@link TableBindingPort.check} μόνο
 * **ρωτά**. Η διάκριση είναι η ίδια που κάνει το Δ3 συνεπές: το Δ3 απαγορεύει στον πίνακα να
 * **ξαναγεμίσει** μόνος του, όχι στην εφαρμογή να **κοιτάξει**. Ένας έλεγχος δεν αγγίζει το
 * μοντέλο, δεν γεννά βήμα undo, και είναι ο μόνος τρόπος η ένδειξη «μπαγιάτικος» να λέει
 * κάτι αντί να είναι διακοσμητική.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-binding-actions
 * @see ui/table-cell-editor/table-format-port.ts — η θύρα που τα δημοσιεύει
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ3, §5
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { buildTableBindingRefreshCommand } from '../../bim/table/table-cell-edit-session';
import { refreshTableBinding } from '../../bim/table/binding/table-binding-refresh';
import { assessTableFreshness } from '../../bim/table/binding/table-binding-state';
import { readTableSourceContext } from '../../bim/table/binding/table-source-context';
import {
  clearTableBindingFreshness,
  setTableBindingFreshness,
} from '../../state/table-binding-freshness-store';
import { subscribeTopo } from '../../systems/topography/TopoPointStore';
import { useCommandHistory } from '../../core/commands';
import type { TableBindingRefreshResult } from '../../bim/table/binding/table-binding-refresh';
import type { TableFreshness } from '../../bim/table/binding/table-binding-state';
import type { TableEntity } from '../../types/table-entity';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import { tableEntityFormulaBook } from '../../bim/table/table-worksheet-book';
import { activeTableBinding, activeTableModel } from '../../bim/table/table-worksheet-resolve';

/** Ό,τι μπορεί να ζητήσει μια επιφάνεια για τον **δεσμό** ενός πίνακα. */
export interface TableBindingPort {
  /**
   * Δηλώνει ο πίνακας δεσμό; — **η παρουσία**, ποτέ η φρεσκάδα.
   *
   * Οδηγεί την ορατότητα του panel «Δεδομένα»: απόν panel αντί για γκρίζο κουμπί, ο ίδιος
   * κανόνας «μην υπόσχεσαι ό,τι δεν κάνεις» που κρύβει ήδη τα «Γραμμές & Στήλες» χωρίς δρομέα.
   */
  readonly isBound: () => boolean;
  /**
   * Η **ρητή ενέργεια** του Δ3: ξαναρώτα την πηγή και γράψε ό,τι απαντήσει.
   *
   * Μία εντολή, ένα `Ctrl+Z` — και **καμία** εντολή όταν τα δεδομένα βγήκαν ίδια (early
   * cutoff, Δ5). Παρακαμμένα κελιά **δεν πατιούνται**: δηλώνονται ως σύγκρουση (Δ2).
   */
  readonly refresh: () => void;
  /** Ρωτά **χωρίς να γράψει** — ενημερώνει μόνο την ένδειξη οθόνης. */
  readonly check: () => void;
}

export interface UseTableBindingActionsParams {
  readonly levelManager: LevelManagerLike;
  /** Ο πίνακας **τη στιγμή της κλήσης** — ποτέ στιγμιότυπο απόδοσης (ADR-040 κανόνας #2). */
  readonly table: () => TableEntity | null;
}

/**
 * Τι σημαίνει κάθε έκβαση της ανανέωσης για την **ένδειξη οθόνης**.
 *
 * 🔴 Το `no-bound-columns` επιστρέφει `null` επίτηδες, και **δεν** είναι παράλειψη: ο πίνακας
 * δηλώνει δεσμό αλλά καμία στήλη του δεν έχει `sourceKey`, δηλαδή η πηγή επιλύθηκε μια χαρά
 * και απλώς **δεν υπάρχει πού να γραφτεί**. Αυτό είναι πρόβλημα **διαμόρφωσης**, όχι δήλωση
 * φρεσκάδας — και μια αυθαίρετη μετάφρασή του σε «fresh» ή «stale» θα ήταν ισχυρισμός που
 * κανείς δεν μέτρησε (η κλάση «0 = κανείς δεν κοίταξε», N.11/N.12).
 */
function freshnessOf(result: TableBindingRefreshResult): TableFreshness | null {
  switch (result.status) {
    // Και οι δύο σημαίνουν «ο πίνακας συμφωνεί με την πηγή **τώρα**»: το πρώτο γιατί
    // συμφωνούσε ήδη, το δεύτερο γιατί μόλις γράφτηκε ό,τι είπε η πηγή.
    case 'unchanged':
    case 'refreshed':
      return { status: 'fresh' };
    case 'unresolved':
      return { status: 'unknown', reason: result.reason };
    case 'no-bound-columns':
      return null;
  }
}

export function useTableBindingActions(
  params: UseTableBindingActionsParams,
): TableBindingPort {
  const { levelManager, table } = params;
  const { execute } = useCommandHistory();

  const refresh = useCallback(() => {
    const live = table();
    const binding = live ? activeTableBinding(live) : undefined;
    if (!live || !binding) return;

    // Τα δεδομένα διαβάζονται **τη στιγμή του πατήματος** από τη ΜΙΑ γέφυρα — όχι από
    // στιγμιότυπο render, που θα ήταν μπαγιάτικο ακριβώς όταν έχει σημασία.
    const result = refreshTableBinding({
      book: tableEntityFormulaBook(live),
      model: activeTableModel(live),
      binding,
      context: readTableSourceContext(),
    });

    const verdict = freshnessOf(result);
    if (verdict) setTableBindingFreshness(live.id, verdict);
    else clearTableBindingFreshness(live.id);

    // ⚠️ Ίδιο μονοπάτι με το `setStyleId` και **όχι** το `useLiveTableMutation`: εκείνο
    // γράφει μόνο `model`, ενώ η ανανέωση αλλάζει `model` **και** `binding` μαζί. Ο φύλακας
    // του no-op ζει στο `buildTableBindingRefreshCommand`, όπου ελέγχονται **και τα δύο**.
    const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
    if (!currentLevelId || !setLevelScene) return;
    const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
    const command = buildTableBindingRefreshCommand(live, result.model, result.binding, sceneManager);
    if (command) execute(command);
  }, [table, levelManager, execute]);

  const check = useCallback(() => {
    const live = table();
    const binding = live ? activeTableBinding(live) : undefined;
    if (!live || !binding) return;
    setTableBindingFreshness(live.id, assessTableFreshness(binding, readTableSourceContext()));
  }, [table]);

  /**
   * 🔴 **Ο ΚΑΤΑΝΑΛΩΤΗΣ ΤΟΥ ΕΛΕΓΧΟΥ** — αλλιώς το `check` θα ήταν πεδίο χωρίς αναγνώστη (§8 #7).
   *
   * Δύο σκανδάλες, και οι δύο **χαμηλής συχνότητας**:
   *
   *  1. **άλλαξε ο πίνακας** (άλλη οντότητα, ή νέο μοντέλο από undo/ανανέωση) — ο έλεγχος
   *     αφορά *αυτόν*, οπότε μια μπαγιάτικη ετυμηγορία θα έδειχνε σε άλλον·
   *  2. **άλλαξε η αποτύπωση** — η **μόνη** σκανδάλη που όντως κάνει έναν πίνακα μπαγιάτικο.
   *     Χωρίς αυτήν, ο χρήστης θα μετακινούσε κορυφή και η ένδειξη θα έμενε πράσινη μέχρι την
   *     επόμενη επιλογή, δηλαδή θα ήταν **διακοσμητική** ακριβώς στο σενάριο για το οποίο
   *     γράφτηκε.
   *
   * ## 🔴 ΔΕΝ ΠΑΡΑΒΙΑΖΕΙ ΤΟ Δ3 — και η διάκριση είναι η ουσία
   * Το Δ3 απαγορεύει στον πίνακα να **ξαναγεμίσει** μόνος του (γραφή, νέα νούμερα κάτω από τα
   * χέρια του χρήστη, βήμα undo). Δεν απαγορεύει στην εφαρμογή να **κοιτάξει**: ο έλεγχος δεν
   * αγγίζει το μοντέλο, δεν γεννά εντολή, και είναι ο μόνος τρόπος να πει η οθόνη κάτι
   * αληθές. ⛔ Αν γράψεις εδώ `refresh()` αντί για `check()`, **ακύρωσες το Δ3.**
   *
   * ## Μηδέν re-render
   * Το `check()` γράφει σε **store**, όχι σε React state (ο μόνος αναγνώστης είναι ο καμβάς).
   * Άρα ούτε η συνδρομή ούτε το effect προκαλούν απόδοση — ο κανόνας του ADR-040 για τον
   * ξενιστή αυτής της θύρας (`CanvasSection`) μένει άθικτος. Η αποτύπωση αλλάζει με
   * **εντολές** του χρήστη (μετακίνηση κορυφής, εισαγωγή), όχι ανά καρέ.
   */
  const lastChecked = useRef<{ id: string; model: unknown } | null>(null);
  useEffect(() => {
    const live = table();
    if (!live || !activeTableBinding(live)) return;
    const previous = lastChecked.current;
    if (previous?.id === live.id && previous.model === activeTableModel(live)) return;
    lastChecked.current = { id: live.id, model: activeTableModel(live) };
    check();
  });

  useEffect(() => subscribeTopo(check), [check]);

  return useMemo<TableBindingPort>(
    () => ({
      isBound: () => {
        const live = table();
        return live !== null && activeTableBinding(live) !== undefined;
      },
      refresh,
      check,
    }),
    [table, refresh, check],
  );
}
