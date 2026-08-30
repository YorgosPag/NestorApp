'use client';

/**
 * 🔴 ADR-833 Φάση 4 — **Η IN-PLACE ΜΕΤΟΝΟΜΑΣΙΑ ΚΑΡΤΕΛΑΣ**, πάνω από τον καμβά.
 *
 * Ο δίδυμος του `OpeningInfoTagEditorOverlay` (ADR-612): ένα `<input>` σε `position: fixed`
 * πάνω από το ορθογώνιο που ζωγράφισε ο καμβάς, **χωρίς props** — όλη η κατάσταση έρχεται από
 * το χαμηλόσυχνο store του, οπότε ο orchestrator δεν αποκτά καμία συνδρομή (ADR-040).
 *
 * ```
 *   Enter / blur → δέσμευση      Esc → ακύρωση      αλλαγή προβολής → δέσμευση
 * ```
 *
 * ## 🔴 ΓΙΑΤΙ Η ΑΛΛΑΓΗ ΠΡΟΒΟΛΗΣ ΔΕΣΜΕΥΕΙ (και δεν ακυρώνει, και δεν αγνοείται)
 * Το ορθογώνιο υπολογίζεται **μία φορά** (δες το store). Ένα pan ή zoom θα το άφηνε καρφωμένο
 * ενώ η καρτέλα του φεύγει από κάτω — το κουτί θα «κρεμόταν» πάνω από άσχετα pixel. Οι τρεις
 * δρόμοι, με το κόστος του καθενός:
 *
 * | επιλογή | τι κοστίζει |
 * |---|---|
 * | ζωντανή αγκύρωση | ολόκληρο κέλυφος (`TextEditorAnchorLayer`) + `containerRef` μέσα από τον orchestrator |
 * | αγνόηση | κουτί ξεκολλημένο από την καρτέλα του — το ελάττωμα που εκείνο το κέλυφος υπάρχει να λύσει |
 * | **δέσμευση** | **μηδέν**: ό,τι πληκτρολογήθηκε κρατιέται, η θέση δεν προλαβαίνει να παλιώσει |
 *
 * Η δέσμευση δεν είναι συμβιβασμός: είναι η ίδια σύμβαση που έχει ήδη το **blur** (κλικ έξω
 * δεσμεύει, δεν πετά), και κάνει τη μπαγιάτικη θέση **δομικά ανέφικτη** αντί για «σπάνια».
 *
 * ## Ο κύκλος πλήκτρων ΔΕΝ ξαναγράφεται
 * `Enter` / `Esc` (μέσω του escape-bus του ADR-364) και ο φύλακας «το πολύ μία φορά» ζουν στο
 * {@link useInlineEditorKeys} — το **ίδιο** SSoT που τρέχει στον επεξεργαστή κελιού και στο
 * info-tag. Τρίτο αντίγραφο θα ήταν sibling clone (N.18), και θα ήταν εκείνο που ξεχνά ότι το
 * `Esc` δεν συγκρίνεται inline.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/TableWorksheetRenameOverlay
 * @see state/table-worksheet-rename-store.ts — η κατάσταση ανοίγματος
 * @see bim/table/table-worksheet-ops.ts — τι σημαίνει «κενό όνομα» (η τρίτη κατάσταση)
 * @see ui/opening-info-tag/OpeningInfoTagEditorOverlay.tsx — ο αδελφός που δίνει το σχήμα
 */

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCommandHistory } from '../../core/commands';
import { useLevels } from '../../systems/levels';
import { subscribeTransform } from '../../systems/cursor/ImmediateTransformStore';
import { planWorksheetRename } from '../../bim/table/table-worksheet-ops';
import { useInlineEditorKeys } from '../inline-editor/use-inline-editor-keys';
import { resolveTableById } from './table-entity-lookup';
import { useTableWorksheetApply } from './use-table-worksheet-apply';
import {
  closeTableWorksheetRename,
  getTableWorksheetRename,
  subscribeTableWorksheetRename,
  type TableWorksheetRenameState,
} from '../../state/table-worksheet-rename-store';

export function TableWorksheetRenameOverlay(): React.ReactElement | null {
  const state = useSyncExternalStore(
    subscribeTableWorksheetRename,
    getTableWorksheetRename,
    getTableWorksheetRename,
  );
  if (!state) return null;
  // Το `key` ξαναστήνει το πεδίο με φρέσκο πρόχειρο σε **κάθε** νέα καρτέλα — ίδιο ιδίωμα με
  // τον αδελφό του: η ταυτότητα της συνεδρίας είναι ο στόχος της.
  return <TableWorksheetRenameInput key={`${state.entityId}:${state.worksheetId}`} state={state} />;
}

function TableWorksheetRenameInput({
  state,
}: {
  readonly state: TableWorksheetRenameState;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const { execute } = useCommandHistory();
  const levelManager = useLevels();
  const applyWorksheet = useTableWorksheetApply({ levelManager, execute });
  const [value, setValue] = useState<string>(state.initialName);

  const handleCommit = useCallback(() => {
    // Η **ζωντανή** οντότητα τη στιγμή της δέσμευσης, ποτέ στιγμιότυπο του ανοίγματος: ο
    // πίνακας μπορεί να έχει αλλάξει όσο το πεδίο ήταν ανοιχτό (autosave, undo, άλλη πράξη).
    const live = resolveTableById(levelManager, state.entityId);
    // 🔑 Ο φύλακας no-op ζει στον **σχεδιαστή**: ίδιο όνομα ⇒ `null` ⇒ καμία εντολή. Μια
    // δεύτερη σύγκριση εδώ θα ήταν δεύτερη άποψη για το «άλλαξε κάτι;» — και θα ήταν εκείνη
    // που ξεχνά το `trim`.
    if (live) applyWorksheet(live, planWorksheetRename(live, state.worksheetId, value));
    closeTableWorksheetRename();
  }, [applyWorksheet, levelManager, state.entityId, state.worksheetId, value]);

  const { commit, onKeyDown } = useInlineEditorKeys({
    id: 'table-worksheet-rename',
    onCommit: handleCommit,
    onCancel: closeTableWorksheetRename,
  });

  // 🔴 Δες την κεφαλίδα: η αλλαγή προβολής **δεσμεύει**. Ο `commit` είναι ιδεμποτής, οπότε ένα
  // pan που φτάνει μετά από `Enter` δεν κάνει τίποτα.
  useEffect(() => subscribeTransform(commit), [commit]);

  return (
    <input
      type="text"
      autoFocus
      value={value}
      placeholder={state.placeholder}
      aria-label={t('table.worksheetRename.fieldLabel')}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
      onFocus={(event) => event.currentTarget.select()}
      className={cn(
        'fixed z-40 box-border px-1 text-center text-xs',
        'rounded-sm border border-primary bg-background text-foreground',
        'outline-none focus:ring-2 focus:ring-primary',
      )}
      style={{
        left: state.anchorRect.x,
        top: state.anchorRect.y,
        width: state.anchorRect.width,
        height: state.anchorRect.height,
      }}
    />
  );
}
