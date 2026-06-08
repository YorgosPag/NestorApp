/**
 * ADR-423 §4 — `MepDisciplineRegistry` (SSoT taxonomy of the MEP auto-design engine).
 *
 * The framework promise: a new network is **a registry entry + a recognizer**, never a
 * new engine. The water pilot (ADR-426) deferred this registry "until the 2nd discipline
 * lands"; drainage (ADR-427) is that discipline, so the registry is born here with its
 * first two ACTIVE entries (water-supply, sanitary-drainage) plus the reserved slots for
 * the remaining disciplines of ADR-423 §2.1 — declared now for an SSoT-complete taxonomy
 * (mirror of the reserved categories in `recognition-types.ts`), wired as each lands.
 *
 * This is metadata, not an engine: each discipline's concrete parameter object (e.g.
 * `WATER_SUPPLY_DISCIPLINE`, `SANITARY_DRAINAGE_DISCIPLINE`) is what its `design*`
 * orchestrator consumes; the registry catalogs them by id (flow model, classifications,
 * standard ids, status) so tooling/UX can enumerate the disciplines without importing
 * every engine. Zero hard-coded user-facing strings — `labelKey` is an i18n key.
 *
 * @see ./../water/water-supply-discipline.ts · ./../drainage/drainage-discipline.ts
 * @see docs/centralized-systems/reference/adrs/ADR-423-mep-auto-design-framework.md §4
 */

import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';

/** The 8 MEP disciplines of ADR-423 §2.1 (locked roadmap order). */
export type MepDisciplineId =
  | 'water-supply'
  | 'sanitary-drainage'
  | 'heating'
  | 'electrical-strong'
  | 'hvac'
  | 'electrical-weak'
  | 'fire-protection'
  | 'gas';

/** How a discipline's medium moves — drives routing/sizing/elevation strategy. */
export type FlowModel = 'pressurised' | 'gravity' | 'closed-loop' | 'air' | 'electrical';

/** `active` = an implemented engine exists; `reserved` = taxonomy slot, not yet built. */
export type DisciplineStatus = 'active' | 'reserved';

/** One discipline's catalog metadata (not its engine parameters). */
export interface MepDisciplineMeta {
  readonly disciplineId: MepDisciplineId;
  /** i18n key for the display label (never a literal). */
  readonly labelKey: string;
  readonly flowModel: FlowModel;
  /** The plumbing classifications this discipline routes (empty for non-pipe disciplines). */
  readonly classifications: readonly PlumbingSystemClassification[];
  /** Ids of the pluggable demand + sizing standards the engine uses (transparency). */
  readonly demandStandardId: string | null;
  readonly sizingStandardId: string | null;
  readonly status: DisciplineStatus;
}

/**
 * The registry — keyed by `MepDisciplineId`, in the locked roadmap order. Adding a
 * discipline = flip its entry to `active` + fill its standard ids (the engine + recognizer
 * live in `mep-design/<discipline>/`). The reserved entries keep the taxonomy honest.
 */
export const MEP_DISCIPLINE_REGISTRY: Readonly<Record<MepDisciplineId, MepDisciplineMeta>> = {
  'water-supply': {
    disciplineId: 'water-supply',
    labelKey: 'ribbon.mepDesign.discipline.waterSupply',
    flowModel: 'pressurised',
    classifications: ['domestic-cold-water', 'domestic-hot-water'],
    demandStandardId: 'EN806/DIN1988-3',
    sizingStandardId: 'DIN1988-3(simplified)',
    status: 'active',
  },
  'sanitary-drainage': {
    disciplineId: 'sanitary-drainage',
    labelKey: 'ribbon.mepDesign.discipline.sanitaryDrainage',
    flowModel: 'gravity',
    classifications: ['sanitary-drainage'],
    demandStandardId: 'EN12056-2/SystemI',
    sizingStandardId: 'EN12056-2(simplified)',
    status: 'active',
  },
  heating: {
    disciplineId: 'heating',
    labelKey: 'ribbon.mepDesign.discipline.heating',
    flowModel: 'closed-loop',
    classifications: ['hydronic-supply', 'hydronic-return'],
    demandStandardId: null,
    sizingStandardId: null,
    status: 'reserved',
  },
  'electrical-strong': {
    disciplineId: 'electrical-strong',
    labelKey: 'ribbon.mepDesign.discipline.electricalStrong',
    flowModel: 'electrical',
    classifications: [],
    demandStandardId: null,
    sizingStandardId: null,
    status: 'reserved',
  },
  hvac: {
    disciplineId: 'hvac',
    labelKey: 'ribbon.mepDesign.discipline.hvac',
    flowModel: 'air',
    classifications: [],
    demandStandardId: null,
    sizingStandardId: null,
    status: 'reserved',
  },
  'electrical-weak': {
    disciplineId: 'electrical-weak',
    labelKey: 'ribbon.mepDesign.discipline.electricalWeak',
    flowModel: 'electrical',
    classifications: [],
    demandStandardId: null,
    sizingStandardId: null,
    status: 'reserved',
  },
  'fire-protection': {
    disciplineId: 'fire-protection',
    labelKey: 'ribbon.mepDesign.discipline.fireProtection',
    flowModel: 'pressurised',
    classifications: [],
    demandStandardId: null,
    sizingStandardId: null,
    status: 'reserved',
  },
  gas: {
    disciplineId: 'gas',
    labelKey: 'ribbon.mepDesign.discipline.gas',
    flowModel: 'pressurised',
    classifications: [],
    demandStandardId: null,
    sizingStandardId: null,
    status: 'reserved',
  },
};

/** The disciplines with an implemented engine (the auto-design UX enumerates these). */
export function activeDisciplines(): readonly MepDisciplineMeta[] {
  return Object.values(MEP_DISCIPLINE_REGISTRY).filter((d) => d.status === 'active');
}
