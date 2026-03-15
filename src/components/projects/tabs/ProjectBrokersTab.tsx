'use client';

/**
 * ProjectBrokersTab — Διαχείριση μεσιτικών συμβάσεων σε επίπεδο έργου
 *
 * Inline form (ΟΧΙ modal) για δημιουργία/επεξεργασία συμβάσεων.
 * Χρησιμοποιεί ContactSearchManager + TabbedAddNewContactDialog (dialog switching).
 *
 * @module components/projects/tabs/ProjectBrokersTab
 * @enterprise ADR-230 / SPEC-230B
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { TabbedAddNewContactDialog } from '@/components/contacts/dialogs/TabbedAddNewContactDialog';
import { EntityFilesManager } from '@/components/shared/files';
import { BrokerageService } from '@/services/brokerage.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { formatCurrency } from '@/lib/intl-utils';
import type { BrokerageAgreement, ExclusivityType, CommissionType } from '@/types/brokerage';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { Briefcase, Plus, Pencil, XCircle, RefreshCw, X, Paperclip } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectBrokersTabProps {
  project?: { id: string; name?: string; [key: string]: unknown };
  data?: { id: string; name?: string; [key: string]: unknown };
}

interface UnitSummary {
  id: string;
  name: string;
}

interface InlineFormState {
  agentContactId: string;
  agentName: string;
  scope: 'project' | 'unit';
  unitId: string;
  exclusivity: ExclusivityType;
  commissionType: CommissionType;
  commissionPercentage: string;
  commissionFixedAmount: string;
  startDate: string;
  endDate: string;
  notes: string;
}

const EMPTY_FORM: InlineFormState = {
  agentContactId: '',
  agentName: '',
  scope: 'project',
  unitId: '',
  exclusivity: 'non_exclusive',
  commissionType: 'percentage',
  commissionPercentage: '',
  commissionFixedAmount: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  notes: '',
};

// ============================================================================
// HELPERS
// ============================================================================

function getStatusBadge(
  agreement: BrokerageAgreement,
  t: (key: string) => string,
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (agreement.status === 'terminated') {
    return { label: t('sales.legal.terminatedAgreement'), variant: 'destructive' };
  }
  if (agreement.endDate && new Date(agreement.endDate) < new Date()) {
    return { label: t('sales.legal.expiredAgreement'), variant: 'secondary' };
  }
  return { label: t('sales.legal.activeAgreement'), variant: 'default' };
}

function formatCommission(agreement: BrokerageAgreement): string {
  if (agreement.commissionType === 'percentage' && agreement.commissionPercentage !== null) {
    return `${agreement.commissionPercentage}%`;
  }
  if (agreement.commissionType === 'fixed' && agreement.commissionFixedAmount !== null) {
    return formatCurrency(agreement.commissionFixedAmount);
  }
  return '—';
}

function agreementToFormState(a: BrokerageAgreement): InlineFormState {
  return {
    agentContactId: a.agentContactId,
    agentName: a.agentName,
    scope: a.scope,
    unitId: a.unitId ?? '',
    exclusivity: a.exclusivity,
    commissionType: a.commissionType,
    commissionPercentage: a.commissionPercentage !== null ? String(a.commissionPercentage) : '',
    commissionFixedAmount: a.commissionFixedAmount !== null ? String(a.commissionFixedAmount) : '',
    startDate: a.startDate.split('T')[0],
    endDate: a.endDate ? a.endDate.split('T')[0] : '',
    notes: a.notes ?? '',
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProjectBrokersTab({ project, data }: ProjectBrokersTabProps) {
  const projectData = project ?? data;
  const projectId = projectData?.id;
  const projectName = (projectData?.name as string) ?? '';

  const { user } = useAuth();
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const companyIdResult = useCompanyId();
  const companyId = companyIdResult?.companyId ?? '';

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

  // New contact dialog (dialog switching pattern — ReserveDialog reference)
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);

  // Terminate/Renew inline actions
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewDate, setRenewDate] = useState('');

  // Derived: is the inline form visible?
  const isFormVisible = showAddForm || editingAgreement !== null;
  const isEditMode = editingAgreement !== null;

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // 🔴 REAL-TIME: onSnapshot subscription for brokerage agreements
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
        collection(db, 'units'),
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

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

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
  }, []);

  const updateForm = useCallback(<K extends keyof InlineFormState>(
    key: K,
    value: InlineFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleAgentSelect = useCallback((contact: ContactSummary | null) => {
    setForm((prev) => ({
      ...prev,
      agentContactId: contact?.id ?? '',
      agentName: contact?.name ?? '',
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.agentContactId || !form.startDate || !projectId) return;
    if (form.scope === 'unit' && !form.unitId) return;

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
      // onSnapshot auto-refreshes — no manual fetch needed
    } catch {
      setFormError(t('sales.legal.saveError'));
    } finally {
      setSaving(false);
    }
  }, [form, projectId, user, isEditMode, editingAgreement, handleCancel, t]);

  // ============================================================================
  // NEW CONTACT DIALOG (dialog switching)
  // ============================================================================

  const handleNewContactCreated = useCallback(() => {
    setShowNewContactDialog(false);
    // ContactSearchManager will auto-reload on re-render
  }, []);

  const handleNewContactCancel = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setShowNewContactDialog(false);
    }
  }, []);

  // ============================================================================
  // TERMINATE / RENEW
  // ============================================================================

  const handleTerminate = useCallback(async (id: string) => {
    const userId = user?.uid ?? 'unknown';
    const result = await BrokerageService.terminateAgreement(id, userId);
    if (result.success) {
      setTerminatingId(null);
      // onSnapshot auto-refreshes
    }
  }, [user]);

  const handleRenew = useCallback(async (id: string) => {
    if (!renewDate) return;
    const userId = user?.uid ?? 'unknown';
    const result = await BrokerageService.updateAgreement(
      id,
      { endDate: renewDate },
      userId
    );
    if (result.success) {
      setRenewingId(null);
      setRenewDate('');
      // onSnapshot auto-refreshes
    }
  }, [user, renewDate]);

  const canSave = form.agentContactId && form.startDate && (form.scope === 'project' || form.unitId);

  if (!projectId) return null;

  // Group by scope
  const projectLevel = agreements.filter((a) => a.scope === 'project');
  const unitLevel = agreements.filter((a) => a.scope === 'unit');
  const unitNameMap = new Map(units.map((u) => [u.id, u.name]));

  return (
    <section className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Briefcase className={iconSizes.md} />
          {t('sales.legal.brokerageTitle')}
        </h3>
        {!isFormVisible && (
          <Button size="sm" onClick={handleAdd}>
            <Plus className={`${iconSizes.sm} mr-1`} />
            {t('sales.legal.addAgreement')}
          </Button>
        )}
      </header>

      {/* ================================================================ */}
      {/* INLINE FORM — Add / Edit */}
      {/* ================================================================ */}
      {isFormVisible && (
        <article className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <header className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              {isEditMode ? t('sales.legal.editAgreement') : t('sales.legal.addAgreement')}
              {projectName && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  — {projectName}
                </span>
              )}
            </h4>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className={iconSizes.sm} />
            </Button>
          </header>

          {/* Agent selection — disabled in edit mode */}
          <fieldset className="space-y-1">
            <ContactSearchManager
              selectedContactId={form.agentContactId}
              onContactSelect={handleAgentSelect}
              label={t('sales.legal.selectAgent')}
              placeholder={t('sales.legal.selectAgent')}
              disabled={isEditMode}
              onCreateNew={isEditMode ? undefined : () => setShowNewContactDialog(true)}
            />
          </fieldset>

          {/* Scope */}
          <fieldset className="space-y-1">
            <Label className="text-sm font-medium">{t('sales.legal.selectScope')}</Label>
            <Select
              value={form.scope}
              onValueChange={(v) => updateForm('scope', v as 'project' | 'unit')}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">{t('sales.legal.scopeProject')}</SelectItem>
                <SelectItem value="unit">{t('sales.legal.scopeUnit')}</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>

          {/* Unit — conditional */}
          {form.scope === 'unit' && (
            <fieldset className="space-y-1">
              <Label className="text-sm font-medium">{t('sales.legal.selectUnit')}</Label>
              <Select value={form.unitId} onValueChange={(v) => updateForm('unitId', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('sales.legal.selectUnit')} />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>
          )}

          {/* Exclusivity */}
          <fieldset className="space-y-1">
            <Label className="text-sm font-medium">{t('sales.legal.exclusivity')}</Label>
            <Select
              value={form.exclusivity}
              onValueChange={(v) => updateForm('exclusivity', v as ExclusivityType)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exclusive">{t('sales.legal.exclusive')}</SelectItem>
                <SelectItem value="non_exclusive">{t('sales.legal.nonExclusive')}</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>

          {/* Commission type + amount */}
          <fieldset className="grid grid-cols-2 gap-3">
            <nav className="space-y-1">
              <Label className="text-sm font-medium">{t('sales.legal.commissionType')}</Label>
              <Select
                value={form.commissionType}
                onValueChange={(v) => updateForm('commissionType', v as CommissionType)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{t('sales.legal.commissionPercentage')}</SelectItem>
                  <SelectItem value="fixed">{t('sales.legal.commissionFixed')}</SelectItem>
                </SelectContent>
              </Select>
            </nav>
            <nav className="space-y-1">
              <Label className="text-sm font-medium">{t('sales.legal.commission')}</Label>
              {form.commissionType === 'percentage' ? (
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.commissionPercentage}
                  onChange={(e) => updateForm('commissionPercentage', e.target.value)}
                  placeholder="2"
                  className="h-9"
                />
              ) : (
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={form.commissionFixedAmount}
                  onChange={(e) => updateForm('commissionFixedAmount', e.target.value)}
                  placeholder="5000"
                  className="h-9"
                />
              )}
            </nav>
          </fieldset>

          {/* Dates */}
          <fieldset className="grid grid-cols-2 gap-3">
            <nav className="space-y-1">
              <Label className="text-sm font-medium">{t('sales.legal.startDate')}</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => updateForm('startDate', e.target.value)}
                className="h-9"
              />
            </nav>
            <nav className="space-y-1">
              <Label className="text-sm font-medium">
                {t('sales.legal.endDate')}
                <span className="ml-1 text-xs text-muted-foreground">({t('sales.legal.indefinite')})</span>
              </Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => updateForm('endDate', e.target.value)}
                className="h-9"
              />
            </nav>
          </fieldset>

          {/* Notes */}
          <fieldset className="space-y-1">
            <Label className="text-sm font-medium">{t('sales.legal.notes')}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => updateForm('notes', e.target.value)}
              rows={2}
              className="resize-none"
            />
          </fieldset>

          {/* Error */}
          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          {/* Actions */}
          <footer className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
              {t('buttons.cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? '...' : t('buttons.save')}
            </Button>
          </footer>
        </article>
      )}

      {/* ================================================================ */}
      {/* NEW CONTACT DIALOG (dialog switching) */}
      {/* ================================================================ */}
      {showNewContactDialog && (
        <TabbedAddNewContactDialog
          open={showNewContactDialog}
          onOpenChange={handleNewContactCancel}
          onContactAdded={handleNewContactCreated}
          allowedContactTypes={['individual', 'company']}
          defaultPersonas={['real_estate_agent']}
        />
      )}

      {/* ================================================================ */}
      {/* AGREEMENTS LIST */}
      {/* ================================================================ */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">...</p>
      )}

      {!isLoading && agreements.length === 0 && !isFormVisible && (
        <p className="text-sm text-muted-foreground">{t('sales.legal.noBrokerage')}</p>
      )}

      {/* Project-level agreements */}
      {projectLevel.length > 0 && (
        <article className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{t('sales.legal.scopeProject')}</h4>
          <ul className="space-y-2">
            {projectLevel.map((a) => (
              <AgreementCard
                key={a.id}
                agreement={a}
                t={t}
                iconSizes={iconSizes}
                unitName={null}
                onEdit={() => handleEdit(a)}
                onTerminate={() => setTerminatingId(a.id)}
                onRenew={() => { setRenewingId(a.id); setRenewDate(''); }}
                isTerminating={terminatingId === a.id}
                isRenewing={renewingId === a.id}
                renewDate={renewingId === a.id ? renewDate : ''}
                onRenewDateChange={setRenewDate}
                onConfirmTerminate={() => handleTerminate(a.id)}
                onConfirmRenew={() => handleRenew(a.id)}
                onCancelAction={() => { setTerminatingId(null); setRenewingId(null); }}
                isFormActive={isFormVisible}
                companyId={companyId}
                currentUserId={user?.uid ?? ''}
                projectId={projectId}
                projectName={projectName}
                isExpanded={expandedAgreementId === a.id}
                onToggleExpand={() => setExpandedAgreementId(
                  expandedAgreementId === a.id ? null : a.id
                )}
              />
            ))}
          </ul>
        </article>
      )}

      {/* Unit-level agreements */}
      {unitLevel.length > 0 && (
        <article className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{t('sales.legal.scopeUnit')}</h4>
          <ul className="space-y-2">
            {unitLevel.map((a) => (
              <AgreementCard
                key={a.id}
                agreement={a}
                t={t}
                iconSizes={iconSizes}
                unitName={a.unitId ? unitNameMap.get(a.unitId) ?? a.unitId : null}
                onEdit={() => handleEdit(a)}
                onTerminate={() => setTerminatingId(a.id)}
                onRenew={() => { setRenewingId(a.id); setRenewDate(''); }}
                isTerminating={terminatingId === a.id}
                isRenewing={renewingId === a.id}
                renewDate={renewingId === a.id ? renewDate : ''}
                onRenewDateChange={setRenewDate}
                onConfirmTerminate={() => handleTerminate(a.id)}
                onConfirmRenew={() => handleRenew(a.id)}
                onCancelAction={() => { setTerminatingId(null); setRenewingId(null); }}
                isFormActive={isFormVisible}
                companyId={companyId}
                currentUserId={user?.uid ?? ''}
                projectId={projectId}
                projectName={projectName}
                isExpanded={expandedAgreementId === a.id}
                onToggleExpand={() => setExpandedAgreementId(
                  expandedAgreementId === a.id ? null : a.id
                )}
              />
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}

// ============================================================================
// AGREEMENT CARD SUB-COMPONENT
// ============================================================================

interface AgreementCardProps {
  agreement: BrokerageAgreement;
  t: (key: string) => string;
  iconSizes: ReturnType<typeof useIconSizes>;
  unitName: string | null;
  onEdit: () => void;
  onTerminate: () => void;
  onRenew: () => void;
  isTerminating: boolean;
  isRenewing: boolean;
  renewDate: string;
  onRenewDateChange: (date: string) => void;
  onConfirmTerminate: () => void;
  onConfirmRenew: () => void;
  onCancelAction: () => void;
  isFormActive: boolean;
  // File upload props
  companyId: string;
  currentUserId: string;
  projectId: string;
  projectName: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function AgreementCard({
  agreement,
  t,
  iconSizes,
  unitName,
  onEdit,
  onTerminate,
  onRenew,
  isTerminating,
  isRenewing,
  renewDate,
  onRenewDateChange,
  onConfirmTerminate,
  onConfirmRenew,
  onCancelAction,
  isFormActive,
  companyId,
  currentUserId,
  projectId,
  projectName,
  isExpanded,
  onToggleExpand,
}: AgreementCardProps) {
  const status = getStatusBadge(agreement, t);
  const isActive = agreement.status === 'active' &&
    (!agreement.endDate || new Date(agreement.endDate) >= new Date());

  return (
    <li className="rounded-lg border p-3 space-y-2">
      <header className="flex items-center justify-between">
        <nav className="flex items-center gap-2">
          <span className="font-medium">{agreement.agentName}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
          {agreement.exclusivity === 'exclusive' && (
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              {t('sales.legal.exclusive')}
            </Badge>
          )}
        </nav>
        <nav className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            title={t('sales.legal.attachFiles')}
          >
            <Paperclip className={`${iconSizes.xs} ${isExpanded ? 'text-primary' : ''}`} />
          </Button>
          {isActive && !isFormActive && (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit} title={t('sales.legal.editAgreement')}>
                <Pencil className={iconSizes.xs} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onRenew} title={t('sales.legal.renewAgreement')}>
                <RefreshCw className={iconSizes.xs} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onTerminate} title={t('sales.legal.terminateAgreement')}>
                <XCircle className={`${iconSizes.xs} text-destructive`} />
              </Button>
            </>
          )}
        </nav>
      </header>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t('sales.legal.commission')}: {formatCommission(agreement)}</span>
        <span>{t('sales.legal.startDate')}: {agreement.startDate.split('T')[0]}</span>
        <span>
          {t('sales.legal.endDate')}:{' '}
          {agreement.endDate ? agreement.endDate.split('T')[0] : t('sales.legal.indefinite')}
        </span>
        {unitName && <span>{unitName}</span>}
      </nav>

      {agreement.notes && (
        <p className="text-xs text-muted-foreground italic">{agreement.notes}</p>
      )}

      {/* Inline terminate confirmation */}
      {isTerminating && (
        <footer className="flex items-center gap-2 rounded bg-destructive/10 p-2">
          <p className="text-sm flex-1">
            {t('sales.legal.terminateConfirm').replace('{{name}}', agreement.agentName)}
          </p>
          <Button size="sm" variant="destructive" onClick={onConfirmTerminate}>
            {t('sales.legal.terminateAgreement')}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancelAction}>
            {t('buttons.cancel')}
          </Button>
        </footer>
      )}

      {/* Inline renew */}
      {isRenewing && (
        <footer className="flex items-center gap-2 rounded bg-blue-50 p-2 dark:bg-blue-950/20">
          <label className="text-sm">{t('sales.legal.renewEndDate')}:</label>
          <input
            type="date"
            value={renewDate}
            onChange={(e) => onRenewDateChange(e.target.value)}
            className="h-8 rounded border px-2 text-sm"
          />
          <Button size="sm" onClick={onConfirmRenew} disabled={!renewDate}>
            {t('sales.legal.renewAgreement')}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancelAction}>
            {t('buttons.cancel')}
          </Button>
        </footer>
      )}

      {/* Expandable file upload section */}
      {isExpanded && companyId && (
        <section className="rounded border bg-muted/20 p-3">
          <EntityFilesManager
            companyId={companyId}
            currentUserId={currentUserId}
            entityType="project"
            entityId={projectId}
            entityLabel={`${projectName} — ${agreement.agentName}`}
            domain="brokerage"
            category="contracts"
            purpose={agreement.id}
          />
        </section>
      )}
    </li>
  );
}
