'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DepartmentEditor } from './DepartmentEditor';
import { OrgTreeView } from './OrgTreeView';
import { DEPARTMENT_CODES } from '@/config/department-codes';
import type { OrgStructure, OrgDepartment } from '@/types/org/org-structure';
import type { DepartmentCode } from '@/config/department-codes';

interface OrgStructureTabProps {
  orgStructure: OrgStructure | null;
  saving: boolean;
  onSave: (updated: OrgStructure) => void;
}

export function OrgStructureTab({ orgStructure, saving, onSave }: OrgStructureTabProps) {
  const { t } = useTranslation('org-structure');
  const [editingDept, setEditingDept] = useState<OrgDepartment | 'new' | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

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

  const handleArchiveDept = (id: string) => {
    const updated = departments.map((d) =>
      d.id === id ? { ...d, status: 'archived' as const } : d,
    );
    onSave({ ...orgStructure!, departments: updated });
  };

  const sortedDepts = [...departments].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === 'active' ? -1 : 1;
  });

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

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingDept(dept)}
                    className="h-7 w-7 p-0"
                    disabled={saving}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {dept.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchiveDept(dept.id)}
                      className="h-7 w-7 p-0 text-muted-foreground"
                      disabled={saving}
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  )}
                </div>
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
    </div>
  );
}
