/**
 * useBOQEditorState — Form state + handlers for BOQItemEditor (ADR-329)
 *
 * Form state covers all 5 scopes (building / common_areas / floor / property /
 * properties) + cost allocation (by_area / equal / custom). Draft-lock guard
 * (§3.3.1) freezes scope-related fields when status !== 'draft'.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/useBOQEditorState
 * @see ADR-175 §4.4.3, ADR-329 §3.1, §3.2, §3.3
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BOQItem,
  BOQItemStatus,
  BOQMeasurementUnit,
  BOQScope,
  CostAllocationMethod,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { getAllowedUnits, getDefaultWasteFactor } from '@/config/boq-categories';
import { computeGrossQuantity } from '@/services/measurements';

// ============================================================================
// CONSTANTS
// ============================================================================

export const ALL_UNITS: BOQMeasurementUnit[] = [
  'm', 'm2', 'm3', 'kg', 'ton', 'pcs', 'lt', 'set', 'hr', 'day', 'lump',
];

export const ALLOWED_TRANSITIONS: Record<BOQItemStatus, BOQItemStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'draft'],
  approved: ['certified', 'submitted'],
  certified: ['locked', 'approved'],
  locked: [],
};

const SCOPE_FIELDS: ReadonlyArray<keyof EditorFormState> = [
  'scope', 'linkedFloorId', 'linkedUnitId', 'linkedUnitIds',
  'costAllocationMethod', 'customAllocations',
];

// ============================================================================
// FORM STATE
// ============================================================================

export interface EditorFormState {
  categoryCode: string;
  title: string;
  description: string;
  scope: BOQScope;
  linkedFloorId: string;
  linkedUnitId: string;
  linkedUnitIds: string[];
  costAllocationMethod: CostAllocationMethod;
  customAllocations: Record<string, number>;
  unit: BOQMeasurementUnit;
  estimatedQuantity: string;
  wasteFactor: string;
  actualQuantity: string;
  materialUnitCost: string;
  laborUnitCost: string;
  equipmentUnitCost: string;
  linkedPhaseId: string;
  notes: string;
  status: BOQItemStatus;
}

export function createInitialState(item: BOQItem | null, defaultCategory: string): EditorFormState {
  if (item) {
    return {
      categoryCode: item.categoryCode,
      title: item.title,
      description: item.description ?? '',
      scope: item.scope,
      linkedFloorId: item.linkedFloorId ?? '',
      linkedUnitId: item.linkedUnitId ?? '',
      linkedUnitIds: item.linkedUnitIds ?? [],
      costAllocationMethod: item.costAllocationMethod ?? 'by_area',
      customAllocations: item.customAllocations ?? {},
      unit: item.unit,
      estimatedQuantity: String(item.estimatedQuantity),
      wasteFactor: String(item.wasteFactor * 100),
      actualQuantity: item.actualQuantity !== null ? String(item.actualQuantity) : '',
      materialUnitCost: String(item.materialUnitCost),
      laborUnitCost: String(item.laborUnitCost),
      equipmentUnitCost: String(item.equipmentUnitCost),
      linkedPhaseId: item.linkedPhaseId ?? '',
      notes: item.notes ?? '',
      status: item.status,
    };
  }

  return {
    categoryCode: defaultCategory,
    title: '',
    description: '',
    scope: 'building',
    linkedFloorId: '',
    linkedUnitId: '',
    linkedUnitIds: [],
    costAllocationMethod: 'by_area',
    customAllocations: {},
    unit: 'm2',
    estimatedQuantity: '0',
    wasteFactor: String(getDefaultWasteFactor(defaultCategory) * 100),
    actualQuantity: '',
    materialUnitCost: '0',
    laborUnitCost: '0',
    equipmentUnitCost: '0',
    linkedPhaseId: '',
    notes: '',
    status: 'draft',
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ScopeValidationResult {
  valid: boolean;
  errorKey: string | null;
}

export function validateScope(form: EditorFormState): ScopeValidationResult {
  switch (form.scope) {
    case 'building':
    case 'common_areas':
      return { valid: true, errorKey: null };
    case 'floor':
      return form.linkedFloorId
        ? { valid: true, errorKey: null }
        : { valid: false, errorKey: 'tabs.measurements.scope.floorPickerEmpty' };
    case 'property':
      return form.linkedUnitId
        ? { valid: true, errorKey: null }
        : { valid: false, errorKey: 'tabs.measurements.scope.propertiesPickerEmpty' };
    case 'properties':
      return form.linkedUnitIds.length >= 2
        ? { valid: true, errorKey: null }
        : { valid: false, errorKey: 'tabs.measurements.scope.propertiesPickerMinError' };
  }
}

export function validateCustomAllocations(form: EditorFormState): boolean {
  if (form.costAllocationMethod !== 'custom') return true;
  const sum = Object.values(form.customAllocations).reduce((s, v) => s + v, 0);
  return Math.abs(sum - 100) < 0.01;
}

// ============================================================================
// HOOK
// ============================================================================

interface UseBOQEditorParams {
  open: boolean;
  item: BOQItem | null;
  categories: readonly MasterBOQCategory[];
  buildingId: string;
  projectId: string;
  onSave: (data: CreateBOQItemInput | UpdateBOQItemInput, isNew: boolean) => Promise<void>;
  onClose: () => void;
}

export function useBOQEditorState({
  open, item, categories, buildingId, projectId, onSave, onClose,
}: UseBOQEditorParams) {
  const isEdit = item !== null;
  const defaultCategory = categories[0]?.code ?? 'OIK-1';

  const [form, setForm] = useState<EditorFormState>(() => createInitialState(item, defaultCategory));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(createInitialState(item, defaultCategory));
  }, [open, item, defaultCategory]);

  const scopeLocked = isEdit && form.status !== 'draft';

  // Computed
  const numericEstimated = parseFloat(form.estimatedQuantity) || 0;
  const numericWaste = (parseFloat(form.wasteFactor) || 0) / 100;
  const grossQuantity = computeGrossQuantity(numericEstimated, numericWaste);
  const materialCost = parseFloat(form.materialUnitCost) || 0;
  const laborCost = parseFloat(form.laborUnitCost) || 0;
  const equipmentCost = parseFloat(form.equipmentUnitCost) || 0;
  const totalUnitCost = materialCost + laborCost + equipmentCost;
  const totalCost = grossQuantity * totalUnitCost;

  const allowedUnits = useMemo(() => {
    const catUnits = getAllowedUnits(form.categoryCode);
    return catUnits.length > 0 ? catUnits : ALL_UNITS;
  }, [form.categoryCode]);

  const availableStatuses = useMemo<BOQItemStatus[]>(() => {
    if (!isEdit) return [];
    return [form.status, ...ALLOWED_TRANSITIONS[form.status]];
  }, [isEdit, form.status]);

  const scopeValidation = useMemo(() => validateScope(form), [form]);
  const customAllocationsValid = useMemo(() => validateCustomAllocations(form), [form]);

  const updateField = useCallback(
    <K extends keyof EditorFormState>(key: K, value: EditorFormState[K]) => {
      if (scopeLocked && SCOPE_FIELDS.includes(key)) return;
      setForm((prev) => ({ ...prev, [key]: value }));
    }, [scopeLocked],
  );

  const handleScopeChange = useCallback((next: BOQScope) => {
    if (scopeLocked) return;
    setForm((prev) => ({
      ...prev,
      scope: next,
      linkedFloorId: next === 'floor' ? prev.linkedFloorId : '',
      linkedUnitId: next === 'property' ? prev.linkedUnitId : '',
      linkedUnitIds: next === 'properties' ? prev.linkedUnitIds : [],
    }));
  }, [scopeLocked]);

  const handleCategoryChange = useCallback((code: string) => {
    const defaultWaste = getDefaultWasteFactor(code) * 100;
    const catUnits = getAllowedUnits(code);
    const currentUnitValid = catUnits.includes(form.unit);
    setForm((prev) => ({
      ...prev,
      categoryCode: code,
      wasteFactor: String(defaultWaste),
      unit: currentUnitValid ? prev.unit : (catUnits[0] ?? 'm2'),
    }));
  }, [form.unit]);

  const buildScopePayload = useCallback((): Pick<
    CreateBOQItemInput,
    'scope' | 'linkedFloorId' | 'linkedUnitId' | 'linkedUnitIds'
    | 'costAllocationMethod' | 'customAllocations'
  > => {
    return {
      scope: form.scope,
      linkedFloorId: form.scope === 'floor' ? form.linkedFloorId || null : null,
      linkedUnitId: form.scope === 'property' ? form.linkedUnitId || null : null,
      linkedUnitIds: form.scope === 'properties' ? form.linkedUnitIds : null,
      costAllocationMethod: form.costAllocationMethod,
      customAllocations: form.costAllocationMethod === 'custom' ? form.customAllocations : null,
    };
  }, [form]);

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) return;
    if (!scopeValidation.valid) return;
    if (!customAllocationsValid) return;
    setSaving(true);
    try {
      if (isEdit) {
        const updateData: UpdateBOQItemInput = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          unit: form.unit,
          estimatedQuantity: numericEstimated,
          wasteFactor: numericWaste,
          actualQuantity: form.actualQuantity ? parseFloat(form.actualQuantity) : null,
          materialUnitCost: materialCost,
          laborUnitCost: laborCost,
          equipmentUnitCost: equipmentCost,
          linkedPhaseId: form.linkedPhaseId || null,
          notes: form.notes.trim() || null,
        };
        await onSave(updateData, false);
      } else {
        const createData: CreateBOQItemInput = {
          projectId, buildingId,
          ...buildScopePayload(),
          categoryCode: form.categoryCode,
          title: form.title.trim(),
          description: form.description.trim() || null,
          unit: form.unit,
          estimatedQuantity: numericEstimated,
          wasteFactor: numericWaste,
          materialUnitCost: materialCost,
          laborUnitCost: laborCost,
          equipmentUnitCost: equipmentCost,
          linkedPhaseId: form.linkedPhaseId || null,
          notes: form.notes.trim() || null,
        };
        await onSave(createData, true);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }, [
    form, isEdit, scopeValidation.valid, customAllocationsValid,
    numericEstimated, numericWaste, materialCost, laborCost, equipmentCost,
    projectId, buildingId, buildScopePayload, onSave, onClose,
  ]);

  return {
    form, saving, isEdit, scopeLocked,
    grossQuantity, materialCost, laborCost, equipmentCost, totalCost,
    allowedUnits, availableStatuses,
    scopeValidation, customAllocationsValid,
    updateField, handleScopeChange, handleCategoryChange, handleSave,
  };
}
