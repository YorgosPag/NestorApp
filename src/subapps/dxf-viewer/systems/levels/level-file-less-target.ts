/**
 * level-file-less-target — τι στόχο αποθήκευσης παίρνει ένα επίπεδο ΧΩΡΙΣ `sceneFileId` (ADR-913).
 *
 * Η απόφαση ζει εδώ και όχι μέσα στο effect του `useLevelSceneLoader`, ώστε να εκτελείται
 * σε test χωρίς React/Firestore: ο loader δίνει μια «θύρα» προς τον auto-save manager και
 * παίρνει πίσω ΜΙΑ απάντηση — `'keep'` (ο στόχος είναι σωστός/άνοιξε) ή `'reset'` (κλείσ' τον).
 *
 * ## Οι κανόνες, με τη σειρά
 *
 *  1. **Εισαγωγή που περιμένει το link της** → ο στόχος της ΔΕΝ σκεπάζεται ποτέ από στόχο
 *     γέννησης. Αν είναι ακόμη ανοιχτός μένει· αν όχι, ο στόχος κλείνει (όπως πριν το ADR-913).
 *  2. **Χωρίς κάτοχο** (επίπεδο ακινήτου, ή άγνωστη εταιρεία) → κλειστός, όπως πριν.
 *  3. **Στόχος που έχει κριθεί ορφανός/αποσυρμένος** αυτή τη συνεδρία → κλειστός (ADR-469).
 *  4. **Ήδη ανοιχτός ο ίδιος στόχος** → τίποτα (καμία επανεγγραφή state ανά `levels` snapshot).
 *  5. Αλλιώς ανοίγει ο στόχος γέννησης ΤΟΥ ΙΔΙΟΥ του επιπέδου — ποτέ κληρονομημένος από το
 *     προηγούμενο επίπεδο, άρα ο κανόνας του ADR-399 ισχύει ακέραιος.
 *
 * @module subapps/dxf-viewer/systems/levels/level-file-less-target
 * @see docs/centralized-systems/reference/adrs/ADR-913-level-drawing-birth.md
 */

import type { DxfSaveContext } from '../../services/dxf-firestore.types';
import { resolveLevelDrawingBirthTarget, type DrawingBearingLevel } from './level-drawing-birth';

/** Ό,τι χρειάζεται η απόφαση από τον auto-save manager (δομικό υποσύνολό του). */
export interface FileTargetPort {
  readonly fileRecordId: string | null;
  readonly saveContext: DxfSaveContext | null;
  getPendingLevelFileTarget(levelId: string): string | null;
  isFileTargetOrphaned(fileId: string | null | undefined): boolean;
  markFileTargetUnborn(fileId: string, birthContext: DxfSaveContext): void;
  setSaveContext(ctx: DxfSaveContext | null): void;
  setCurrentFileName(fileName: string | null): void;
  setFileRecordId(id: string | null): void;
}

/** `'keep'` = ο στόχος είναι ο σωστός· `'reset'` = ο καλών πρέπει να τον κλείσει. */
export type FileLessTargetDecision = 'keep' | 'reset';

export function openFileLessLevelTarget(
  port: FileTargetPort,
  level: DrawingBearingLevel | null | undefined,
  companyId: string | null | undefined,
): FileLessTargetDecision {
  if (!level) return 'reset';

  const pendingImport = port.getPendingLevelFileTarget(level.id);
  if (pendingImport) return port.fileRecordId === pendingImport ? 'keep' : 'reset';

  const birth = resolveLevelDrawingBirthTarget(level, companyId);
  if (!birth || port.isFileTargetOrphaned(birth.fileId)) return 'reset';

  const alreadyOpen =
    port.fileRecordId === birth.fileId
    && port.saveContext?.canonicalScenePath === birth.saveContext.canonicalScenePath;
  if (alreadyOpen) return 'keep';

  // Σειρά: πρώτα το context γέννησης (ταξιδεύει με το ticket), μετά όνομα, τελευταίο το id —
  // το `setFileRecordId` κλειδώνει cache με το όνομα και το context που βρίσκει ήδη στη θέση τους.
  port.markFileTargetUnborn(birth.fileId, birth.saveContext);
  port.setSaveContext(birth.saveContext);
  port.setCurrentFileName(birth.fileName);
  port.setFileRecordId(birth.fileId);
  return 'keep';
}
