/**
 * =============================================================================
 * useBrokerageAgreements — State & Handlers for Brokerage Tab
 * =============================================================================
 *
 * Manages real-time agreement subscription, inline form state,
 * exclusivity validation, and terminate/renew actions.
 *
 * @module components/projects/tabs/brokerage/useBrokerageAgreements
 * @enterprise ADR-230 / SPEC-230B
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { BrokerageService } from '@/services/brokerage.service';
import { useAuth } from '@/auth/hooks/useAuth';
import type {
  BrokerageAgreement,
  ExclusivityValidationResult,
} from '@/types/brokerage';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { InlineFormState, UnitSummary } from './brokerage-form-types';
import { EMPTY_FORM } from './brokerage-form-types';
import { agreementToFormState } from './brokerage-helpers';

// =============================================================================
// HOOK
// =============================================================================

export function useBrokerageAgreements(
  projectId: string | undefined,
  t: (key: string, params?: Record<string, string>) => string
) {
  const { user } = useAuth();

  // File upload — expand/collapse per agreement
  const [expandedAgreementId, setExpandedAgreementId] = useState<string | null>(null);

  // Data
  const [agreements, setAgreements] = useState<BrokerageAgreement[]>([]);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Inline form
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<BrokerageAgreement | null>(null);
  const [form, setForm] = useState<InlineFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [validationResult, setValidationResult] = useState<ExclusivityValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // New contact dialog
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);

  // Terminate/Renew
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewDate, setRenewDate] = useState('');

  // Derived
  const isFormVisible = showAddForm || editingAgreement !== null;
  const isEditMode = editingAgreement !== null;

  // ---------------------------------------------------------------------------
  // DATA FETCHING — Real-time onSnapshot
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!projectId) return;
    setIsLoading(true);

    const q = query(
      collection(db, COLLECTIONS.BROKERAGE_AGREEMENTS),
      where('projectId', '==', projectId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BrokerageAgreement);
        setAgreements(data);
        setIsLoading(false);
      },
      () => {
        setAgreements([]);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [projectId]);

  const fetchUnits = useCallback(async () => {
    if (!projectId) return;
    try {
      const q = query(
        collection(db, COLLECTIONS.UNITS),
        where('projectId', '==', projectId)
      );
      const snap = await getDocs(q);
      const list: UnitSummary[] = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data().name as string) || (d.data().unitName as string) || d.id,
      }));
      setUnits(list);
    } catch {
      setUnits([]);
    }
  }, [projectId]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // ---------------------------------------------------------------------------
  // EXCLUSIVITY VALIDATION (debounced)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isFormVisible || !projectId) {
      setValidationResult(null);
      return;
    }

    if (form.scope === 'unit' && !form.unitId) {
      setValidationResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      try {
        const result = await BrokerageService.validateExclusivity({
          projectId,
          unitId: form.scope === 'unit' ? form.unitId : null,
          scope: form.scope,
          exclusivity: form.exclusivity,
          excludeAgreementId: editingAgreement?.id,
        });
        setValidationResult(result);
      } catch {
        setValidationResult(null);
      } finally {
        setIsValidating(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isFormVisible, projectId, form.scope, form.unitId, form.exclusivity, editingAgreement?.id]);

  // ---------------------------------------------------------------------------
  // FORM HANDLERS
  // ---------------------------------------------------------------------------

  const handleAdd = useCallback(() => {
    setEditingAgreement(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowAddForm(true);
  }, []);

  const handleEdit = useCallback((agreement: BrokerageAgreement) => {
    setShowAddForm(false);
    setEditingAgreement(agreement);
    setForm(agreementToFormState(agreement));
    setFormError('');
  }, []);

  const handleCancel = useCallback(() => {
    setShowAddForm(false);
    setEditingAgreement(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setValidationResult(null);
  }, []);

  const updateForm = useCallback(<K extends keyof InlineFormState>(
    key: K,
    value: InlineFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleAgentSelect = useCallback((contact: ContactSummary | null) => {
    if (contact && !isEditMode) {
      const hasActive = agreements.some(
        (a) => a.agentContactId === contact.id && a.status === 'active'
          && (!a.endDate || new Date(a.endDate) >= new Date())
      );
      if (hasActive) {
        const msg = t('sales.legal.duplicateAgent', { agentName: contact.name })
          .replace(/\{\{agentName\}\}/g, contact.name);
        setFormError(msg);
        return;
      }
    }
    setFormError('');
    setForm((prev) => ({
      ...prev,
      agentContactId: contact?.id ?? '',
      agentName: contact?.name ?? '',
    }));
  }, [agreements, isEditMode, t]);

  const handleSave = useCallback(async () => {
    if (!form.agentContactId || !form.startDate || !projectId) return;
    if (form.scope === 'unit' && !form.unitId) return;

    if (!isEditMode) {
      const hasActive = agreements.some(
        (a) => a.agentContactId === form.agentContactId && a.status === 'active'
          && (!a.endDate || new Date(a.endDate) >= new Date())
      );
      if (hasActive) {
        const msg = t('sales.legal.duplicateAgent', { agentName: form.agentName })
          .replace(/\{\{agentName\}\}/g, form.agentName);
        setFormError(msg);
        return;
      }
    }

    setSaving(true);
    setFormError('');

    try {
      const userId = user?.uid ?? 'unknown';

      if (isEditMode && editingAgreement) {
        const result = await BrokerageService.updateAgreement(
          editingAgreement.id,
          {
            scope: form.scope,
            unitId: form.scope === 'unit' ? form.unitId : null,
            exclusivity: form.exclusivity,
            commissionType: form.commissionType,
            commissionPercentage: form.commissionType === 'percentage' ? Number(form.commissionPercentage) : null,
            commissionFixedAmount: form.commissionType === 'fixed' ? Number(form.commissionFixedAmount) : null,
            startDate: form.startDate,
            endDate: form.endDate || null,
            notes: form.notes || null,
          },
          userId
        );
        if (!result.success) {
          setFormError(result.error ?? t('sales.legal.saveError'));
          return;
        }
      } else {
        const result = await BrokerageService.createAgreement(
          {
            agentContactId: form.agentContactId,
            agentName: form.agentName,
            scope: form.scope,
            projectId,
            unitId: form.scope === 'unit' ? form.unitId : undefined,
            exclusivity: form.exclusivity,
            commissionType: form.commissionType,
            commissionPercentage: form.commissionType === 'percentage' ? Number(form.commissionPercentage) : undefined,
            commissionFixedAmount: form.commissionType === 'fixed' ? Number(form.commissionFixedAmount) : undefined,
            startDate: form.startDate,
            endDate: form.endDate || undefined,
            notes: form.notes || undefined,
          },
          userId
        );
        if (!result.success) {
          setFormError(result.error ?? t('sales.legal.saveError'));
          return;
        }
      }

      handleCancel();
    } catch {
      setFormError(t('sales.legal.saveError'));
    } finally {
      setSaving(false);
    }
  }, [form, projectId, user, isEditMode, editingAgreement, handleCancel, t, agreements]);

  // ---------------------------------------------------------------------------
  // NEW CONTACT DIALOG
  // ---------------------------------------------------------------------------

  const handleNewContactCreated = useCallback(() => {
    setShowNewContactDialog(false);
  }, []);

  const handleNewContactCancel = useCallback((isOpen: boolean) => {
    if (!isOpen) setShowNewContactDialog(false);
  }, []);

  const openNewContactDialog = useCallback(() => {
    setShowNewContactDialog(true);
  }, []);

  // ---------------------------------------------------------------------------
  // TERMINATE / RENEW
  // ---------------------------------------------------------------------------

  const handleTerminate = useCallback(async (id: string) => {
    const userId = user?.uid ?? 'unknown';
    const result = await BrokerageService.terminateAgreement(id, userId);
    if (result.success) setTerminatingId(null);
  }, [user]);

  const handleRenew = useCallback(async (id: string) => {
    if (!renewDate) return;
    const userId = user?.uid ?? 'unknown';
    const result = await BrokerageService.updateAgreement(id, { endDate: renewDate }, userId);
    if (result.success) {
      setRenewingId(null);
      setRenewDate('');
    }
  }, [user, renewDate]);

  const cancelAction = useCallback(() => {
    setTerminatingId(null);
    setRenewingId(null);
  }, []);

  const hasValidationErrors = validationResult?.issues.some((i) => i.severity === 'error') ?? false;
  const canSave = form.agentContactId && form.startDate
    && (form.scope === 'project' || form.unitId)
    && !hasValidationErrors;

  return {
    // Data
    agreements,
    units,
    isLoading,

    // Form
    form,
    updateForm,
    isFormVisible,
    isEditMode,
    showAddForm,
    saving,
    formError,
    canSave,

    // Validation
    validationResult,
    isValidating,

    // Actions
    handleAdd,
    handleEdit,
    handleCancel,
    handleSave,
    handleAgentSelect,

    // Contact dialog
    showNewContactDialog,
    openNewContactDialog,
    handleNewContactCreated,
    handleNewContactCancel,

    // Terminate/Renew
    terminatingId,
    setTerminatingId,
    renewingId,
    setRenewingId,
    renewDate,
    setRenewDate,
    handleTerminate,
    handleRenew,
    cancelAction,

    // Files
    expandedAgreementId,
    setExpandedAgreementId,
  };
}
