'use client';

/**
 * usePurchaseOrderForm — Form state management for PO create/edit
 *
 * Manages line items, totals calculation, validation, and API submission.
 * Auto-calculates subtotal/tax/total on item changes.
 *
 * @module hooks/procurement/usePurchaseOrderForm
 * @see ADR-267 §Phase A
 */

import { useState, useCallback, useMemo } from 'react';
import { generateTempId } from '@/services/enterprise-id.service';
import { savePurchaseOrderWithPolicy } from '@/services/procurement/procurement-mutation-gateway';
import type {
  PurchaseOrder,
  POVatRate,
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
} from '@/types/procurement';

// ============================================================================
// FORM STATE
// ============================================================================

interface POFormItem {
  tempId: string;  // client-side key for React list rendering
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  boqItemId: string | null;
  categoryCode: string;
  materialId: string | null;
}

export interface POFormState {
  projectId: string;
  buildingId: string | null;
  supplierId: string;
  items: POFormItem[];
  taxRate: POVatRate;
  dateNeeded: string;
  deliveryAddress: string;
  paymentTermsDays: string;
  supplierNotes: string;
  internalNotes: string;
}

const EMPTY_ITEM: POFormItem = {
  tempId: '',
  description: '',
  quantity: 1,
  unit: 'τεμ',
  unitPrice: 0,
  boqItemId: null,
  categoryCode: '',
  materialId: null,
};

function createEmptyItem(): POFormItem {
  return { ...EMPTY_ITEM, tempId: generateTempId() };
}

function getInitialState(po?: PurchaseOrder | null, initialProjectId?: string): POFormState {
  if (!po) {
    return {
      projectId: initialProjectId ?? '',
      buildingId: null,
      supplierId: '',
      items: [createEmptyItem()],
      taxRate: 24,
      dateNeeded: '',
      deliveryAddress: '',
      paymentTermsDays: '',
      supplierNotes: '',
      internalNotes: '',
    };
  }

  return {
    projectId: po.projectId,
    buildingId: po.buildingId,
    supplierId: po.supplierId,
    items: po.items.map((i) => ({
      tempId: generateTempId(),
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      boqItemId: i.boqItemId,
      categoryCode: i.categoryCode,
      materialId: i.materialId ?? null,
    })),
    taxRate: po.taxRate,
    dateNeeded: po.dateNeeded ?? '',
    deliveryAddress: po.deliveryAddress ?? '',
    paymentTermsDays: po.paymentTermsDays?.toString() ?? '',
    supplierNotes: po.supplierNotes ?? '',
    internalNotes: po.internalNotes ?? '',
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function usePurchaseOrderForm(existingPO?: PurchaseOrder | null, initialProjectId?: string) {
  const [form, setForm] = useState<POFormState>(() => getInitialState(existingPO, initialProjectId));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditMode = !!existingPO;

  // ── Field setters ──

  const setField = useCallback(<K extends keyof POFormState>(
    key: K,
    value: POFormState[K]
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  // ── Item operations ──

  const addItem = useCallback(() => {
    setForm((f) => ({
      ...f,
      items: [...f.items, createEmptyItem()],
    }));
  }, []);

  const removeItem = useCallback((tempId: string) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((i) => i.tempId !== tempId),
    }));
  }, []);

  const updateItem = useCallback((
    tempId: string,
    updates: Partial<POFormItem>
  ) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) =>
        i.tempId === tempId ? { ...i, ...updates } : i
      ),
    }));
  }, []);

  // ── Computed totals ──

  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (sum, i) => sum + i.quantity * i.unitPrice, 0
    );
    const taxAmount = Math.round(subtotal * (form.taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    return { subtotal, taxAmount, total };
  }, [form.items, form.taxRate]);

  // ── Validation ──

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!form.projectId) errors.push('Επιλέξτε έργο');
    if (!form.supplierId) errors.push('Επιλέξτε προμηθευτή');
    if (form.items.length === 0) errors.push('Προσθέστε τουλάχιστον 1 είδος');

    form.items.forEach((item, idx) => {
      if (!item.description) errors.push(`Είδος ${idx + 1}: Περιγραφή απαιτείται`);
      if (item.quantity <= 0) errors.push(`Είδος ${idx + 1}: Ποσότητα > 0`);
      if (!item.categoryCode) errors.push(`Είδος ${idx + 1}: Κωδικός ΑΤΟΕ απαιτείται`);
    });

    return errors;
  }, [form]);

  const isValid = validationErrors.length === 0;

  // ── Submit ──

  const buildDTO = useCallback((): CreatePurchaseOrderDTO => ({
    projectId: form.projectId,
    buildingId: form.buildingId,
    supplierId: form.supplierId,
    items: form.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      total: i.quantity * i.unitPrice,
      boqItemId: i.boqItemId,
      categoryCode: i.categoryCode,
      materialId: i.materialId,
    })),
    taxRate: form.taxRate,
    dateNeeded: form.dateNeeded || null,
    deliveryAddress: form.deliveryAddress || null,
    paymentTermsDays: form.paymentTermsDays
      ? parseInt(form.paymentTermsDays, 10)
      : null,
    supplierNotes: form.supplierNotes || null,
    internalNotes: form.internalNotes || null,
  }), [form]);

  const submit = useCallback(async (
    poId?: string,
    faExtra?: Pick<CreatePurchaseOrderDTO, 'appliedFaId' | 'faDiscountPercent' | 'faDiscountAmount' | 'netTotal'>,
  ): Promise<{
    success: boolean;
    id?: string;
    poNumber?: string;
    error?: string;
  }> => {
    if (!isValid) {
      return { success: false, error: validationErrors[0] };
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const dto = faExtra ? { ...buildDTO(), ...faExtra } : buildDTO();
      const result = await savePurchaseOrderWithPolicy(
        poId ? dto as UpdatePurchaseOrderDTO : dto,
        poId,
      );

      return {
        success: true,
        id: result.id,
        poNumber: result.poNumber,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setSubmitError(msg);
      return { success: false, error: msg };
    } finally {
      setSubmitting(false);
    }
  }, [isValid, validationErrors, buildDTO]);

  // ── Reset ──

  const reset = useCallback(() => {
    setForm(getInitialState(existingPO));
    setSubmitError(null);
  }, [existingPO]);

  return {
    form,
    setField,
    addItem,
    removeItem,
    updateItem,
    totals,
    validationErrors,
    isValid,
    isEditMode,
    submitting,
    submitError,
    submit,
    reset,
  };
}
