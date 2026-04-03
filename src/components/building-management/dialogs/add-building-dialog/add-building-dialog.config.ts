import type { BuildingType, BuildingPriority, EnergyClass, Building } from '@/types/building/contracts';
import type { BuildingCategory, BuildingStatus, BuildingFormData } from '../../hooks/useBuildingForm';

export interface AddBuildingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuildingAdded?: () => void;
  companyId: string;
  companyName?: string;
  editBuilding?: Building | null;
}

export interface SelectOption<TValue extends string> {
  value: TValue;
  labelKey: string;
}

export interface BuildingDialogDataSources {
  allProjects: import('../../building-services').ProjectListItem[];
  projectsLoading: boolean;
  companies: import('@/types/contacts').CompanyContact[];
  companiesLoading: boolean;
  selectedCompanyFilter: string;
  setSelectedCompanyFilter: (value: string) => void;
}

export interface BuildingDialogTabProps {
  formData: BuildingFormData;
  loading: boolean;
  errors: Partial<Record<keyof BuildingFormData, string>>;
  t: (key: string) => string;
  handleChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: keyof BuildingFormData, value: string) => void;
  handleCheckboxChange: (name: keyof BuildingFormData, checked: boolean) => void;
  handleNumberChange: (name: keyof BuildingFormData, value: string) => void;
}

export const BUILDING_STATUS_OPTIONS: SelectOption<BuildingStatus>[] = [
  { value: 'planning', labelKey: 'status.planning' },
  { value: 'construction', labelKey: 'status.construction' },
  { value: 'completed', labelKey: 'status.completed' },
  { value: 'active', labelKey: 'status.active' },
];

export const BUILDING_CATEGORY_OPTIONS: SelectOption<BuildingCategory>[] = [
  { value: 'residential', labelKey: 'categories.residential' },
  { value: 'commercial', labelKey: 'categories.commercial' },
  { value: 'industrial', labelKey: 'categories.industrial' },
  { value: 'mixed', labelKey: 'categories.mixed' },
];

export const BUILDING_TYPE_OPTIONS: SelectOption<BuildingType>[] = [
  { value: 'residential', labelKey: 'filters.types.residential' },
  { value: 'commercial', labelKey: 'filters.types.commercial' },
  { value: 'industrial', labelKey: 'filters.types.industrial' },
  { value: 'mixed', labelKey: 'filters.types.mixed' },
  { value: 'office', labelKey: 'filters.types.office' },
  { value: 'warehouse', labelKey: 'filters.types.warehouse' },
];

export const PRIORITY_OPTIONS: SelectOption<BuildingPriority>[] = [
  { value: 'low', labelKey: 'filters.priority.low' },
  { value: 'medium', labelKey: 'filters.priority.medium' },
  { value: 'high', labelKey: 'filters.priority.high' },
  { value: 'critical', labelKey: 'filters.priority.critical' },
];

export const ENERGY_CLASS_OPTIONS: EnergyClass[] = ['A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'F', 'G'];

export const BASIC_TAB_ERROR_FIELDS: Array<keyof BuildingFormData> = [
  'name',
  'projectId',
  'status',
  'category',
  'description',
];

export const DETAILS_TAB_ERROR_FIELDS: Array<keyof BuildingFormData> = [
  'address',
  'city',
  'totalArea',
  'builtArea',
  'floors',
  'units',
  'totalValue',
  'startDate',
  'completionDate',
];

export const FEATURES_TAB_ERROR_FIELDS: Array<keyof BuildingFormData> = [
  'hasParking',
  'hasElevator',
  'hasGarden',
  'hasPool',
  'accessibility',
  'energyClass',
  'type',
  'priority',
];
