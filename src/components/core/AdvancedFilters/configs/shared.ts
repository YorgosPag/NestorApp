import {
  PROPERTY_FILTER_LABELS,
  COMMON_FILTER_LABELS,
  UNIFIED_STATUS_FILTER_LABELS,
  BUILDING_PROJECT_STATUS_LABELS,
  PROPERTY_BUILDING_TYPE_LABELS,
  PROJECT_TYPE_LABELS,
  PRIORITY_LABELS,
} from '@/constants/property-statuses-enterprise';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { TRIAGE_STATUSES } from '@/types/crm';

export {
  PROPERTY_FILTER_LABELS,
  COMMON_FILTER_LABELS,
  UNIFIED_STATUS_FILTER_LABELS,
  BUILDING_PROJECT_STATUS_LABELS,
  PROPERTY_BUILDING_TYPE_LABELS,
  PROJECT_TYPE_LABELS,
  PRIORITY_LABELS,
  COMMUNICATION_CHANNELS,
  TRIAGE_STATUSES,
};

export const AFO = {
  parking: 'filters.advancedOptions.parking',
  storage: 'filters.advancedOptions.storage',
  fireplace: 'filters.advancedOptions.fireplace',
  view: 'filters.advancedOptions.view',
  pool: 'filters.advancedOptions.pool',
  is_favorite_contacts: 'filters.advancedOptions.isFavoriteContacts',
  has_email: 'filters.advancedOptions.hasEmail',
  has_phone: 'filters.advancedOptions.hasPhone',
  recent_activity: 'filters.advancedOptions.recentActivity',
} as const;

export const RL = {
  units_all: 'filters.ranges.unitsAll',
  units_1_2: 'filters.ranges.units1to2',
  units_3_5: 'filters.ranges.units3to5',
  units_6_plus: 'filters.ranges.units6Plus',
  areas_all: 'filters.ranges.areasAll',
  area_up_to_100: 'filters.ranges.areaUpTo100',
  area_101_300: 'filters.ranges.area101to300',
  area_301_plus: 'filters.ranges.area301Plus',
} as const;

export const TASK_STATUS_LABELS = {
  pending: 'filters.status.pending',
  in_progress: 'filters.status.inProgress',
  completed: 'filters.status.completed',
  cancelled: 'filters.status.cancelled',
} as const;

export const TASK_TYPE_LABELS = {
  call: 'filters.taskTypes.call',
  email: 'filters.taskTypes.email',
  meeting: 'filters.taskTypes.meeting',
  viewing: 'filters.taskTypes.viewing',
  follow_up: 'filters.taskTypes.followUp',
  document: 'filters.taskTypes.document',
  other: 'filters.taskTypes.other',
} as const;

export const TASK_TIMEFRAME_LABELS = {
  overdue: 'filters.timeframe.overdue',
  today: 'filters.timeframe.today',
  tomorrow: 'filters.timeframe.tomorrow',
  week: 'filters.timeframe.week',
} as const;

export const CRM_STAGE_LABELS = {
  initial_contact: 'filters.crmStages.initial_contact',
  qualification: 'filters.crmStages.qualification',
  viewing: 'filters.crmStages.viewing',
  proposal: 'filters.crmStages.proposal',
  negotiation: 'filters.crmStages.negotiation',
  contract: 'filters.crmStages.contract',
  closed_won: 'filters.crmStages.closed_won',
  closed_lost: 'filters.crmStages.closed_lost',
} as const;

export const CRM_STATUS_LABELS = {
  active: 'filters.crmStatus.active',
  inactive: 'filters.crmStatus.inactive',
  pending: 'filters.crmStatus.pending',
} as const;

export const CRM_PERIOD_LABELS = {
  day: 'filters.crmPeriod.day',
  week: 'filters.crmPeriod.week',
  month: 'filters.crmPeriod.month',
  year: 'filters.crmPeriod.year',
} as const;

export const FL = PROPERTY_FILTER_LABELS;

export const SP = {
  general: 'filters.placeholders.general',
  units_search: 'filters.placeholders.unitsSearch',
  contacts_search: 'filters.placeholders.contactsSearch',
  buildings_search: 'filters.placeholders.buildingsSearch',
  projects_search: 'filters.placeholders.projectsSearch',
  status_placeholder: 'filters.placeholders.selectStatus',
  project_placeholder: 'filters.placeholders.selectProject',
  building_placeholder: 'filters.placeholders.selectBuilding',
  floor_placeholder: 'filters.placeholders.selectFloor',
  type_placeholder: 'filters.placeholders.selectType',
  priority_placeholder: 'filters.placeholders.selectPriority',
  location_placeholder: 'filters.placeholders.selectLocation',
  company_placeholder: 'filters.placeholders.selectCompany',
  energy_class_placeholder: 'filters.placeholders.selectEnergyClass',
  renovation_placeholder: 'filters.placeholders.selectRenovation',
  client_placeholder: 'filters.placeholders.selectClient',
  risk_level_placeholder: 'filters.placeholders.selectRiskLevel',
  complexity_placeholder: 'filters.placeholders.selectComplexity',
} as const;

export const FT = {
  units: 'filters.unitsTitle',
  contacts: 'filters.title',
  buildings: 'filters.title',
  projects: 'filters.title',
  advanced: 'filters.showAdvanced',
} as const;

export const PROPERTY_AREA_RANGE_PRESETS = [
  { id: 'all', label: 'filters.areaPresets.all', min: null, max: null },
  { id: 'small', label: 'filters.areaPresets.small', min: 0, max: 50 },
  { id: 'medium', label: 'filters.areaPresets.medium', min: 50, max: 100 },
  { id: 'large', label: 'filters.areaPresets.large', min: 100, max: 200 },
  { id: 'veryLarge', label: 'filters.areaPresets.veryLarge', min: 200, max: null },
  { id: 'custom', label: 'filters.areaPresets.custom', min: null, max: null },
] as const;
