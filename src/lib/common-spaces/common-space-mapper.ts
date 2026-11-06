/**
 * Έγγραφο Firestore → `CommonSpace` (καθαρό, ADR-931) — ο **ένας** mapper για server και client.
 *
 * Επικύρωση στο σύνορο: κατηγορία/φύση εκτός λεξιλογίου δεν «μαντεύονται» — η κατηγορία πέφτει
 * σε `other` και η φύση στον κανόνα του ΑΚ 1117 (`common_use`), ώστε ένα παλιό ή χειροποίητο
 * έγγραφο να **φαίνεται** (και να διορθώνεται) αντί να εξαφανίζεται από τα σύνολα.
 *
 * @module lib/common-spaces/common-space-mapper
 */

import {
  DEFAULT_COMMON_SPACE_LEGAL_NATURE,
  isCommonSpaceCategory,
  isCommonSpaceLegalNature,
} from '@/constants/common-space-categories';
import { normalizeOperationalStatus } from '@/constants/operational-statuses';
import { ACTIVE_RECORD_STATUS, TRASHED_STATUS } from '@/lib/firestore/trashed-status';
import { normalizeToISO } from '@/lib/date-local';
import { isFloorKind } from '@/utils/floor-naming';
import type { CommonSpace } from '@/types/common-space';
import { isCommonSpaceAreaSource } from '@/lib/common-spaces/common-space-area';

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter((id): id is string => typeof id === 'string' && id !== '');
  return ids.length > 0 ? ids : undefined;
}

export function mapCommonSpaceDoc(id: string, data: Readonly<Record<string, unknown>>): CommonSpace {
  return {
    id,
    name: text(data.name) ?? id,
    code: text(data.code),
    category: isCommonSpaceCategory(data.category) ? data.category : 'other',
    legalNature: isCommonSpaceLegalNature(data.legalNature) ? data.legalNature : DEFAULT_COMMON_SPACE_LEGAL_NATURE,
    exclusiveUsePropertyIds: stringList(data.exclusiveUsePropertyIds),
    status: data.status === TRASHED_STATUS ? TRASHED_STATUS : ACTIVE_RECORD_STATUS,
    operationalStatus: normalizeOperationalStatus(data.operationalStatus) ?? undefined,
    buildingId: text(data.buildingId) ?? '',
    projectId: text(data.projectId),
    companyId: text(data.companyId),
    floorId: text(data.floorId),
    floor: typeof data.floor === 'number' ? data.floor : undefined,
    floorKind: isFloorKind(data.floorKind) ? data.floorKind : undefined,
    area: positiveNumber(data.area),
    drawnArea: positiveNumber(data.drawnArea),
    areaSource: isCommonSpaceAreaSource(data.areaSource) ? data.areaSource : undefined,
    description: text(data.description),
    notes: text(data.notes),
    createdAt: normalizeToISO(data.createdAt) ?? undefined,
    updatedAt: normalizeToISO(data.updatedAt) ?? undefined,
    _v: typeof data._v === 'number' ? data._v : undefined,
  };
}
