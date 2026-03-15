'use client';

/**
 * ProjectBrokersTab — Διαχείριση μεσιτικών συμβάσεων σε επίπεδο έργου
 *
 * @module components/projects/tabs/ProjectBrokersTab
 * @enterprise ADR-230 / SPEC-230B
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BrokerageService } from '@/services/brokerage.service';
import { BrokerageAgreementDialog } from '@/components/sales/brokerage/BrokerageAgreementDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import { formatCurrency } from '@/lib/intl-utils';
import type { BrokerageAgreement } from '@/types/brokerage';
import { Briefcase, Plus, Pencil, XCircle, RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

// ============================================================================
// HELPERS
// ============================================================================

function getStatusBadge(
  agreement: BrokerageAgreement,
  t: (key: string) => string,
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (agreement.status === 'terminated') {
    return { label: t('legal.terminatedAgreement'), variant: 'destructive' };
  }
  if (agreement.endDate && new Date(agreement.endDate) < new Date()) {
    return { label: t('legal.expiredAgreement'), variant: 'secondary' };
  }
  return { label: t('legal.activeAgreement'), variant: 'default' };
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

// ============================================================================
// COMPONENT
// ============================================================================

export function ProjectBrokersTab({ project, data }: ProjectBrokersTabProps) {
  const projectData = project ?? data;
  const projectId = projectData?.id;
  const projectName = (projectData?.name as string) ?? '';

  const { user } = useAuth();
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  const [agreements, setAgreements] = useState<BrokerageAgreement[]>([]);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<BrokerageAgreement | null>(null);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewDate, setRenewDate] = useState('');

  const fetchAgreements = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const data = await BrokerageService.getAgreements(projectId);
      setAgreements(data);
    } catch {
      setAgreements([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Fetch lightweight unit list for the project
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
    fetchAgreements();
    fetchUnits();
  }, [fetchAgreements, fetchUnits]);

  const handleTerminate = useCallback(async (id: string) => {
    const userId = user?.uid ?? 'unknown';
    const result = await BrokerageService.terminateAgreement(id, userId);
    if (result.success) {
      setTerminatingId(null);
      fetchAgreements();
    }
  }, [user, fetchAgreements]);

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
      fetchAgreements();
    }
  }, [user, renewDate, fetchAgreements]);

  const handleEdit = useCallback((agreement: BrokerageAgreement) => {
    setEditingAgreement(agreement);
    setDialogOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingAgreement(null);
    setDialogOpen(true);
  }, []);

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
          {t('legal.brokerageTitle')}
        </h3>
        <Button size="sm" onClick={handleAdd}>
          <Plus className={`${iconSizes.sm} mr-1`} />
          {t('legal.addAgreement')}
        </Button>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground">...</p>
      )}

      {!isLoading && agreements.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('legal.noBrokerage')}</p>
      )}

      {/* Project-level agreements */}
      {projectLevel.length > 0 && (
        <article className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{t('legal.scopeProject')}</h4>
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
              />
            ))}
          </ul>
        </article>
      )}

      {/* Unit-level agreements */}
      {unitLevel.length > 0 && (
        <article className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{t('legal.scopeUnit')}</h4>
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
              />
            ))}
          </ul>
        </article>
      )}

      {/* Dialog */}
      <BrokerageAgreementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        projectName={projectName}
        units={units}
        existingAgreement={editingAgreement}
        onSuccess={fetchAgreements}
      />
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
}: AgreementCardProps) {
  const status = getStatusBadge(agreement, t);
  const isActive = agreement.status === 'active' &&
    (!agreement.endDate || new Date(agreement.endDate) >= new Date());

  return (
    <li className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{agreement.agentName}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
          {agreement.exclusivity === 'exclusive' && (
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              {t('legal.exclusive')}
            </Badge>
          )}
        </div>
        {isActive && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} title={t('legal.editAgreement')}>
              <Pencil className={iconSizes.xs} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onRenew} title={t('legal.renewAgreement')}>
              <RefreshCw className={iconSizes.xs} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onTerminate} title={t('legal.terminateAgreement')}>
              <XCircle className={`${iconSizes.xs} text-destructive`} />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t('legal.commission')}: {formatCommission(agreement)}</span>
        <span>{t('legal.startDate')}: {agreement.startDate.split('T')[0]}</span>
        <span>
          {t('legal.endDate')}:{' '}
          {agreement.endDate ? agreement.endDate.split('T')[0] : t('legal.indefinite')}
        </span>
        {unitName && <span>{unitName}</span>}
      </div>

      {agreement.notes && (
        <p className="text-xs text-muted-foreground italic">{agreement.notes}</p>
      )}

      {/* Inline terminate confirmation */}
      {isTerminating && (
        <div className="flex items-center gap-2 rounded bg-destructive/10 p-2">
          <p className="text-sm flex-1">
            {t('legal.terminateConfirm').replace('{{name}}', agreement.agentName)}
          </p>
          <Button size="sm" variant="destructive" onClick={onConfirmTerminate}>
            {t('legal.terminateAgreement')}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancelAction}>
            {t('buttons.cancel')}
          </Button>
        </div>
      )}

      {/* Inline renew */}
      {isRenewing && (
        <div className="flex items-center gap-2 rounded bg-blue-50 p-2 dark:bg-blue-950/20">
          <label className="text-sm">{t('legal.renewEndDate')}:</label>
          <input
            type="date"
            value={renewDate}
            onChange={(e) => onRenewDateChange(e.target.value)}
            className="h-8 rounded border px-2 text-sm"
          />
          <Button size="sm" onClick={onConfirmRenew} disabled={!renewDate}>
            {t('legal.renewAgreement')}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancelAction}>
            {t('buttons.cancel')}
          </Button>
        </div>
      )}
    </li>
  );
}
