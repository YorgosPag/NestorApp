/**
 * ADR-526 (Tekton .TEK IMPORT) — service-level orchestrator (File → SceneModel).
 *
 * Καθρέφτης του `DxfImportService`: διαβάζει το αρχείο ως UTF-8 (ο Τέκτων δηλώνει
 * `encoding="UTF-8"` στο prolog), parse → scene build. Επιστρέφει το ίδιο σχήμα
 * αποτελέσματος με το DXF import ώστε το `handleFileImport` να μην ξεχωρίζει πηγή.
 */

import type { SceneUnits } from '../../utils/scene-units';
import type { SceneModel } from '../../types/scene-types';
import { parseTekScene } from './tek-scene-extract';
import { buildSceneFromTekScene } from './tek-scene-builder';
import { TekParseError } from './tek-xml-reader';

export interface TekImportResult {
  readonly success: boolean;
  readonly scene?: SceneModel;
  readonly error?: string;
  readonly warnings: readonly string[];
  readonly stats: {
    readonly stairCount: number;
    /** ADR-526 Φ5a — πλήθος εισαγμένων 2Δ γραμμών. */
    readonly lineCount: number;
    /** ADR-526 Φ5a — πλήθος εισαγμένων τόξων/κύκλων. */
    readonly arcCount: number;
    /** ADR-526 Φ5a — πλήθος εισαγμένων κειμένων. */
    readonly textCount: number;
    readonly parseTimeMs: number;
  };
}

/** Αναγνωρίζει `.tek` / `.tek.txt` ονόματα αρχείων (case-insensitive). */
export function isTekFileName(name: string): boolean {
  return /\.tek(\.txt)?$/i.test(name.trim());
}

/**
 * Parse Tekton XML περιεχόμενο → `SceneModel` (καθαρό, testable χωρίς `File`).
 * `levelId` = ο όροφος-στόχος για τις σκάλες.
 */
export function importTekContent(
  content: string,
  levelId: string,
  units: SceneUnits = 'mm',
): TekImportResult {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
  try {
    const parsed = parseTekScene(content);
    const { scene, warnings } = buildSceneFromTekScene(parsed, levelId, units);
    const parseTimeMs = (typeof performance !== 'undefined' ? performance.now() : 0) - startedAt;
    return {
      success: true,
      scene,
      warnings,
      stats: {
        stairCount: parsed.stairs.length,
        lineCount: parsed.lines.length,
        arcCount: parsed.arcs.length,
        textCount: parsed.texts.length,
        parseTimeMs,
      },
    };
  } catch (err) {
    const message = err instanceof TekParseError ? err.message
      : `Σφάλμα ανάγνωσης .tek: ${err instanceof Error ? err.message : String(err)}`;
    return {
      success: false,
      error: message,
      warnings: [],
      stats: { stairCount: 0, lineCount: 0, arcCount: 0, textCount: 0, parseTimeMs: 0 },
    };
  }
}

/** Διαβάζει ένα `File` (UTF-8) → `TekImportResult`. */
export async function importTekFile(
  file: File,
  levelId: string,
  units: SceneUnits = 'mm',
): Promise<TekImportResult> {
  const content = await file.text();
  return importTekContent(content, levelId, units);
}
