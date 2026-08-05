/**
 * @related ADR-759 §4.2 — building an empty `SurveyRecord`
 *
 * A new record is **fully populated with empty fields**, never a sparse object.
 * ADR-759 §4.2 rule 3: `Παρέκκλιση`, `Σύστημα`, `ΟΡΟΦΟΙ` are blank in the real
 * drawing because the engineer does not have them yet — and the engineer must be
 * able to see **what is missing**. A field that is absent renders as nothing;
 * a field that is present and empty renders as a question waiting for an answer.
 */
import { generateSurveyRecordId } from '@/services/enterprise-id.service';
import {
  emptySourced,
  type ImplementationAct,
  type SurveyBuildingTerms,
  type SurveyInstitutionalActs,
  type SurveyRecord,
  type SurveySettlement,
} from '@/types/project-survey-record';

function emptyBuildingTerms(): SurveyBuildingTerms {
  return {
    sector: emptySourced<string>(),
    plotBoundaryLabels: emptySourced<readonly string[]>(),
    minFrontage: emptySourced<number>(),
    minArea: emptySourced<number>(),
    deviation: emptySourced<string>(),
    buildingSystem: emptySourced<string>(),
    declaredCoveragePct: emptySourced<number>(),
    maxCoveragePct: emptySourced<number>(),
    declaredMaxHeight: emptySourced<string>(),
    declaredFloors: emptySourced<number>(),
    declaredSd: emptySourced<number>(),
    socialFactorSd: emptySourced<number>(),
    totalSd: emptySourced<number>(),
    landUse: emptySourced<string>(),
    inSocialFactorZone: emptySourced<boolean>(),
  };
}

function emptyImplementationAct(): ImplementationAct {
  return {
    number: emptySourced<string>(),
    decision: emptySourced<string>(),
    volume: emptySourced<string>(),
    entry: emptySourced<string>(),
    date: emptySourced<string>(),
    registry: emptySourced<string>(),
    urbanUnits: emptySourced<readonly string[]>(),
    originalProperties: emptySourced<readonly string[]>(),
  };
}

function emptyInstitutionalActs(): SurveyInstitutionalActs {
  return { urbanPlanDecree: [], generalUrbanPlan: [], zoningRegulations: [] };
}

function emptySettlement(): SurveySettlement {
  return {
    settlementActs: emptySourced<string>(),
    implementationAct: emptyImplementationAct(),
  };
}

export interface CreateSurveyRecordInput {
  readonly companyId: string;
  readonly projectId: string;
  readonly createdBy: string;
  /** ISO timestamp — injected so the factory stays pure and testable. */
  readonly now: string;
  readonly sourceFileName?: string | null;
}

/**
 * Build a brand-new, unconfirmed survey record.
 *
 * The id comes from `enterprise-id.service` (N.6) — never `addDoc`, never
 * `crypto.randomUUID()` inline.
 */
export function createEmptySurveyRecord(input: CreateSurveyRecordInput): SurveyRecord {
  return {
    id: generateSurveyRecordId(),
    companyId: input.companyId,
    projectId: input.projectId,

    sourceFileName: input.sourceFileName ?? null,
    sourceCadFileId: null,
    surveyDate: emptySourced<string>(),
    surveyorContactId: null,

    buildingTerms: emptyBuildingTerms(),
    institutionalActs: emptyInstitutionalActs(),
    settlement: emptySettlement(),
    isBuildable: emptySourced<boolean>(),
    buildabilityNote: emptySourced<string>(),
    roadPlanDefinition: emptySourced<string>(),
    suspensionStatus: emptySourced<string>(),
    plotArea: emptySourced<number>(),
    heightDatum: emptySourced<string>(),
    remarks: [],
    approvals: [],
    titleDeeds: [],

    reconciliations: [],

    // 🔴 Unconfirmed by construction. ADR-745 §8 rule 1: creation is not
    // identification, and a record nobody has vouched for must never be treated
    // as a source of truth.
    confirmedBy: null,
    confirmedAt: null,

    createdBy: input.createdBy,
    createdAt: input.now,
    updatedAt: input.now,
  };
}
