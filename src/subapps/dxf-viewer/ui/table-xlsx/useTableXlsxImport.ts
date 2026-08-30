'use client';

/**
 * ADR-833 §1.4 — **τι γίνεται με το αρχείο `.xlsx` που διάλεξε ο χρήστης.**
 *
 * Δύο εντολές, δύο προθέσεις, **μία** διαδρομή ανάγνωσης:
 *
 * ```
 *   Άνοιγμα           →  ο πίνακας ΓΙΝΕΤΑΙ το αρχείο   →  ρωτά: αντικατάσταση ή νέος;
 *   Εισαγωγή αρχείου  →  το αρχείο ΠΡΟΣΤΙΘΕΤΑΙ         →  δεν ρωτά ποτέ, τίποτα δεν χάνεται
 * ```
 *
 * ## 🔴 Γνωστό ενδιάμεσο (ADR-833 Φάση 1 → Φάση 4)
 *
 * Η τελική σημασιολογία της «Εισαγωγής» είναι **νέα φύλλα εργασίας στον ίδιο πίνακα** — και
 * ένα βιβλίο με τρία φύλλα θα γεμίζει τρεις καρτέλες. Σήμερα το `TableEntity` **δεν έχει
 * φύλλα** (Φάση 2 τα προσθέτει), οπότε το ίδιο συμβόλαιο εκφράζεται με τον μόνο τρόπο που
 * υπάρχει: **νέα οντότητα πίνακα δίπλα στην υπάρχουσα**.
 *
 * Η **αρχή** που ζήτησε ο Giorgio τηρείται ακέραιη και στις δύο εκδοχές — *«κανένα υπάρχον
 * δεδομένο δεν κινδυνεύει»*. Αυτό που αλλάζει στη Φάση 4 είναι **πού** κάθονται τα νέα
 * δεδομένα, όχι το αν επιβιώνουν τα παλιά. Και όσο τα φύλλα λείπουν, ο χρήστης **το μαθαίνει
 * με μήνυμα**, δεν το ανακαλύπτει.
 *
 * @module subapps/dxf-viewer/ui/table-xlsx/useTableXlsxImport
 * @see bim/table/import/xlsx-to-worksheets.ts — ο αναγνώστης
 * @see bim/table/import/worksheet-to-model.ts — πλέγμα → μοντέλο
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { readXlsxWorksheets } from '../../bim/table/import/xlsx-to-worksheets';
import { worksheetGridToModel } from '../../bim/table/import/worksheet-to-model';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateEntityCommand } from '../../core/commands/entity-commands/CreateEntityCommand';
import { buildTableModelCommand } from '../../bim/table/table-cell-edit-session';
import { computeTableEntityGeometryLive } from '../../bim/table/table-entity-geometry';
import { requestTableXlsxOpenConfirm } from '../../bim/table/table-xlsx-open-confirm-store';
import { tableWorksheetsPatch } from '../../bim/table/table-worksheet-write';
import { FIRST_TABLE_WORKSHEET_ID } from '../../types/table-worksheet';
import type { TableWorksheet } from '../../types/table-worksheet';
import type { TableEntity } from '../../types/table-entity';
import type { ICommand } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { SceneEntity } from '../../hooks/canvas/dxf-scene-entity-converter';
import type { SceneUnits } from '../../utils/scene-units';
import type { PersistedTableModel } from '../../types/table';

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
   * Η κοινή διαδρομή: αρχείο → πρώτο φύλλο → μοντέλο, **με αναφορά** για ό,τι δεν χώρεσε.
   * `null` όταν το βιβλίο δεν έχει κανένα φύλλο (και το λέει).
   */
  const readFirstSheet = useCallback(
    async (file: File) => {
      const sheets = await readXlsxWorksheets(await file.arrayBuffer());
      if (sheets.length === 0) {
        notify(t('tableXlsx.emptyWorkbook'));
        return null;
      }
      const result = { ...worksheetGridToModel(sheets[0].grid), name: sheets[0].name };
      // 🔴 Καμία σιωπηλή απώλεια — τρία διαφορετικά «δεν μπήκαν όλα», τρία μηνύματα.
      if (sheets.length > 1) {
        notify(t('tableXlsx.onlyFirstSheet', { count: sheets.length, name: sheets[0].name }));
      }
      if (result.droppedRows > 0 || result.droppedColumns > 0) {
        notify(t('tableXlsx.clipped', {
          rows: result.droppedRows,
          columns: result.droppedColumns,
        }));
      }
      return result;
    },
    [notify, t],
  );

  /**
   * Νέα οντότητα πίνακα δίπλα στην πηγή — μία εντολή, ένα `Ctrl+Z`.
   *
   * ## 🔴 ADR-833 Φάση 2 — ΤΟ ΦΥΛΛΟ ΕΙΝΑΙ **ΚΑΙΝΟΥΡΓΙΟ**, ΟΧΙ ΑΝΤΙΓΡΑΦΟ
   * Το `...source` δίνει στρώση, στυλ, γωνία — ό,τι είναι ιδιότητα του **χαρτιού**. Τα φύλλα
   * **δεν** κληρονομούνται: ο νέος πίνακας γεννιέται με **ένα** φύλλο, το φύλλο του αρχείου.
   * Χωρίς τη ρητή αντικατάσταση, ο νέος πίνακας θα ξεκινούσε με **αντίγραφο των φύλλων της
   * πηγής** — μαζί με τον δεσμό τους σε πηγή δεδομένων που δεν τον αφορά.
   *
   * Το `tableWorksheetsPatch` καθαρίζει ταυτόχρονα ό,τι κουβαλά η πηγή από την **παλιά** μορφή:
   * ένα `model` που θα ταξίδευε μέσα από το `...source` θα ήταν μπαγιάτικος καθρέφτης πάνω σε
   * ολοκαίνουργια οντότητα.
   *
   * ✅ **Το όνομα του φύλλου του Excel επιβιώνει.** Το βιβλίο μας είπε πώς λέγεται το φύλλο· ένα
   * νεογέννητο φύλλο δεν έχει όνομα που να διακινδυνεύει, οπότε το υιοθετεί. (Η «αντικατάσταση
   * περιεχομένου» δεν το κάνει — εκεί το φύλλο **υπάρχει** και το όνομά του μπορεί να είναι
   * επιλογή του χρήστη. Δεδομένο χρήστη δεν ξαναγράφεται ποτέ σιωπηλά.)
   */
  const createTableBeside = useCallback(
    (source: TableEntity, model: PersistedTableModel, worksheetName: string): void => {
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const worksheet: TableWorksheet = worksheetName
        ? { id: FIRST_TABLE_WORKSHEET_ID, name: worksheetName, model }
        : { id: FIRST_TABLE_WORKSHEET_ID, model };
      const entityData: Omit<SceneEntity, 'id'> = {
        ...source,
        position: nextTablePosition(source, sceneUnits),
        ...tableWorksheetsPatch(source, [worksheet]),
        activeWorksheetId: FIRST_TABLE_WORKSHEET_ID,
        // Η παράγωγη γεωμετρία ΔΕΝ αντιγράφεται: ξαναϋπολογίζεται από το νέο μοντέλο, και ένα
        // αντίγραφο της παλιάς θα ήταν μπαγιάτικο πλαίσιο γύρω από άλλα δεδομένα.
        geometry: undefined,
      } as unknown as Omit<SceneEntity, 'id'>;
      execute(new CreateEntityCommand(entityData, sceneManager));
    },
    [execute, levelManager, sceneUnits],
  );

  /** Αντικατάσταση του περιεχομένου του **ίδιου** πίνακα — η ΜΙΑ διαδρομή commit (§6.6). */
  const replaceModel = useCallback(
    (entity: TableEntity, model: PersistedTableModel): void => {
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const command = buildTableModelCommand(entity, model, sceneManager);
      if (command) execute(command);
    },
    [execute, levelManager],
  );

  const onOpenFilePicked = useCallback(
    async (file: File): Promise<void> => {
      const entity = getSelectedTable();
      if (!entity) return;
      const result = await readFirstSheet(file);
      if (!result) return;
      // 🔴 Η ερώτηση γίνεται **αφού** διαβαστεί το αρχείο: ένας διάλογος «αντικατάσταση;» για
      // αρχείο που τελικά δεν διαβάζεται θα ήταν ερώτηση χωρίς αντικείμενο.
      const action = await requestTableXlsxOpenConfirm({ fileName: file.name });
      if (action === 'replace') replaceModel(entity, result.model);
      else if (action === 'new-table') createTableBeside(entity, result.model, result.name);
    },
    [createTableBeside, getSelectedTable, readFirstSheet, replaceModel],
  );

  const onImportFilePicked = useCallback(
    async (file: File): Promise<void> => {
      const entity = getSelectedTable();
      if (!entity) return;
      const result = await readFirstSheet(file);
      if (!result) return;
      // Καμία ερώτηση: η «Εισαγωγή» δεν αγγίζει τίποτα υπάρχον, εξ ορισμού.
      createTableBeside(entity, result.model, result.name);
      notify(t('tableXlsx.importedAsNewTable'));
    },
    [createTableBeside, getSelectedTable, notify, readFirstSheet, t],
  );

  return { onOpenFilePicked, onImportFilePicked };
}
