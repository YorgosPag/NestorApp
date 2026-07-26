/**
 * execute-scene-save — ο async εκτελεστής μιας προγραμματισμένης εγγραφής σκηνής (ADR-714).
 *
 * ## Ο κανόνας του module
 *
 * **Καμία πρόσβαση σε React refs / hooks / ambient state.** Ό,τι χρειάζεται η εγγραφή
 * ζει στο {@link SceneSaveTicket} που πάγωσε τη στιγμή του scheduling. Αυτό είναι ολόκληρη
 * η ουσία του ADR-714: πριν, το σώμα αυτής της λογικής ζούσε μέσα στο `setTimeout` του
 * `useAutoSaveSceneManager` και διάβαζε `injectedFileRecordIdRef.current` **2000ms μετά**
 * το scheduling — οπότε μια εναλλαγή ορόφου ενδιάμεσα άλλαζε τον προορισμό και η σκηνή
 * του ορόφου Α γραφόταν στο αρχείο του ορόφου Β.
 *
 * Εξήχθη επίσης για λόγους N.7.1: η `setLevelSceneWithAutoSave` ήταν 154 γραμμές με
 * ~107 από αυτές μέσα στο timeout (όριο: 40).
 *
 * ## Οι δύο φρουροί πριν την εγγραφή
 *
 * 1. **Floor-scope** — ο προορισμός επαληθεύεται ότι ανήκει στον όροφο του ticket.
 *    Ντετερμινιστικό· δεν στηρίζεται σε ονόματα αρχείων.
 * 2. **DXF wipe** — μπλοκάρει εγγραφή που μηδενίζει τη DXF γεωμετρία ενός αρχείου που
 *    την είχε (βλ. {@link isDxfWipe} για το γιατί «μηδέν» και όχι ποσοστό).
 *
 * @module subapps/dxf-viewer/hooks/scene/execute-scene-save
 * @see docs/centralized-systems/reference/adrs/ADR-714-level-scene-write-identity.md
 */

import { DxfFirestoreService, type DxfSaveContext } from '../../services/dxf-firestore.service';
import { stripForeignFloorBim } from '../../systems/levels/scene-bim-load-policy';
import { isCrossFloorSceneLink } from '../../systems/levels/cross-floor-link';
import {
  countDxfEntities,
  isDxfWipe,
  ticketIdentity,
  type SceneSaveTicket,
} from './scene-save-ticket';

/** Γιατί ματαιώθηκε μια εγγραφή. Και οι δύο τιμές έχουν i18n μήνυμα προς τον χρήστη. */
export type SceneSaveBlockReason = 'cross-floor-target' | 'dxf-wipe';

/** Γιατί παραλείφθηκε σιωπηλά μια εγγραφή (αναμενόμενο, χωρίς μήνυμα χρήστη). */
export type SceneSaveSkipReason = 'orphaned-target' | 'unresolvable-target';

export type SceneSaveOutcome =
  | {
      readonly status: 'saved';
      readonly ticket: SceneSaveTicket;
      readonly fileId: string;
      /** `null` όταν το save έτρεξε χωρίς γνωστό path (ADR-293 error path). */
      readonly canonicalScenePath: string | null;
      /** Οι DXF οντότητες που μόλις γράφτηκαν — γίνεται το νέο baseline του φρουρού. */
      readonly dxfCount: number;
    }
  | { readonly status: 'blocked'; readonly reason: SceneSaveBlockReason }
  | { readonly status: 'skipped'; readonly reason: SceneSaveSkipReason }
  | { readonly status: 'failed'; readonly error: unknown };

export interface ExecuteSceneSaveDeps {
  /** Πόσες DXF οντότητες ξέρουμε ότι έχει ήδη ο προορισμός `fileId` (0 = άγνωστο). */
  readonly getBaselineDxfCount: (fileId: string) => number;
  /** ADR-469 v1.2 — latch ενός fileId του οποίου το backing doc χάθηκε. */
  readonly markFileTargetOrphaned: (fileId: string) => void;
}

/** Ο επιλυμένος προορισμός μιας εγγραφής. */
interface ResolvedTarget {
  readonly fileId: string;
  readonly canonicalScenePath: string | null;
}

/**
 * Επιλύει τον προορισμό ενός ticket που ήδη κουβαλά `fileId`.
 *
 * Επιστρέφει `'orphaned'` όταν το backing doc λείπει (ADR-469 belt #2) και
 * `'cross-floor'` όταν το αρχείο ανήκει σε άλλον όροφο — ο φρουρός που έλειπε πριν το
 * ADR-714 από το write path (υπήρχε μόνο στο read, `useLevelSceneLoader`).
 */
async function resolveKnownFileTarget(
  ticket: SceneSaveTicket,
  fileId: string,
): Promise<ResolvedTarget | 'orphaned' | 'cross-floor'> {
  if (ticket.canonicalScenePath) {
    // Path ήδη γνωστό, αλλά η ιδιοκτησία ΠΡΕΠΕΙ να επαληθευτεί ούτως ή άλλως —
    // ένα cached path δεν αποδεικνύει ότι ο προορισμός ανήκει σε αυτόν τον όροφο.
    const scope = await DxfFirestoreService.getFileFloorScope(fileId);
    if (!scope) return 'orphaned';
    if (isCrossFloorSceneLink(scope, ticket.floorId)) return 'cross-floor';
    return { fileId, canonicalScenePath: ticket.canonicalScenePath };
  }

  const scope = await DxfFirestoreService.getFileFloorScope(fileId);
  if (!scope?.storagePath) return 'orphaned';
  if (isCrossFloorSceneLink(scope, ticket.floorId)) return 'cross-floor';
  return {
    fileId,
    canonicalScenePath: DxfFirestoreService.deriveScenePath(scope.storagePath),
  };
}

/**
 * Επιλύει τον προορισμό ενός ticket ΧΩΡΙΣ `fileId`.
 *
 * Προτεραιότητα: **floor-scoped** lookup όταν ο όροφος είναι γνωστός· το name-based
 * `findExistingFileRecord` μένει fallback **μόνο** για σκηνές χωρίς όροφο (legacy
 * project/building-scoped) — εκεί δεν υπάρχει όροφος να συγκρουστεί, οπότε το όνομα
 * είναι αποδεκτό κλειδί. Τελευταία επιλογή: νέο enterprise id (γνήσιο πρώτο save).
 */
async function resolveNewFileTarget(ticket: SceneSaveTicket): Promise<ResolvedTarget | null> {
  const { companyId, floorId, fileName } = ticket;
  if (!companyId) return null;

  const existing = floorId
    ? await DxfFirestoreService.findFloorFloorplanFileRecord(companyId, floorId)
    : await DxfFirestoreService.findExistingFileRecord(companyId, fileName);

  if (existing) {
    return {
      fileId: existing.id,
      canonicalScenePath: existing.storagePath
        ? DxfFirestoreService.deriveScenePath(existing.storagePath)
        : ticket.canonicalScenePath,
    };
  }

  return {
    fileId: DxfFirestoreService.generateFileId(fileName),
    canonicalScenePath: ticket.canonicalScenePath,
  };
}

/** Χτίζει το τελικό `DxfSaveContext` από το ΠΑΓΩΜΕΝΟ context του ticket. */
function buildSaveContext(
  ticket: SceneSaveTicket,
  canonicalScenePath: string | null,
): DxfSaveContext {
  const injected = ticket.saveContext ?? {};
  return {
    ...injected,
    companyId: injected.companyId ?? ticket.companyId ?? undefined,
    createdBy: injected.createdBy ?? ticket.userUid ?? undefined,
    ...(canonicalScenePath ? { canonicalScenePath } : {}),
  };
}

/**
 * Εκτελεί την εγγραφή που περιγράφει το ticket.
 *
 * Ποτέ δεν πετάει: κάθε αποτυχία γίνεται `{ status: 'failed' }` ώστε ο caller (hook)
 * να μένει απλός και το save status να μη μένει κολλημένο σε `'saving'`.
 */
export async function executeSceneSave(
  ticket: SceneSaveTicket,
  deps: ExecuteSceneSaveDeps,
): Promise<SceneSaveOutcome> {
  try {
    const resolved = ticket.fileId
      ? await resolveKnownFileTarget(ticket, ticket.fileId)
      : await resolveNewFileTarget(ticket);

    if (resolved === 'orphaned') {
      deps.markFileTargetOrphaned(ticket.fileId!);
      return { status: 'skipped', reason: 'orphaned-target' };
    }
    if (resolved === 'cross-floor') {
      console.error('[SceneSave] ADR-714 — αποτροπή εγγραφής σε αρχείο άλλου ορόφου', {
        ...ticketIdentity(ticket),
      });
      return { status: 'blocked', reason: 'cross-floor-target' };
    }
    if (!resolved) {
      // Ούτε fileId ούτε companyId — δεν υπάρχει τίποτα να επιλυθεί.
      return { status: 'skipped', reason: 'unresolvable-target' };
    }

    // ΠΡΟΣΟΧΗ: ένα `canonicalScenePath === null` ΔΕΝ είναι λόγος σιωπηλής παράλειψης.
    // Διατηρείται η προϋπάρχουσα σημασιολογία: το `saveToStorageImpl` πετάει ρητά
    // «canonicalScenePath is required (ADR-293)», που είναι ορατό σφάλμα διαμόρφωσης.
    // Ένα silent skip εδώ θα το έκρυβε και ο χρήστης θα νόμιζε ότι σώθηκε.
    const { fileId, canonicalScenePath } = resolved;

    // ADR-459 Φ7 — ένα floor snapshot κρατά ΜΟΝΟ τα δικά του BIM entities.
    const sceneToPersist = stripForeignFloorBim(ticket.scene, ticket.floorId);

    const baselineDxf = deps.getBaselineDxfCount(fileId);
    if (isDxfWipe(sceneToPersist, baselineDxf)) {
      // Τα κρίσιμα πεδία μπαίνουν στο ΙΔΙΟ το μήνυμα: το structured object κόβεται σε `{}`
      // από το Next dev overlay, και ένα μπλοκάρισμα χωρίς «ποιος/πού/πόσα» δεν διαγιγνώσκεται.
      console.error(
        `[SceneSave] ADR-714 — αποτροπή εγγραφής που μηδενίζει τη γεωμετρία DXF · `
        + `level=${ticket.levelId} floor=${ticket.floorId} file=${fileId} `
        + `«${ticket.fileName}» · αποθηκευμένα DXF=${baselineDxf} → προς εγγραφή DXF=0 `
        + `(σκηνή: ${sceneToPersist.entities.length} οντότητες, όλες BIM). `
        + `Η σκηνή στη μνήμη έχασε τα DXF της — δες γιατί, μη χαλαρώσεις τον φρουρό.`,
        ticketIdentity(ticket),
      );
      return { status: 'blocked', reason: 'dxf-wipe' };
    }

    const ok = await DxfFirestoreService.autoSaveV2(
      fileId,
      ticket.fileName,
      sceneToPersist,
      buildSaveContext(ticket, canonicalScenePath),
    );

    return ok
      ? {
          status: 'saved',
          ticket,
          fileId,
          canonicalScenePath,
          dxfCount: countDxfEntities(sceneToPersist),
        }
      : { status: 'failed', error: new Error(`autoSaveV2 returned false for ${fileId}`) };
  } catch (error) {
    return { status: 'failed', error };
  }
}
