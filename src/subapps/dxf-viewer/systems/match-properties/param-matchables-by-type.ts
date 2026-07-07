/**
 * ADR-581 — Structural (params) matchable descriptors ανά τύπο — test-locked SSoT.
 *
 * Το ΜΟΝΟ σημείο που απαριθμεί top-level scalar structural params για μεταφορά. Οι
 * paramKeys εξήχθησαν με στοχευμένο audit των `bim/types/*-types.ts` (ADR-581 Φ2
 * research) και κλειδώνονται με round-trip test (read→buildFragment→re-read).
 *
 * ΣΚΟΠΙΜΑ conservative: μόνο ΑΥΤΟΤΕΛΗ scalars χωρίς κρυφή σύζευξη με nested objects.
 * Εξαιρούνται:
 *   - geometry dims (width/depth/height/…) → geometry-matchables.ts
 *   - material → geometry-matchables.ts
 *   - kind/anchor/rotation/position/*Id/binding/offset → identity/topology (μη μεταφέρσιμα)
 *   - section-defining cluster (sectionKind/catalogProfile/profileDesignation) → σύζευξη
 *     με variant-specific nested params· αναβάλλεται για «Match Type» πλήρη μεταφορά τομής
 *   - reinforcement/finish/tilt/dna → nested objects (deep-merge, μελλοντική φάση)
 *   - derived readouts (volumes/weights/ρ/loads) → read-only
 */

import type { EntityType } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import type {
  MatchableValue,
  MatchablePropertyDescriptor,
  MatchValueType,
  SemanticRole,
} from './match-types';
import { asRole } from './semantic-roles';

const CONCRETE_GRADES = ['C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60'] as const;
const ENVELOPE_FUNCTIONS = ['exterior', 'interior'] as const;
const LOCATION_LINE = ['center', 'left', 'right'] as const;

/** Προδιαγραφή ενός structural scalar param για matching. */
interface StructuralFieldSpec {
  readonly paramKey: string;
  readonly role: SemanticRole;
  readonly valueType: MatchValueType;
  readonly enumValues?: readonly string[];
}

// Κοινοί (cross-type) ρόλοι — ίδιο νόημα σε πολλά μέλη.
const grade: StructuralFieldSpec = { paramKey: 'concreteGrade', role: asRole('structural.concreteGrade'), valueType: 'enum', enumValues: CONCRETE_GRADES };
const envelope: StructuralFieldSpec = { paramKey: 'envelopeFunction', role: asRole('structural.envelopeFunction'), valueType: 'enum', enumValues: ENVELOPE_FUNCTIONS };
const autoSized: StructuralFieldSpec = { paramKey: 'autoSized', role: asRole('structural.autoSized'), valueType: 'boolean' };
const justification: StructuralFieldSpec = { paramKey: 'justification', role: asRole('structural.justification'), valueType: 'enum', enumValues: LOCATION_LINE };

/** Structural specs ανά τύπο (top-level scalars, transfer-safe). */
const STRUCTURAL_BY_TYPE: Readonly<Partial<Record<EntityType, readonly StructuralFieldSpec[]>>> = {
  column: [grade, envelope, autoSized],
  beam: [
    grade, envelope, autoSized, justification,
    { paramKey: 'autoSizedWidth', role: asRole('structural.autoSizedWidth'), valueType: 'boolean' },
    { paramKey: 'supportType', role: asRole('structural.beamSupportType'), valueType: 'enum', enumValues: ['simple', 'fixed', 'cantilever', 'continuous'] },
  ],
  slab: [
    grade, autoSized,
    { paramKey: 'reinforcement', role: asRole('structural.slabReinforcement'), valueType: 'enum', enumValues: ['one-way', 'two-way', 'waffle', 'flat'] },
  ],
  wall: [
    envelope,
    { paramKey: 'category', role: asRole('structural.wallCategory'), valueType: 'enum', enumValues: ['exterior', 'interior', 'partition', 'parapet', 'fence'] },
    { paramKey: 'joinPriority', role: asRole('structural.wallJoinPriority'), valueType: 'number' },
  ],
  foundation: [justification],
};

function readParam(entity: SceneEntity, paramKey: string): MatchableValue | undefined {
  const params = entity.params;
  if (!params || typeof params !== 'object') return undefined;
  const v = (params as Record<string, unknown>)[paramKey];
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : undefined;
}

function toDescriptor(spec: StructuralFieldSpec): MatchablePropertyDescriptor {
  return {
    key: `params.${spec.paramKey}`,
    role: spec.role,
    category: 'structural',
    unit: 'none',
    valueType: spec.valueType,
    channel: 'params',
    readOnly: false,
    labelKey: `matchProperties.fields.${spec.paramKey}`,
    enumValues: spec.enumValues,
    read: (entity: SceneEntity) => readParam(entity, spec.paramKey),
    buildFragment: (value: MatchableValue) => ({
      channel: 'params',
      patch: { [spec.paramKey]: value },
    }),
  };
}

/** Structural matchable descriptors για έναν τύπο (top-level scalars μόνο). */
export function getStructuralMatchables(type: EntityType): readonly MatchablePropertyDescriptor[] {
  const specs = STRUCTURAL_BY_TYPE[type];
  return specs ? specs.map(toDescriptor) : [];
}
