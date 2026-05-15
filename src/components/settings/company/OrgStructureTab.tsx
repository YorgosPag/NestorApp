'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, RotateCcw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DepartmentEditor } from './DepartmentEditor';
import { OrgTreeView } from './OrgTreeView';
import { DEPARTMENT_CODES } from '@/config/department-codes';
import { DEFAULT_EVENT_TO_DEPARTMENT } from '@/config/notification-events';
import type { OrgStructure, OrgDepartment } from '@/types/org/org-structure';
import type { DepartmentCode } from '@/config/department-codes';
import type { NotificationEventCode } from '@/config/notification-events';

interface OrgStructureTabProps {
  orgStructure: OrgStructure | null;
  saving: boolean;
  onSave: (updated: OrgStructure) => void;
}

export function OrgStructureTab({ orgStructure, saving, onSave }: OrgStructureTabProps) {
  const { t } = useTranslation('org-structure');
  const [editingDept, setEditingDept] = useState<OrgDepartment | 'new' | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [archivingDeptId, setArchivingDeptId] = useState<string | null>(null);
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);

  const departments = orgStructure?.departments ?? [];

  const usedCanonicalCodes: DepartmentCode[] = departments
    .filter((d) => d.code !== DEPARTMENT_CODES.CUSTOM)
    .map((d) => d.code);

  const toggleExpand = (id: string) =>
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleDeptSave = (dept: OrgDepartment) => {
    const existing = departments.find((d) => d.id === dept.id);
    const updated = existing
      ? departments.map((d) => (d.id === dept.id ? dept : d))
      : [...departments, dept];

    onSave({
      ...(orgStructure ?? { id: '', updatedAt: new Date(), updatedBy: '' }),
      departments: updated,
    });
    setEditingDept(null);
  };

  const handleRestoreDept = (id: string) => {
    const updated = departments.map((d) =>
      d.id === id ? { ...d, status: 'active' as const } : d,
    );
    onSave({ ...orgStructure!, departments: updated });
    toast.success(t('orgStructure.dept.restoredOk'));
  };

  const handleArchiveConfirm = () => {
    if (!archivingDeptId) return;
    const updated = departments.map((d) =>
      d.id === archivingDeptId ? { ...d, status: 'archived' as const } : d,
    );
    onSave({ ...orgStructure!, departments: updated });
    toast.success(t('orgStructure.dept.archivedOk'));
    setArchivingDeptId(null);
  };

  const handleDeleteDept = () => {
    if (!deletingDeptId) return;
    const updated = departments.filter((d) => d.id !== deletingDeptId);
    onSave({ ...orgStructure!, departments: updated });
    toast.success(t('orgStructure.dept.deletedOk'));
    setDeletingDeptId(null);
  };

  const sortedDepts = [...departments].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === 'active' ? -1 : 1;
  });

  const archivingDept = departments.find((d) => d.id === archivingDeptId);
  const deletingDept = departments.find((d) => d.id === deletingDeptId);

  const getRoutingDeps = (dept: OrgDepartment) => {
    const customRules = orgStructure?.notificationRouting?.filter(
      (r) => r.targetDepartmentCode === dept.code,
    ) ?? [];
    const defaultEvents = (Object.entries(DEFAULT_EVENT_TO_DEPARTMENT) as [NotificationEventCode, DepartmentCode][])
      .filter(([, code]) => code === dept.code)
      .map(([event]) => event);
    return { customRules, defaultEvents };
  };

  const buildRoutingBlock = (dept: OrgDepartment, note: string) => {
    const { customRules, defaultEvents } = getRoutingDeps(dept);
    if (customRules.length === 0 && defaultEvents.length === 0) return null;
    const customLine = customRules.length === 1
      ? t('orgStructure.dept.routingCustomRulesSingular')
      : customRules.length > 1
        ? t('orgStructure.dept.routingCustomRules', { count: customRules.length })
        : null;
    return (
      <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 space-y-1 text-xs">
        <p className="font-semibold text-amber-600">{t('orgStructure.dept.routingImpactTitle')}</p>
        {customLine && <p>• {customLine}</p>}
        {defaultEvents.length > 0 && (
          <>
            <p>{t('orgStructure.dept.routingDefaultFor')}</p>
            {defaultEvents.map((ev) => (
              <p key={ev} className="pl-2">– {t(`routing.events.${ev}`)}</p>
            ))}
          </>
        )}
        <p className="text-amber-700 mt-1">{note}</p>
      </div>
    );
  };

  const buildArchiveDesc = (dept: OrgDepartment) => (
    <span>
      {t('orgStructure.dept.archiveConfirmDesc')}
      {buildRoutingBlock(dept, t('orgStructure.dept.routingArchiveNote'))}
    </span>
  );

  const buildDeleteDesc = (dept: OrgDepartment) => {
    const memberLine = dept.members.length === 1
      ? t('orgStructure.dept.deleteMemberWarningSingular')
      : dept.members.length > 1
        ? t('orgStructure.dept.deleteMemberWarning', { count: dept.members.length })
        : null;
    return (
      <span>
        {t('orgStructure.dept.deleteConfirmDesc')}
        {memberLine && <><br />{memberLine}</>}
        {buildRoutingBlock(dept, t('orgStructure.dept.routingDeleteNote'))}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{t('orgStructure.subtitle')}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditingDept('new')}
          disabled={saving}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t('orgStructure.dept.addDept')}
        </Button>
      </div>

      {sortedDepts.length === 0 && (
        <p className="text-sm opacity-60 py-4 text-center">
          {t('orgStructure.noDepartments')}
        </p>
      )}

      <div className="space-y-2">
        {sortedDepts.map((dept) => {
          const isExpanded = expandedDepts.has(dept.id);
          const activeMemberCount = dept.members.filter((m) => m.status === 'active').length;
          const label = dept.code === DEPARTMENT_CODES.CUSTOM
            ? (dept.label ?? t(`departments.${dept.code}`))
            : t(`departments.${dept.code}`);

          return (
            <div key={dept.id} className="border rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-card hover:bg-muted/20">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpand(dept.id)}
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5" />
                      : <ChevronRight className="h-3.5 w-3.5" />}
                    {label}
                  </button>
                  <Badge variant={dept.status === 'active' ? 'success' : 'secondary'} className="text-xs">
                    {t(`orgStructure.${dept.status}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {activeMemberCount === 1
                      ? t('orgStructure.dept.memberCountSingular', { count: activeMemberCount })
                      : t('orgStructure.dept.memberCount', { count: activeMemberCount })}
                  </span>
                </div>

                <TooltipProvider>
                  <div className="flex items-center gap-0.5 bg-zinc-900 rounded-md px-1 py-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setEditingDept(dept)}
                          disabled={saving}
                          className="h-6 w-6 flex items-center justify-center rounded text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('orgStructure.editDepartment')}</TooltipContent>
                    </Tooltip>
                    {dept.status === 'active' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setArchivingDeptId(dept.id)}
                            disabled={saving}
                            className="h-6 w-6 flex items-center justify-center rounded text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Archive className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t('orgStructure.dept.archiveDept')}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleRestoreDept(dept.id)}
                            disabled={saving}
                            className="h-6 w-6 flex items-center justify-center rounded text-zinc-300 hover:text-emerald-400 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t('orgStructure.dept.restoreDept')}</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setDeletingDeptId(dept.id)}
                          disabled={saving}
                          className="h-6 w-6 flex items-center justify-center rounded text-zinc-300 hover:text-red-400 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('orgStructure.deleteDepartment')}</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1">
                  <OrgTreeView department={dept} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingDept !== null && (
        <DepartmentEditor
          department={editingDept === 'new' ? undefined : editingDept}
          usedCanonicalCodes={usedCanonicalCodes}
          open
          onClose={() => setEditingDept(null)}
          onSave={handleDeptSave}
        />
      )}

      <ConfirmDialog
        open={!!archivingDeptId}
        onOpenChange={(open) => { if (!open) setArchivingDeptId(null); }}
        title={t('orgStructure.dept.archiveConfirmTitle')}
        description={archivingDept ? buildArchiveDesc(archivingDept) : t('orgStructure.dept.archiveConfirmDesc')}
        confirmText={t('orgStructure.dept.archiveConfirmBtn')}
        onConfirm={handleArchiveConfirm}
        variant="warning"
      />

      <ConfirmDialog
        open={!!deletingDeptId}
        onOpenChange={(open) => { if (!open) setDeletingDeptId(null); }}
        title={t('orgStructure.dept.deleteConfirmTitle')}
        description={deletingDept ? buildDeleteDesc(deletingDept) : t('orgStructure.dept.deleteConfirmDesc')}
        confirmText={t('orgStructure.dept.deleteConfirmBtn')}
        onConfirm={handleDeleteDept}
        variant="destructive"
      />
    </div>
  );
}
