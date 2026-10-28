'use client';

/**
 * usePurchaseOrderForm — Form state management for PO create/edit
 *
 * Manages line items, totals calculation, validation, and the save call.
 * Submission state (lock, pending, error) lives in the SSoT `useFormSubmission`,
 * owned by the form component (ADR-598 «(η)») — `save()` only persists or throws.
 * Auto-calculates subtotal/tax/total on item changes.
 *
 * @module hooks/procurement/usePurchaseOrderForm
 * @see ADR-267 §Phase A
 */

import { useState, useCallback, useMemo } from 'react';
import { generateTempId } from '@/services/enterprise-id.service';
import {
  createPurchaseOrderWithPolicy,
  updatePurchaseOrderWithPolicy,
} from '@/services/procurement/procurement-mutation-gateway';
import type {
  PurchaseOrder,
  POVatRate,
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
} from '@/types/procurement';
import type { POPricingMode } from '@/lib/procurement/po-pricing-carry';
import { DEFAULT_UOM } from '@/lib/uom/uom-registry';

/** Ένα πρόβλημα επικύρωσης: κλειδί `form.validation.<key>` + αριθμός γραμμής όπου αφορά γραμμή. */
export interface POFormIssue {
  key: 'projectRequired' | 'supplierRequired' | 'itemsRequired' | 'descriptionRequired' | 'quantityPositive' | 'categoryRequired';
  line?: number;
}

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
  unit: DEFAULT_UOM,
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

  // Τα σύνολα ΔΕΝ υπολογίζονται εδώ: τα δίνει η `usePOPricing` με την ίδια συνάρτηση του server
  // (ADR-923 §5.11 «3γ» — πριν ο τύπος ζούσε εδώ ως πέμπτο αντίγραφο, σε float).

  // ── Pricing intent (ADR-923 «3γ», Α9) ──
  // `carry` = η επεξεργασία κρατά τους όρους της PO· `redetermine` μόνο μετά από ρητή επιβεβαίωση.
  const [pricingMode, setPricingMode] = useState<POPricingMode>('carry');

  // ── Validation ──
  // Κλειδιά, όχι κείμενο (N.11): τα μεταφράζει η φόρμα στο `form.validation.*`.

  const validationErrors = useMemo(() => {
    const errors: POFormIssue[] = [];
    if (!form.projectId) errors.push({ key: 'projectRequired' });
    if (!form.supplierId) errors.push({ key: 'supplierRequired' });
    if (form.items.length === 0) errors.push({ key: 'itemsRequired' });

    form.items.forEach((item, idx) => {
      const line = idx + 1;
      if (!item.description) errors.push({ key: 'descriptionRequired', line });
      if (item.quantity <= 0) errors.push({ key: 'quantityPositive', line });
      if (!item.categoryCode) errors.push({ key: 'categoryRequired', line });
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

  /**
   * Persists the PO or throws. The caller's `useFormSubmission` guards validity and re-entry.
   * `expectedTotal` = το πληρωτέο που δείχνει η φόρμα· ο server αρνείται (409) αν βγάλει άλλο.
   */
  const save = useCallback(async (poId: string | undefined, expectedTotal: number) => {
    const dto = buildDTO();
    if (!poId) return createPurchaseOrderWithPolicy(dto);
    const update: UpdatePurchaseOrderDTO = { ...dto, pricingMode, expectedTotal };
    return updatePurchaseOrderWithPolicy(poId, update);
  }, [buildDTO, pricingMode]);

  // ── Reset ──

  const reset = useCallback(() => {
    setForm(getInitialState(existingPO));
  }, [existingPO]);

  return {
    form,
    setField,
    addItem,
    removeItem,
    updateItem,
    validationErrors,
    isValid,
    isEditMode,
    pricingMode,
    setPricingMode,
    save,
    reset,
  };
}
