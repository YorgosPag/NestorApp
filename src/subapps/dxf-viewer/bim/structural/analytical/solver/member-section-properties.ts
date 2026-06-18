/**
 * Member section/material properties → element stiffness inputs (ADR-481, T3 / S2).
 *
 * Συνθέτει τις ιδιότητες διατομής/υλικού (E, A, I, J, G) ενός αναλυτικού μέλους
 * **διαβάζοντας** το physical entity μέσω του `entityId` (SSoT — το analytical
 * model ΔΕΝ αντιγράφει διατομές, ADR-480). Μηδέν διπλότυπο:
 *   · E = μέτρο ελαστικότητας από την κατηγορία σκυροδέματος (`CONCRETE_GRADES.ecmGpa`).
 *   · A, b, h = από το ΕΝΑ `section-context` (κολόνα/δοκάρι, mm) — reuse, N.0.2.
 *   · I, J = παράγωγα ορθογωνικής διατομής (geometry-is-SSoT).
 *
 * **Σύστημα μονάδων solver:** μήκη m, δυνάμεις kN, ⇒ E σε kN/m², A σε m², I/J σε m⁴.
 * Pure — zero React/DOM/Firestore.
 *
 * @see ../../concrete-grades.ts — Ecm ανά κατηγορία (SSoT)
 * @see ../../section-context.ts — διαστάσεις διατομής (SSoT)
 * @see ./frame-element-stiffness.ts — ο καταναλωτής
 */

import type { Entity } from '../../../../types/entities';
import { isColumnEntity, isBeamEntity } from '../../../../types/entities';
import {
  CONCRETE_GRADES,
  DEFAULT_CONCRETE_GRADE,
  isConcreteGrade,
  type ConcreteGrade,
} from '../../concrete-grades';
import { buildColumnSectionContext, buildBeamSectionContext } from '../../section-context';
import type { AnalyticalMember } from '../analytical-model-types';

/** GPa → kN/m² (1 GPa = 10⁶ kN/m²). */
const GPA_TO_KNM2 = 1e6;
/** mm → m. */
const MM_TO_M = 1 / 1000;
/** Λόγος Poisson σκυροδέματος (EN 1992-1-1 §3.1.3, άρηκτο). */
const POISSON_CONCRETE = 0.2;

/** Ιδιότητες διατομής/υλικού μέλους στο σύστημα του solver (kN, m). */
export interface MemberSectionProperties {
  /** Μέτρο ελαστικότητας E (kN/m²). */
  readonly eKnm2: number;
  /** Μέτρο διάτμησης G = E / (2(1+ν)) (kN/m²). */
  readonly gKnm2: number;
  /** Εμβαδόν διατομής A (m²). */
  readonly areaM2: number;
  /** Ροπή αδρανείας περί τοπικό άξονα y (m⁴). */
  readonly iyM4: number;
  /** Ροπή αδρανείας περί τοπικό άξονα z (m⁴). */
  readonly izM4: number;
  /** Σταθερά στρέψης St. Venant J (m⁴). */
  readonly jM4: number;
}

/** Διαστάσεις ορθογωνικής διατομής (m) + κατηγορία σκυροδέματος. */
interface RectSection {
  readonly widthM: number;
  readonly depthM: number;
  readonly grade: ConcreteGrade;
}

/** Έγκυρη κατηγορία ή ο default (μηδέν hardcode — SSoT). */
function resolveGrade(value: string | undefined): ConcreteGrade {
  return isConcreteGrade(value) ? value : DEFAULT_CONCRETE_GRADE;
}

/**
 * Διαστάσεις διατομής (m) του μέλους από το ΕΝΑ section-context. Μη-ορθογωνικές
 * κολόνες (κυκλική/τοίχωμα) προσεγγίζονται με το bbox (v1 — conservative· ακριβής
 * I διατομής = μελλοντικό slice). Επιστρέφει null όταν το entity δεν είναι φέρον.
 */
function resolveRectSection(member: AnalyticalMember, entity: Entity): RectSection | null {
  if (member.memberType === 'column' && isColumnEntity(entity)) {
    const ctx = buildColumnSectionContext(entity);
    return { widthM: ctx.widthMm * MM_TO_M, depthM: ctx.depthMm * MM_TO_M, grade: resolveGrade(entity.params.concreteGrade) };
  }
  if (member.memberType === 'beam' && isBeamEntity(entity)) {
    const ctx = buildBeamSectionContext(entity);
    return { widthM: ctx.widthMm * MM_TO_M, depthM: ctx.depthMm * MM_TO_M, grade: resolveGrade(entity.params.concreteGrade) };
  }
  return null;
}

/**
 * Σταθερά στρέψης St. Venant ορθογωνικής διατομής a×b (a≥b):
 * J = a·b³·[1/3 − 0.21·(b/a)·(1 − (b/a)⁴/12)] (Roark/Timoshenko). Μηδέν για
 * εκφυλισμένη διατομή.
 */
function rectangularTorsionConstant(widthM: number, depthM: number): number {
  const a = Math.max(widthM, depthM);
  const b = Math.min(widthM, depthM);
  if (a <= 0 || b <= 0) return 0;
  const r = b / a;
  return a * b ** 3 * (1 / 3 - 0.21 * r * (1 - r ** 4 / 12));
}

/**
 * Ιδιότητες E/A/I/J/G ενός αναλυτικού μέλους από το physical entity του (μέσω
 * `entityId`). Επιστρέφει null όταν το entity λείπει ή δεν είναι φέρον μέλος
 * (ο solver παραλείπει τότε το μέλος — defensive).
 */
export function resolveMemberSectionProperties(
  member: AnalyticalMember,
  entity: Entity | undefined,
): MemberSectionProperties | null {
  if (!entity) return null;
  const section = resolveRectSection(member, entity);
  if (!section) return null;
  const { widthM, depthM, grade } = section;
  const eKnm2 = CONCRETE_GRADES[grade].ecmGpa * GPA_TO_KNM2;
  return {
    eKnm2,
    gKnm2: eKnm2 / (2 * (1 + POISSON_CONCRETE)),
    areaM2: widthM * depthM,
    // Iy = ∫z²dA (διάσταση depth κατά z), Iz = ∫y²dA (διάσταση width κατά y).
    iyM4: (widthM * depthM ** 3) / 12,
    izM4: (depthM * widthM ** 3) / 12,
    jM4: rectangularTorsionConstant(widthM, depthM),
  };
}
