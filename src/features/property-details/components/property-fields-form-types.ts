/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Form Types
 * =============================================================================
 *
 * Shared types between PropertyFieldsBlock (orchestrator) and PropertyFieldsEditForm (renderer).
 * Extracted for SRP compliance (ADR N.7.1).
 *
 * @module features/property-details/components/property-fields-form-types
 * @since 2026-03-27
 */

import type { Dispatch, SetStateAction } from 'react';
import type { CommercialStatus, OperationalStatus, LevelData, PropertyLevel, PropertyType } from '@/types/property';
import type { Property } from '@/types/property-viewer';
import type { TFunction } from 'i18next';

/** Flat form data state for the property fields form */
export interface PropertyFieldsFormData {
  name: string;
  code: string;
  type: string;
  // ADR-284 Batch 7: Hierarchy fields (required when creating new unit)
  // For existing units these may be empty strings — not shown in edit mode.
  projectId: string;
  buildingId: string;
  floorId: string;
  operationalStatus: OperationalStatus;
  commercialStatus: CommercialStatus;
  description: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  wc: number;
  areaGross: number;
  areaNet: number;
  areaBalcony: number;
  areaTerrace: number;
  areaGarden: number;
  orientations: string[];
  condition: string;
  energyClass: string;
  heatingType: string;
  coolingType: string;
  flooring: string[];
  windowFrames: string;
  glazing: string;
  interiorFeatures: string[];
  securityFeatures: string[];
  levelData: Record<string, LevelData>;
  /** ADR-236 Phase 4: Multi-level floors (populated during creation, read from property during edit) */
  levels: PropertyLevel[];
  askingPrice: string;
}

/** Props for the form renderer component */
export interface PropertyFieldsEditFormProps {
  /** Current form state */
  formData: PropertyFieldsFormData;
  /** State setter */
  setFormData: Dispatch<SetStateAction<PropertyFieldsFormData>>;
  /** Original property from Firestore */
  property: Property;
  /** Whether form is in editing mode */
  isEditing: boolean;
  /** ADR-284 Batch 7: When creating new unit, Type field is shown in NewUnitHierarchySection (above) — hide here to avoid duplicate. */
  isCreatingNewUnit?: boolean;
  /** Reserved or sold (identity fields locked) */
  isReservedOrSold: boolean;
  /** ADR-236: Fields locked until hierarchy (type + building + floor) is selected during creation */
  isHierarchyLocked: boolean;
  /** ADR-236: Callback when floors change via FloorMultiSelectField (creation only) */
  onLevelsChange?: (levels: PropertyLevel[]) => void;
  /** ADR-236: Building ID for FloorMultiSelectField (creation only) */
  creationBuildingId?: string | null;
  /** ADR-236: Project ID for FloorInlineCreateForm SSoT (creation only) */
  creationProjectId?: string | null;
  /** ADR-236: True when user confirmed "no next floor" warning — show create form immediately */
  needsFloorCreation?: boolean;
  /** Sold or rented (physical fields locked) */
  isSoldOrRented: boolean;
  /** Multi-level unit */
  isMultiLevel: boolean;
  /** ADR-236 Phase 4: SSoT levels source — formData.levels (creation) OR property.levels (edit) */
  effectiveLevels: PropertyLevel[];
  /** Active level tab (null = totals) */
  activeLevelId: string | null;
  /** Set active level */
  setActiveLevelId: (id: string | null) => void;
  /** Current level's data (null = totals view) */
  currentLevelData: LevelData | null;
  /** Aggregated totals for multi-level units */
  aggregatedTotals: { areas: Record<string, number>; layout: Record<string, number>; orientations: string[] } | null;
  /** Toggle array item (orientations, flooring, features) */
  toggleArrayItem: <T extends string>(
    field: 'orientations' | 'flooring' | 'interiorFeatures' | 'securityFeatures',
    value: T
  ) => void;
  /** Update a specific level's data */
  updateLevelField: <K extends keyof LevelData>(field: K, value: LevelData[K]) => void;
  /** Save handler */
  handleSave: () => void;
  // ── ADR-233: Entity code — sealed via EntityCodeField ──────────────────────
  /** Building ID to pass to EntityCodeField (empty string disables suggestion) */
  codeBuildingId: string;
  /** Floor level to pass to EntityCodeField */
  codeFloorLevel: number;
  /** Property type to pass to EntityCodeField */
  codePropertyType: PropertyType | undefined;
  /** Called by EntityCodeField.onChange — updates formData.code in orchestrator */
  onCodeChange: (code: string) => void;
  /** Called by EntityCodeField when auto-suggestion is applied — drives auto-save */
  onCodeAutoApply: (code: string) => void;
  /** Called by EntityCodeField when suggestion value changes — orchestrator keeps reference */
  onSuggestionChange: (suggestion: string | null) => void;
  /** ADR-233: Notify parent when type changes in form — triggers code re-suggestion */
  onTypeChange: (type: string) => void;
  /** Notify parent when user manually edits the name — disables auto-suggestion */
  onNameManualEdit: (value: string) => void;
  /** Notify parent when area changes — triggers name auto-suggestion if not user-edited */
  onAreaChange: (areaKey: 'net' | 'gross', value: number) => void;
  /** Translation function (scoped to 'units') */
  t: TFunction;
  /** Typography tokens */
  typography: ReturnType<typeof import('@/hooks/useTypography').useTypography>;
  /** Icon size tokens */
  iconSizes: ReturnType<typeof import('@/hooks/useIconSizes').useIconSizes>;
  /** Border tokens */
  quick: { input: string };
}
