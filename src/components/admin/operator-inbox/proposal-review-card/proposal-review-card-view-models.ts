import type { PipelineAction } from '@/types/ai-pipeline';
import type {
  CreateAppointmentActionView,
  MatchedUnitDisplay,
  ReplyPropertyListActionView,
} from './proposal-review-card-types';

const readString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const readNullableString = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

const readNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' ? value : undefined;
};

const readNullableNumber = (value: unknown): number | null | undefined => {
  if (value === null) return null;
  return typeof value === 'number' ? value : undefined;
};

const readBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const readMatchedUnits = (value: unknown): MatchedUnitDisplay[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((unit): unit is Record<string, unknown> => typeof unit === 'object' && unit !== null)
    .map((unit) => ({
      name: readString(unit.name),
      type: readString(unit.type),
      area: readNumber(unit.area),
      floor: readNumber(unit.floor),
      building: readString(unit.building),
      price: readNullableNumber(unit.price),
      rooms: readNullableNumber(unit.rooms),
    }));
};

export const getReplyPropertyListActionView = (action: PipelineAction): ReplyPropertyListActionView => {
  return {
    senderName: readString(action.params.senderName),
    criteriaSummary: readString(action.params.criteriaSummary),
    matchingUnitsCount: readNumber(action.params.matchingUnitsCount),
    totalAvailable: readNumber(action.params.totalAvailable),
    matchingUnits: readMatchedUnits(action.params.matchingUnits),
    draftReply: readString(action.params.draftReply),
  };
};

export const getCreateAppointmentActionView = (action: PipelineAction): CreateAppointmentActionView => {
  return {
    senderName: readString(action.params.senderName),
    requestedDate: readNullableString(action.params.requestedDate),
    requestedTime: readNullableString(action.params.requestedTime),
    description: readString(action.params.description),
    draftReply: readString(action.params.draftReply),
    aiGenerated: readBoolean(action.params.aiGenerated),
    operatorBriefing: readString(action.params.operatorBriefing),
    hasTimeConflict: readBoolean(action.params.hasTimeConflict),
  };
};

export const getVisibleActionParams = (params: Record<string, unknown>, hiddenKeys: Set<string>) => {
  return Object.entries(params).filter(([key]) => !hiddenKeys.has(key));
};
