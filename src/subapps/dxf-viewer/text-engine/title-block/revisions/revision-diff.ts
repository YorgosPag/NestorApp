/**
 * ADR-651 Φάση Η — **η σύγκριση νέας vs προηγούμενης έκδοσης** (Απόφαση #9: «προτείνει μόνο
 * του τι άλλαξε»).
 *
 * Καθαρή, ντετερμινιστική συνάρτηση — **εδώ δεν υπάρχει AI**. Το AI παίρνει ΑΥΤΟ το
 * δομημένο αποτέλεσμα και το μετατρέπει σε ανθρώπινη περιγραφή· δεν «κοιτά» ποτέ το σχέδιο
 * μόνο του (κανείς LLM δεν μετράει σωστά 3.000 οντότητες — τα μετράμε εμείς, ακριβώς).
 *
 * Ταύτιση φύλλων: με `levelId` (σταθερό κλειδί). Ταύτιση οντοτήτων μέσα σε ένα φύλλο: με
 * `idHash` της υπογραφής — ίδιο id + άλλο `contentHash` ⇒ **τροποποιήθηκε**.
 *
 * @see ./revision-snapshot.ts — ο παραγωγός των υπογραφών
 */

import { parseSignature } from './revision-snapshot';
import type {
  RevisionDiff,
  RevisionSheetChange,
  RevisionSheetSnapshot,
  RevisionSnapshot,
} from './revision.types';

type Counts = Record<string, number>;

function bump(counts: Counts, type: string): void {
  counts[type] = (counts[type] ?? 0) + 1;
}

function hasAny(counts: Counts): boolean {
  return Object.keys(counts).length > 0;
}

/** Χάρτης `idHash → { content, type }` από τις υπογραφές ενός φύλλου. */
function signatureMap(sheet: RevisionSheetSnapshot): Map<string, { content: string; type: string }> {
  const map = new Map<string, { content: string; type: string }>();
  for (const signature of sheet.signatures) {
    const { id, content, type } = parseSignature(signature);
    map.set(id, { content, type });
  }
  return map;
}

/** Ακριβής σύγκριση (υπάρχουν υπογραφές): προστέθηκαν / αφαιρέθηκαν / τροποποιήθηκαν. */
function diffBySignature(previous: RevisionSheetSnapshot, next: RevisionSheetSnapshot): RevisionSheetChange {
  const before = signatureMap(previous);
  const after = signatureMap(next);
  const added: Counts = {};
  const removed: Counts = {};
  const modified: Counts = {};

  for (const [id, entry] of after) {
    const old = before.get(id);
    if (!old) bump(added, entry.type);
    else if (old.content !== entry.content) bump(modified, entry.type);
  }
  for (const [id, entry] of before) {
    if (!after.has(id)) bump(removed, entry.type);
  }

  return {
    levelId: next.levelId,
    title: next.title,
    added,
    removed,
    modified,
    isNew: false,
    coarse: false,
    changed: hasAny(added) || hasAny(removed) || hasAny(modified),
  };
}

/**
 * Χονδρική σύγκριση (coarse mode — το σχέδιο ξεπερνούσε το όριο υπογραφών): μόνο διαφορές
 * **πλήθους** ανά τύπο. Οι επί τόπου τροποποιήσεις **δεν φαίνονται** — γι' αυτό το
 * `coarse: true` ταξιδεύει μέχρι το prompt και το UI.
 */
function diffByCounts(previous: RevisionSheetSnapshot, next: RevisionSheetSnapshot): RevisionSheetChange {
  const added: Counts = {};
  const removed: Counts = {};
  const types = new Set([...Object.keys(previous.countsByType), ...Object.keys(next.countsByType)]);

  for (const type of types) {
    const delta = (next.countsByType[type] ?? 0) - (previous.countsByType[type] ?? 0);
    if (delta > 0) added[type] = delta;
    else if (delta < 0) removed[type] = -delta;
  }

  return {
    levelId: next.levelId,
    title: next.title,
    added,
    removed,
    modified: {},
    isNew: false,
    coarse: true,
    changed: hasAny(added) || hasAny(removed),
  };
}

/** Νέο φύλλο (όροφος που δεν υπήρχε στην προηγούμενη έκδοση): όλα του «προστέθηκαν». */
function diffNewSheet(sheet: RevisionSheetSnapshot): RevisionSheetChange {
  return {
    levelId: sheet.levelId,
    title: sheet.title,
    added: { ...sheet.countsByType },
    removed: {},
    modified: {},
    isNew: true,
    coarse: sheet.signatures.length === 0,
    changed: sheet.entityCount > 0,
  };
}

/**
 * Η σύγκριση δύο αποτυπωμάτων. `previous === null` ⇒ **αρχική έκδοση** (baseline): δεν
 * υπάρχει τι να συγκριθεί, η 1η αναθεώρηση καταγράφει την έκδοση όπως κατατέθηκε.
 */
export function diffRevisionSnapshots(
  previous: RevisionSnapshot | null,
  next: RevisionSnapshot,
): RevisionDiff {
  if (!previous) {
    return { sheets: [], removedSheets: [], baseline: true, hasChanges: true };
  }

  const before = new Map(previous.sheets.map((sheet) => [sheet.levelId, sheet]));
  const sheets = next.sheets.map((sheet) => {
    const old = before.get(sheet.levelId);
    if (!old) return diffNewSheet(sheet);
    const coarse = old.signatures.length === 0 || sheet.signatures.length === 0;
    return coarse ? diffByCounts(old, sheet) : diffBySignature(old, sheet);
  });

  const nextIds = new Set(next.sheets.map((sheet) => sheet.levelId));
  const removedSheets = previous.sheets
    .filter((sheet) => !nextIds.has(sheet.levelId))
    .map((sheet) => sheet.title);

  return {
    sheets,
    removedSheets,
    baseline: false,
    hasChanges: removedSheets.length > 0 || sheets.some((sheet) => sheet.changed),
  };
}
