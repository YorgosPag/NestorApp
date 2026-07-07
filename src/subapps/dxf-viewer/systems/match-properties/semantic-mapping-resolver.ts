/**
 * ADR-581 — Deterministic semantic-mapping resolver.
 *
 * Δίνει source + target οντότητα → λίστα αντιστοιχίσεων
 * `{sourceKey, targetKey, role, confidence, reason}`:
 *   - same type   → identity mapping (confidence 1.0)
 *   - cross type  → role-join: exact role → 0.9 × unitFactor × typeFactor·
 *                   role-family fallback → ≤0.5· τίποτα → παραλείπεται.
 *
 * Ό,τι πέφτει κάτω από `AI_MAPPING_THRESHOLD` σημειώνεται ambiguous → επιλέξιμο
 * για το προαιρετικό AI fallback (ADR-581 §Optional AI). Καθαρά ντετερμινιστικό.
 */

import type { EntityType } from '../../types/entities';
import type {
  MatchablePropertyDescriptor,
  MatchUnit,
  MatchValueType,
  SemanticRole,
} from './match-types';
import { getMatchableProperties, indexByRole } from './match-registry';
import { roleFamily } from './semantic-roles';

export interface MatchMapping {
  readonly sourceKey: string;
  readonly targetKey: string;
  readonly role: SemanticRole;
  /** 0..1 */
  readonly confidence: number;
  /** i18n/κωδικός λόγος: 'sameType' | 'sameRole' | 'roleFamily'. */
  readonly reason: string;
  readonly ambiguous: boolean;
}

/** Κάτω από αυτό → ambiguous (εν δυνάμει AI fallback). */
export const AI_MAPPING_THRESHOLD = 0.6;

/**
 * Οικογένειες όπου το family-fallback είναι ΑΣΦΑΛΕΣ. Το `geometry` ΕΞΑΙΡΕΙΤΑΙ
 * σκόπιμα: height/width/depth/elevation είναι διακριτοί φυσικοί άξονες, ΟΧΙ
 * εναλλάξιμοι (π.χ. height→elevation θα ήταν λάθος). Τέτοιες ασαφείς cross-type
 * αντιστοιχίσεις τις αναλαμβάνει το προαιρετικό AI στρώμα.
 */
const SAFE_FAMILY_FALLBACK: ReadonlySet<string> = new Set<string>(['material']);

/** Μονάδες μεταφέρσιμες μεταξύ τους (1 = ίδια, 0.85 = convertible, 0 = ασύμβατες). */
function unitFactor(a: MatchUnit, b: MatchUnit): number {
  if (a === b) return 1;
  // Καμία silent unit conversion (mm↔deg κ.λπ.) — ασύμβατες.
  return 0;
}

/** Συμβατότητα τύπων τιμής. */
function typeFactor(a: MatchValueType, b: MatchValueType): number {
  if (a === b) return 1;
  return 0;
}

function identityMappings(
  descriptors: readonly MatchablePropertyDescriptor[],
): MatchMapping[] {
  return descriptors
    .filter((d) => !d.readOnly)
    .map((d) => ({
      sourceKey: d.key,
      targetKey: d.key,
      role: d.role,
      confidence: 1,
      reason: 'sameType',
      ambiguous: false,
    }));
}

/** Καλύτερος target descriptor για έναν source (exact-role hits). */
function bestExactMatch(
  src: MatchablePropertyDescriptor,
  candidates: readonly MatchablePropertyDescriptor[],
): { target: MatchablePropertyDescriptor; confidence: number } | null {
  let best: { target: MatchablePropertyDescriptor; confidence: number } | null = null;
  for (const tgt of candidates) {
    if (tgt.readOnly) continue;
    const conf = 0.9 * unitFactor(src.unit, tgt.unit) * typeFactor(src.valueType, tgt.valueType);
    if (conf > 0 && (!best || conf > best.confidence)) best = { target: tgt, confidence: conf };
  }
  return best;
}

/** Role-family fallback (ίδια οικογένεια, numeric) — χαμηλό confidence. */
function bestFamilyMatch(
  src: MatchablePropertyDescriptor,
  targets: readonly MatchablePropertyDescriptor[],
  usedTargetKeys: ReadonlySet<string>,
): { target: MatchablePropertyDescriptor; confidence: number } | null {
  const family = roleFamily(src.role);
  let best: { target: MatchablePropertyDescriptor; confidence: number } | null = null;
  for (const tgt of targets) {
    if (tgt.readOnly || usedTargetKeys.has(tgt.key)) continue;
    if (roleFamily(tgt.role) !== family) continue;
    const conf = 0.5 * unitFactor(src.unit, tgt.unit) * typeFactor(src.valueType, tgt.valueType);
    if (conf > 0 && (!best || conf > best.confidence)) best = { target: tgt, confidence: conf };
  }
  return best;
}

/** Αντιστοίχιση ιδιοτήτων source → target. */
export function resolveSemanticMapping(
  sourceType: EntityType,
  targetType: EntityType,
): readonly MatchMapping[] {
  const srcDescs = getMatchableProperties(sourceType);
  if (sourceType === targetType) return identityMappings(srcDescs);

  const tgtDescs = getMatchableProperties(targetType);
  const byRole = indexByRole(tgtDescs);
  const mappings: MatchMapping[] = [];
  const usedTargetKeys = new Set<string>();

  for (const src of srcDescs) {
    if (src.readOnly) continue;
    const exact = bestExactMatch(src, byRole.get(src.role) ?? []);
    if (exact) {
      mappings.push({
        sourceKey: src.key,
        targetKey: exact.target.key,
        role: src.role,
        confidence: exact.confidence,
        reason: 'sameRole',
        ambiguous: exact.confidence < AI_MAPPING_THRESHOLD,
      });
      usedTargetKeys.add(exact.target.key);
      continue;
    }
    if (!SAFE_FAMILY_FALLBACK.has(roleFamily(src.role))) continue;
    const family = bestFamilyMatch(src, tgtDescs, usedTargetKeys);
    if (family) {
      mappings.push({
        sourceKey: src.key,
        targetKey: family.target.key,
        role: src.role,
        confidence: family.confidence,
        reason: 'roleFamily',
        ambiguous: true,
      });
      usedTargetKeys.add(family.target.key);
    }
  }
  return mappings;
}
