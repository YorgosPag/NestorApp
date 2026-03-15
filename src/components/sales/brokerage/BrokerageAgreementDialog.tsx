'use client';

/**
 * BrokerageAgreementDialog — Create/Edit brokerage agreement
 *
 * @module components/sales/brokerage/BrokerageAgreementDialog
 * @enterprise ADR-230 / SPEC-230B
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { BrokerageService } from '@/services/brokerage.service';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BrokerageAgreement, ExclusivityType, CommissionType } from '@/types/brokerage';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { Briefcase } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// ============================================================================
// TYPES
// ============================================================================

interface BrokerageAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  units: Array<{ id: string; name: string }>;
  existingAgreement?: BrokerageAgreement | null;
  onSuccess: () => void;
  /** Pre-select unit (used from SellDialog quick-add) */
  preSelectedUnitId?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BrokerageAgreementDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  units,
  existingAgreement,
  onSuccess,
  preSelectedUnitId,
}: BrokerageAgreementDialogProps) {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const isEdit = !!existingAgreement;

  // Form state
  const [agentContactId, setAgentContactId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [scope, setScope] = useState<'project' | 'unit'>('project');
  const [unitId, setUnitId] = useState<string>('');
  const [exclusivity, setExclusivity] = useState<ExclusivityType>('non_exclusive');
  const [commissionType, setCommissionType] = useState<CommissionType>('percentage');
  const [commissionPercentage, setCommissionPercentage] = useState('');
  const [commissionFixedAmount, setCommissionFixedAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog opens or existingAgreement changes
  useEffect(() => {
    if (!open) return;

    if (existingAgreement) {
      setAgentContactId(existingAgreement.agentContactId);
      setAgentName(existingAgreement.agentName);
      setScope(existingAgreement.scope);
      setUnitId(existingAgreement.unitId ?? '');
      setExclusivity(existingAgreement.exclusivity);
      setCommissionType(existingAgreement.commissionType);
      setCommissionPercentage(
        existingAgreement.commissionPercentage !== null
          ? String(existingAgreement.commissionPercentage)
          : ''
      );
      setCommissionFixedAmount(
        existingAgreement.commissionFixedAmount !== null
          ? String(existingAgreement.commissionFixedAmount)
          : ''
      );
      setStartDate(existingAgreement.startDate.split('T')[0]);
      setEndDate(existingAgreement.endDate ? existingAgreement.endDate.split('T')[0] : '');
      setNotes(existingAgreement.notes ?? '');
    } else {
      setAgentContactId('');
      setAgentName('');
      setScope(preSelectedUnitId ? 'unit' : 'project');
      setUnitId(preSelectedUnitId ?? '');
      setExclusivity('non_exclusive');
      setCommissionType('percentage');
      setCommissionPercentage('');
      setCommissionFixedAmount('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setNotes('');
    }
    setError('');
  }, [open, existingAgreement, preSelectedUnitId]);

  const handleAgentSelect = useCallback((contact: ContactSummary | null) => {
    setAgentContactId(contact?.id ?? '');
    setAgentName(contact?.name ?? '');
  }, []);

  const handleSave = useCallback(async () => {
    if (!agentContactId || !startDate) return;
    if (scope === 'unit' && !unitId) return;

    setSaving(true);
    setError('');

    try {
      const userId = user?.uid ?? 'unknown';

      if (isEdit && existingAgreement) {
        const result = await BrokerageService.updateAgreement(
          existingAgreement.id,
          {
            scope,
            unitId: scope === 'unit' ? unitId : null,
            exclusivity,
            commissionType,
            commissionPercentage: commissionType === 'percentage' ? Number(commissionPercentage) : null,
            commissionFixedAmount: commissionType === 'fixed' ? Number(commissionFixedAmount) : null,
            startDate,
            endDate: endDate || null,
            notes: notes || null,
          },
          userId
        );

        if (!result.success) {
          setError(result.error ?? t('legal.saveError'));
          return;
        }
      } else {
        const result = await BrokerageService.createAgreement(
          {
            agentContactId,
            agentName,
            scope,
            projectId,
            unitId: scope === 'unit' ? unitId : undefined,
            exclusivity,
            commissionType,
            commissionPercentage: commissionType === 'percentage' ? Number(commissionPercentage) : undefined,
            commissionFixedAmount: commissionType === 'fixed' ? Number(commissionFixedAmount) : undefined,
            startDate,
            endDate: endDate || undefined,
            notes: notes || undefined,
          },
          userId
        );

        if (!result.success) {
          setError(result.error ?? t('legal.saveError'));
          return;
        }
      }

      onOpenChange(false);
      onSuccess();
    } catch {
      setError(t('legal.saveError'));
    } finally {
      setSaving(false);
    }
  }, [
    agentContactId, agentName, scope, unitId, exclusivity,
    commissionType, commissionPercentage, commissionFixedAmount,
    startDate, endDate, notes, projectId, user, isEdit, existingAgreement,
    onOpenChange, onSuccess, t,
  ]);

  const canSave = agentContactId && startDate && (scope === 'project' || unitId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className={iconSizes.sm} />
            {isEdit ? t('legal.editAgreement') : t('legal.addAgreement')}
          </DialogTitle>
          <DialogDescription>
            {projectName}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-4 py-2">
          {/* Agent selection — disabled in edit mode */}
          <fieldset className="space-y-1">
            <ContactSearchManager
              selectedContactId={agentContactId}
              onContactSelect={handleAgentSelect}
              label={t('legal.selectAgent')}
              placeholder={t('legal.selectAgent')}
              disabled={isEdit}
            />
          </fieldset>

          {/* Scope */}
          <fieldset className="space-y-1">
            <Label className="text-sm font-medium">{t('legal.selectScope')}</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as 'project' | 'unit')}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">{t('legal.scopeProject')}</SelectItem>
                <SelectItem value="unit">{t('legal.scopeUnit')}</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>

          {/* Unit selector — visible only when scope=unit */}
          {scope === 'unit' && (
            <fieldset className="space-y-1">
              <Label className="text-sm font-medium">{t('legal.selectUnit')}</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('legal.selectUnit')} />
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
            <Label className="text-sm font-medium">{t('legal.exclusivity')}</Label>
            <Select value={exclusivity} onValueChange={(v) => setExclusivity(v as ExclusivityType)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exclusive">{t('legal.exclusive')}</SelectItem>
                <SelectItem value="non_exclusive">{t('legal.nonExclusive')}</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>

          {/* Commission type + amount */}
          <fieldset className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t('legal.commissionType')}</Label>
              <Select value={commissionType} onValueChange={(v) => setCommissionType(v as CommissionType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{t('legal.commissionPercentage')}</SelectItem>
                  <SelectItem value="fixed">{t('legal.commissionFixed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t('legal.commission')}</Label>
              {commissionType === 'percentage' ? (
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={commissionPercentage}
                  onChange={(e) => setCommissionPercentage(e.target.value)}
                  placeholder="2"
                  className="h-9"
                />
              ) : (
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={commissionFixedAmount}
                  onChange={(e) => setCommissionFixedAmount(e.target.value)}
                  placeholder="5000"
                  className="h-9"
                />
              )}
            </div>
          </fieldset>

          {/* Dates */}
          <fieldset className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t('legal.startDate')}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {t('legal.endDate')}
                <span className="ml-1 text-xs text-muted-foreground">({t('legal.indefinite')})</span>
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9"
              />
            </div>
          </fieldset>

          {/* Notes */}
          <fieldset className="space-y-1">
            <Label className="text-sm font-medium">{t('legal.notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </fieldset>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('buttons.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving ? '...' : t('buttons.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
