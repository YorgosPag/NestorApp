'use client';

/**
 * foundation-write-scope — SSoT για τη ΔΟΜΗΣΗ του foundation write scope + cross-level
 * writer (ADR-484 / ADR-459).
 *
 * ΠΡΟΒΛΗΜΑ: το ίδιο literal
 *   `{ companyId: user?.companyId, projectId: levels.find(l=>l.id===levelId)?.projectId, userId: user?.uid }`
 * + `createFoundationCrossLevelWriter(scope, target, levelManager)` ήταν copy-pasted σε 5
 * σημεία (auto-design, organism-notification, smart-delete, special-tools, ribbon grid
 * bridge). Ένα μέλλον scope πεδίο (π.χ. tenant) θα έπρεπε να αλλάξει σε 5 αρχεία.
 *
 * ΛΥΣΗ: ΕΝΑ σημείο που χτίζει το scope (`buildFoundationWriteScope`) και ΕΝΑ που επιλύει
 * τον writer για τον όροφο Θεμελίωσης (`resolveFoundationCrossLevelWriter` — default target
 * = `foundation-level-store`). Όλοι οι foundation cross-level callers περνούν από εδώ.
 *
 * @see ./foundation-cross-level-writer.ts — η persistence μηχανική (factory)
 * @see ../../state/foundation-level-store.ts — ο όροφος Θεμελίωσης (target)
 * @see docs/centralized-systems/reference/adrs/ADR-484-cross-level-foundation-properties.md
 */

import {
  createFoundationCrossLevelWriter,
  type FoundationCrossLevelWriter,
  type FoundationWriteScope,
} from './foundation-cross-level-writer';
import { useFoundationLevelStore } from '../../state/foundation-level-store';
import type { FoundationLevelTarget } from '../../systems/levels/building-foundation-level';

/** Ελάχιστο σχήμα του auth user (companyId/uid). */
export type FoundationWriterUser =
  | { readonly companyId?: string | null; readonly uid?: string | null }
  | null
  | undefined;

/** Ελάχιστο σχήμα ενός Level για την ανάκτηση `projectId`. */
type LevelProjectRef = { readonly id: string; readonly projectId?: string };

/** Το scene IO που χρειάζεται ο writer (ίδιος τύπος με τον factory). */
type FoundationSceneIO = Parameters<typeof createFoundationCrossLevelWriter>[2];

/**
 * Χτίσε το `FoundationWriteScope` από auth user + το `projectId` του `levelId`
 * (default κανόνας: το active level). SSoT — αντικαθιστά το 5× copy-pasted literal.
 */
export function buildFoundationWriteScope(
  user: FoundationWriterUser,
  levels: readonly LevelProjectRef[],
  levelId: string | null,
): FoundationWriteScope {
  return {
    companyId: user?.companyId,
    projectId: levels.find((l) => l.id === levelId)?.projectId,
    userId: user?.uid,
  };
}

/**
 * Επίλυσε τον cross-level writer για τον όροφο Θεμελίωσης. `target` default = το
 * `foundation-level-store.target` (null ⟺ ενεργός = Θεμελίωση / single-level → `null`,
 * ο καλών χρησιμοποιεί τότε το single-level path). Επιστρέφει `null` και σε degenerate
 * scope (ο factory το ελέγχει).
 */
export function resolveFoundationCrossLevelWriter(args: {
  readonly user: FoundationWriterUser;
  readonly levels: readonly LevelProjectRef[];
  readonly levelId: string | null;
  readonly io: FoundationSceneIO;
  /** Ρητός target· `undefined` → store target· `null` → κανένας writer. */
  readonly target?: FoundationLevelTarget | null;
}): FoundationCrossLevelWriter | null {
  const target = args.target !== undefined ? args.target : useFoundationLevelStore.getState().target;
  if (!target) return null;
  return createFoundationCrossLevelWriter(
    buildFoundationWriteScope(args.user, args.levels, args.levelId),
    target,
    args.io,
  );
}
