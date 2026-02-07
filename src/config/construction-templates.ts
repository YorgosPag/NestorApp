/**
 * Construction Templates — Predefined Phases & Tasks (ADR-034 Phase 4)
 *
 * Centralized SSoT for predefined construction phases and their tasks.
 * Used by ConstructionPhaseDialog combobox for quick entry.
 *
 * Naming convention:
 * - Phase keys map to i18n: `tabs.timeline.gantt.templates.phases.{key}`
 * - Task keys map to i18n: `tabs.timeline.gantt.templates.tasks.{phaseKey}.{taskKey}`
 * - Codes: PH-001..PH-015 for phases, TSK-{phaseOrder}{taskOrder} for tasks
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface PredefinedTask {
  /** i18n lookup key (e.g. 'excavation') */
  key: string;
  /** Default code (e.g. 'TSK-0201') */
  code: string;
  /** Sort order within phase */
  order: number;
}

export interface PredefinedPhase {
  /** i18n lookup key (e.g. 'foundation') */
  key: string;
  /** Default code (e.g. 'PH-002') */
  code: string;
  /** Sort order */
  order: number;
  /** Predefined tasks for this phase */
  tasks: PredefinedTask[];
}

// ─── Predefined Phases with Tasks ─────────────────────────────────────────

export const CONSTRUCTION_PHASES: PredefinedPhase[] = [
  {
    key: 'sitePreparation',
    code: 'PH-001',
    order: 1,
    tasks: [
      { key: 'siteSurvey', code: 'TSK-0101', order: 1 },
      { key: 'soilTesting', code: 'TSK-0102', order: 2 },
      { key: 'demolition', code: 'TSK-0103', order: 3 },
      { key: 'siteClearing', code: 'TSK-0104', order: 4 },
    ],
  },
  {
    key: 'foundation',
    code: 'PH-002',
    order: 2,
    tasks: [
      { key: 'excavation', code: 'TSK-0201', order: 1 },
      { key: 'reinforcement', code: 'TSK-0202', order: 2 },
      { key: 'concreting', code: 'TSK-0203', order: 3 },
      { key: 'waterproofing', code: 'TSK-0204', order: 4 },
      { key: 'backfill', code: 'TSK-0205', order: 5 },
    ],
  },
  {
    key: 'structuralFrame',
    code: 'PH-003',
    order: 3,
    tasks: [
      { key: 'columnConstruction', code: 'TSK-0301', order: 1 },
      { key: 'beamConstruction', code: 'TSK-0302', order: 2 },
      { key: 'slabPouring', code: 'TSK-0303', order: 3 },
      { key: 'structuralCuring', code: 'TSK-0304', order: 4 },
    ],
  },
  {
    key: 'roofing',
    code: 'PH-004',
    order: 4,
    tasks: [
      { key: 'roofFraming', code: 'TSK-0401', order: 1 },
      { key: 'roofInsulation', code: 'TSK-0402', order: 2 },
      { key: 'roofWaterproofing', code: 'TSK-0403', order: 3 },
      { key: 'roofTiling', code: 'TSK-0404', order: 4 },
      { key: 'gutters', code: 'TSK-0405', order: 5 },
    ],
  },
  {
    key: 'externalWalls',
    code: 'PH-005',
    order: 5,
    tasks: [
      { key: 'brickwork', code: 'TSK-0501', order: 1 },
      { key: 'externalInsulation', code: 'TSK-0502', order: 2 },
      { key: 'externalRendering', code: 'TSK-0503', order: 3 },
      { key: 'facadeCladding', code: 'TSK-0504', order: 4 },
    ],
  },
  {
    key: 'plumbing',
    code: 'PH-006',
    order: 6,
    tasks: [
      { key: 'waterSupply', code: 'TSK-0601', order: 1 },
      { key: 'drainage', code: 'TSK-0602', order: 2 },
      { key: 'hotWater', code: 'TSK-0603', order: 3 },
      { key: 'fixtureInstallation', code: 'TSK-0604', order: 4 },
    ],
  },
  {
    key: 'electrical',
    code: 'PH-007',
    order: 7,
    tasks: [
      { key: 'mainPanel', code: 'TSK-0701', order: 1 },
      { key: 'wiring', code: 'TSK-0702', order: 2 },
      { key: 'switchesSockets', code: 'TSK-0703', order: 3 },
      { key: 'lighting', code: 'TSK-0704', order: 4 },
      { key: 'grounding', code: 'TSK-0705', order: 5 },
    ],
  },
  {
    key: 'hvac',
    code: 'PH-008',
    order: 8,
    tasks: [
      { key: 'ductwork', code: 'TSK-0801', order: 1 },
      { key: 'unitInstallation', code: 'TSK-0802', order: 2 },
      { key: 'piping', code: 'TSK-0803', order: 3 },
      { key: 'commissioning', code: 'TSK-0804', order: 4 },
    ],
  },
  {
    key: 'insulation',
    code: 'PH-009',
    order: 9,
    tasks: [
      { key: 'thermalInsulation', code: 'TSK-0901', order: 1 },
      { key: 'soundInsulation', code: 'TSK-0902', order: 2 },
      { key: 'moistureBarrier', code: 'TSK-0903', order: 3 },
    ],
  },
  {
    key: 'plastering',
    code: 'PH-010',
    order: 10,
    tasks: [
      { key: 'internalPlastering', code: 'TSK-1001', order: 1 },
      { key: 'externalPlastering', code: 'TSK-1002', order: 2 },
      { key: 'decorativePlaster', code: 'TSK-1003', order: 3 },
    ],
  },
  {
    key: 'flooring',
    code: 'PH-011',
    order: 11,
    tasks: [
      { key: 'screed', code: 'TSK-1101', order: 1 },
      { key: 'tileInstallation', code: 'TSK-1102', order: 2 },
      { key: 'marbleInstallation', code: 'TSK-1103', order: 3 },
      { key: 'woodFlooring', code: 'TSK-1104', order: 4 },
    ],
  },
  {
    key: 'painting',
    code: 'PH-012',
    order: 12,
    tasks: [
      { key: 'priming', code: 'TSK-1201', order: 1 },
      { key: 'internalPainting', code: 'TSK-1202', order: 2 },
      { key: 'externalPainting', code: 'TSK-1203', order: 3 },
      { key: 'specialFinishes', code: 'TSK-1204', order: 4 },
    ],
  },
  {
    key: 'joinery',
    code: 'PH-013',
    order: 13,
    tasks: [
      { key: 'windowInstallation', code: 'TSK-1301', order: 1 },
      { key: 'doorInstallation', code: 'TSK-1302', order: 2 },
      { key: 'kitchenCabinets', code: 'TSK-1303', order: 3 },
      { key: 'wardrobes', code: 'TSK-1304', order: 4 },
    ],
  },
  {
    key: 'landscaping',
    code: 'PH-014',
    order: 14,
    tasks: [
      { key: 'outdoorPaving', code: 'TSK-1401', order: 1 },
      { key: 'fencing', code: 'TSK-1402', order: 2 },
      { key: 'gardenPlanting', code: 'TSK-1403', order: 3 },
      { key: 'irrigationSystem', code: 'TSK-1404', order: 4 },
    ],
  },
  {
    key: 'inspection',
    code: 'PH-015',
    order: 15,
    tasks: [
      { key: 'mechanicalInspection', code: 'TSK-1501', order: 1 },
      { key: 'electricalInspection', code: 'TSK-1502', order: 2 },
      { key: 'fireInspection', code: 'TSK-1503', order: 3 },
      { key: 'finalHandover', code: 'TSK-1504', order: 4 },
    ],
  },
];

// ─── Helper Functions ──────────────────────────────────────────────────────

/** Get all predefined phases */
export function getPredefinedPhases(): PredefinedPhase[] {
  return CONSTRUCTION_PHASES;
}

/** Get predefined tasks for a specific phase by key */
export function getPredefinedTasksForPhase(phaseKey: string): PredefinedTask[] {
  const phase = CONSTRUCTION_PHASES.find((p) => p.key === phaseKey);
  return phase?.tasks ?? [];
}

/** Get all predefined tasks across all phases */
export function getAllPredefinedTasks(): PredefinedTask[] {
  return CONSTRUCTION_PHASES.flatMap((phase) => phase.tasks);
}

/** Find a predefined phase by its code (e.g. 'PH-002') */
export function findPhaseByCode(code: string): PredefinedPhase | undefined {
  return CONSTRUCTION_PHASES.find((p) => p.code === code);
}

/** Find a predefined phase by its key (e.g. 'foundation') */
export function findPhaseByKey(key: string): PredefinedPhase | undefined {
  return CONSTRUCTION_PHASES.find((p) => p.key === key);
}

/**
 * Match a phase key from a translated name.
 * Used to detect if a user-selected name matches a predefined phase
 * so we can look up associated tasks.
 */
export function findPhaseKeyByTranslatedName(
  name: string,
  translationFn: (key: string) => string
): string | undefined {
  const normalized = name.trim().toLowerCase();
  return CONSTRUCTION_PHASES.find(
    (p) => translationFn(`tabs.timeline.gantt.templates.phases.${p.key}`).toLowerCase() === normalized
  )?.key;
}
