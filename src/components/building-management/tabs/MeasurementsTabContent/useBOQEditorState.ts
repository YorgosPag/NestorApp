/**
 * useBOQEditorState — Form state + handlers for BOQItemEditor
 * Extracted for file-size compliance (<500 lines).
 *
 * @module components/building-management/tabs/MeasurementsTabContent/useBOQEditorState
 * @see ADR-175 §4.4.3 (SCREEN 2)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BOQItem,
  BOQItemStatus,
  BOQMeasurementUnit,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { getAllowedUnits, getDefaultWasteFactor } from '@/config/boq-categories';
import { computeGrossQuantity } from '@/services/measurements';

// ============================================================================
// TYPES + CONSTANTS
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

export interface EditorFormState {
  categoryCode: string;
  title: string;
  description: string;
  scope: 'building' | 'property';
  linkedUnitId: string;
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
      linkedUnitId: item.linkedUnitId ?? '',
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
    linkedUnitId: '',
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

  const updateField = useCallback(
    <K extends keyof EditorFormState>(key: K, value: EditorFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    }, []
  );

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

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) return;
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
          scope: form.scope,
          linkedUnitId: form.scope === 'property' ? form.linkedUnitId || null : null,
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
  }, [form, isEdit, numericEstimated, numericWaste, materialCost, laborCost, equipmentCost, projectId, buildingId, onSave, onClose]);

  return {
    form, saving, isEdit,
    grossQuantity, materialCost, laborCost, equipmentCost, totalCost,
    allowedUnits, availableStatuses,
    updateField, handleCategoryChange, handleSave,
  };
}
