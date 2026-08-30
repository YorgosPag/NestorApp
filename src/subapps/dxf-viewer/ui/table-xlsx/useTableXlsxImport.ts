'use client';

/**
 * ADR-833 §1.4 → **Φάση 4** — **τι γίνεται με το αρχείο `.xlsx` που διάλεξε ο χρήστης.**
 *
 * Δύο εντολές, δύο προθέσεις, **μία** διαδρομή ανάγνωσης:
 *
 * ```
 *   Άνοιγμα           →  ο πίνακας ΓΙΝΕΤΑΙ το αρχείο   →  ρωτά: αντικατάσταση, φύλλα, ή νέος;
 *   Εισαγωγή αρχείου  →  το αρχείο ΠΡΟΣΤΙΘΕΤΑΙ         →  δεν ρωτά ποτέ, τίποτα δεν χάνεται
 * ```
 *
 * ## 🔴 ΤΟ ΓΝΩΣΤΟ ΕΝΔΙΑΜΕΣΟ ΕΚΛΕΙΣΕ — «ένα βιβλίο μέσα, ένα βιβλίο έξω»
 *
 * Η Φάση 1 είχε γράψει την υπόσχεση αυτούσια: *«Η τελική σημασιολογία της «Εισαγωγής» είναι
 * **νέα φύλλα εργασίας στον ίδιο πίνακα** […] Σήμερα το `TableEntity` **δεν έχει φύλλα**,
 * οπότε το ίδιο συμβόλαιο εκφράζεται με τον μόνο τρόπο που υπάρχει: νέα οντότητα πίνακα δίπλα
 * στην υπάρχουσα.»* Τα φύλλα ήρθαν στη Φάση 2· εδώ η υπόσχεση γίνεται κώδικας.
 *
 * ⚠️ Η **ανάγνωση** δεν άλλαξε ούτε γραμμή: το `readXlsxWorksheets` επέστρεφε **πάντα** όλα τα
 * φύλλα του βιβλίου, στη σειρά, με τα ονόματά τους. Αυτό που έφυγε είναι μια **σιωπή**: ο
 * καλών κρατούσε επίτηδες μόνο το πρώτο και το έλεγε με μήνυμα (`tableXlsx.onlyFirstSheet`).
 * Το κλειδί σβήστηκε μαζί με τον λόγο ύπαρξής του.
 *
 * ## Καμία σιωπηλή απώλεια — ο κανόνας μένει ακέραιος
 * Ό,τι δεν χώρεσε **λέγεται με αριθμό**, και τώρα αθροίζεται σε **ολόκληρο** το βιβλίο: ένα
 * φύλλο 2000 γραμμών ανάμεσα σε δώδεκα δεν επιτρέπεται να κοπεί χωρίς να το μάθει κανείς
 * επειδή τα υπόλοιπα έντεκα χώρεσαν.
 *
 * @module subapps/dxf-viewer/ui/table-xlsx/useTableXlsxImport
 * @see bim/table/import/xlsx-to-worksheets.ts — ο αναγνώστης (αμετάβλητος από τη Φάση 1)
 * @see bim/table/import/worksheet-to-model.ts — πλέγμα → μοντέλο
 * @see bim/table/table-worksheet-ops.ts — πού προσγειώνονται τα φύλλα (οι δύο σχεδιαστές)
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { readXlsxWorksheets } from '../../bim/table/import/xlsx-to-worksheets';
import { workbookToWorksheetDrafts } from '../../bim/table/import/workbook-to-worksheet-drafts';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateEntityCommand } from '../../core/commands/entity-commands/CreateEntityCommand';
import { computeTableEntityGeometryLive } from '../../bim/table/table-entity-geometry';
import { requestTableXlsxOpenConfirm } from '../../bim/table/table-xlsx-open-confirm-store';
import { tableWorksheetsPatch } from '../../bim/table/table-worksheet-write';
import { buildTableWorksheetCommand } from '../../bim/table/table-worksheet-command';
import {
  buildWorksheets,
  planWorksheetsAppend,
  planWorksheetsReplace,
  type TableWorksheetDraft,
} from '../../bim/table/table-worksheet-ops';
import type { TableEntity } from '../../types/table-entity';
import type { ICommand } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { SceneEntity } from '../../hooks/canvas/dxf-scene-entity-converter';
import type { SceneUnits } from '../../utils/scene-units';

/** Τα δεκτά αρχεία — και οι δύο μορφές βιβλίου του Excel (με και χωρίς μακροεντολές). */
export const TABLE_XLSX_ACCEPT = '.xlsx,.xlsm';

/** Το κενό ανάμεσα στον υπάρχοντα πίνακα και τον νέο, σε **μονάδες σκηνής**. */
const NEW_TABLE_GAP_SCENE = 5;

export interface UseTableXlsxImportParams {
  readonly levelManager: LevelManagerLike;
  readonly execute: (command: ICommand) => void;
  /** Ο επιλεγμένος πίνακας τη στιγμή του πατήματος — `null` ⇒ καμία πράξη. */
  readonly getSelectedTable: () => TableEntity | null;
  readonly sceneUnits: SceneUnits;
  readonly notify: (message: string) => void;
}

export interface TableXlsxImport {
  readonly onOpenFilePicked: (file: File) => Promise<void>;
  readonly onImportFilePicked: (file: File) => Promise<void>;
}

/**
 * Πού κάθεται ο νέος πίνακας: **δεξιά** του υπάρχοντος, με κενό.
 *
 * Το πλάτος έρχεται από τη ζωντανή γεωμετρία (την ίδια που ζωγραφίζει ο renderer), όχι από
 * υπολογισμό εδώ: δύο υπολογισμοί πλάτους είναι δύο ευκαιρίες να πέσει ο νέος πίνακας πάνω
 * στον παλιό.
 */
function nextTablePosition(source: TableEntity, sceneUnits: SceneUnits): { x: number; y: number } {
  const { bbox } = computeTableEntityGeometryLive(source, sceneUnits);
  return { x: bbox.maxX + NEW_TABLE_GAP_SCENE, y: source.position.y };
}

export function useTableXlsxImport(params: UseTableXlsxImportParams): TableXlsxImport {
  const { levelManager, execute, getSelectedTable, sceneUnits, notify } = params;
  const { t } = useTranslation('dxf-viewer-shell');

  /**
   * Η κοινή διαδρομή: αρχείο → **όλα** τα φύλλα → προσχέδια, με αναφορά για ό,τι κόπηκε.
   * `null` όταν το βιβλίο δεν έχει κανένα φύλλο (και το λέει).
   *
   * ⚠️ Το κόψιμο αθροίζεται σε **ολόκληρο** το βιβλίο και αναφέρεται **μία** φορά: δώδεκα
   * μηνύματα για δώδεκα φύλλα θα ήταν θόρυβος που ο χρήστης κλείνει χωρίς να διαβάσει —
   * δηλαδή η σιωπηλή απώλεια θα επέστρεφε από την πίσω πόρτα.
   */
  const readAllSheets = useCallback(
    async (file: File): Promise<readonly TableWorksheetDraft[] | null> => {
      const sheets = await readXlsxWorksheets(await file.arrayBuffer());
      if (sheets.length === 0) {
        notify(t('tableXlsx.emptyWorkbook'));
        return null;
      }
      // 🔑 Η **μετατροπή** και η **άθροιση του κοψίματος** ζουν σε καθαρή συνάρτηση: εδώ μένει
      // μόνο το «ποιος το λέει στον χρήστη», που είναι η μία γνώση που δεν είναι καθαρή.
      const { drafts, droppedRows, droppedColumns } = workbookToWorksheetDrafts(sheets);
      if (droppedRows > 0 || droppedColumns > 0) {
        notify(t('tableXlsx.clipped', { rows: droppedRows, columns: droppedColumns }));
      }
      return drafts;
    },
    [notify, t],
  );

  /** Η **μία** διαδρομή εντολής φύλλων αυτού του hook — ίδιο σχήμα με το `useTableWorksheetApply`. */
  const applyPlan = useCallback(
    (entity: TableEntity, drafts: readonly TableWorksheetDraft[], mode: 'append' | 'replace'): void => {
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const plan = mode === 'append'
        ? planWorksheetsAppend(entity, drafts)
        : planWorksheetsReplace(entity, drafts);
      const command = buildTableWorksheetCommand(entity, plan, sceneManager);
      if (!command) return;
      execute(command);
      notify(t(mode === 'append' ? 'tableXlsx.sheetsAdded' : 'tableXlsx.sheetsReplaced', {
        count: drafts.length,
      }));
    },
    [execute, levelManager, notify, t],
  );

  /**
   * Νέα οντότητα πίνακα δίπλα στην πηγή — μία εντολή, ένα `Ctrl+Z`.
   *
   * ## 🔴 ADR-833 Φάση 2 → 4 — ΤΑ ΦΥΛΛΑ ΕΙΝΑΙ **ΚΑΙΝΟΥΡΓΙΑ**, ΟΧΙ ΑΝΤΙΓΡΑΦΟ
   * Το `...source` δίνει στρώση, στυλ, γωνία — ό,τι είναι ιδιότητα του **χαρτιού**. Τα φύλλα
   * **δεν** κληρονομούνται: ο νέος πίνακας γεννιέται με **τα φύλλα του αρχείου**, όλα τους.
   * Χωρίς τη ρητή αντικατάσταση, ο νέος πίνακας θα ξεκινούσε με **αντίγραφο των φύλλων της
   * πηγής** — μαζί με τον δεσμό τους σε πηγή δεδομένων που δεν τον αφορά.
   *
   * Το `tableWorksheetsPatch` καθαρίζει ταυτόχρονα ό,τι κουβαλά η πηγή από την **παλιά** μορφή:
   * ένα `model` που θα ταξίδευε μέσα από το `...source` θα ήταν μπαγιάτικος καθρέφτης πάνω σε
   * ολοκαίνουργια οντότητα.
   */
  const createTableBeside = useCallback(
    (source: TableEntity, drafts: readonly TableWorksheetDraft[]): void => {
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const worksheets = buildWorksheets(drafts);
      const entityData: Omit<SceneEntity, 'id'> = {
        ...source,
        position: nextTablePosition(source, sceneUnits),
        ...tableWorksheetsPatch(source, worksheets),
        activeWorksheetId: worksheets[0].id,
        // Η παράγωγη γεωμετρία ΔΕΝ αντιγράφεται: ξαναϋπολογίζεται από το νέο μοντέλο, και ένα
        // αντίγραφο της παλιάς θα ήταν μπαγιάτικο πλαίσιο γύρω από άλλα δεδομένα.
        geometry: undefined,
      } as unknown as Omit<SceneEntity, 'id'>;
      execute(new CreateEntityCommand(entityData, sceneManager));
      notify(t('tableXlsx.sheetsReplaced', { count: worksheets.length }));
    },
    [execute, levelManager, notify, sceneUnits, t],
  );

  const onOpenFilePicked = useCallback(
    async (file: File): Promise<void> => {
      const entity = getSelectedTable();
      if (!entity) return;
      const drafts = await readAllSheets(file);
      if (!drafts) return;
      // 🔴 Η ερώτηση γίνεται **αφού** διαβαστεί το αρχείο: ένας διάλογος «αντικατάσταση;» για
      // αρχείο που τελικά δεν διαβάζεται θα ήταν ερώτηση χωρίς αντικείμενο.
      const action = await requestTableXlsxOpenConfirm({ fileName: file.name });
      if (action === 'replace') applyPlan(entity, drafts, 'replace');
      else if (action === 'add-sheets') applyPlan(entity, drafts, 'append');
      else if (action === 'new-table') createTableBeside(entity, drafts);
    },
    [applyPlan, createTableBeside, getSelectedTable, readAllSheets],
  );

  const onImportFilePicked = useCallback(
    async (file: File): Promise<void> => {
      const entity = getSelectedTable();
      if (!entity) return;
      const drafts = await readAllSheets(file);
      if (!drafts) return;
      // Καμία ερώτηση: η «Εισαγωγή» δεν αγγίζει τίποτα υπάρχον, εξ ορισμού.
      applyPlan(entity, drafts, 'append');
    },
    [applyPlan, getSelectedTable, readAllSheets],
  );

  return { onOpenFilePicked, onImportFilePicked };
}
