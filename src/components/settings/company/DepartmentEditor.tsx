'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MemberEditor } from './MemberEditor';
import { DEPARTMENT_CODES, CANONICAL_DEPARTMENT_CODES } from '@/config/department-codes';
import { generateOrgDepartmentId } from '@/services/enterprise-id.service';
import { validateOrgHierarchy } from '@/services/org-structure/utils/validate-org-hierarchy';
import type { OrgDepartment, OrgMember } from '@/types/org/org-structure';
import type { DepartmentCode } from '@/config/department-codes';

interface DepartmentEditorProps {
  department?: OrgDepartment;
  usedCanonicalCodes: DepartmentCode[];
  open: boolean;
  onClose: () => void;
  onSave: (dept: OrgDepartment) => void;
}

type DeptDraft = {
  code: DepartmentCode;
  label: string;
  status: 'active' | 'archived';
  members: OrgMember[];
};

function buildDeptDraft(dept?: OrgDepartment): DeptDraft {
  return {
    code: dept?.code ?? DEPARTMENT_CODES.ACCOUNTING,
    label: dept?.label ?? '',
    status: dept?.status ?? 'active',
    members: dept?.members ?? [],
  };
}

export function DepartmentEditor({
  department,
  usedCanonicalCodes,
  open,
  onClose,
  onSave,
}: DepartmentEditorProps) {
  const { t } = useTranslation(['org-structure', 'common']);
  const [draft, setDraft] = useState<DeptDraft>(() => buildDeptDraft(department));
  const [editingMember, setEditingMember] = useState<OrgMember | 'new' | null>(null);
  const [hierarchyErrors, setHierarchyErrors] = useState<string[]>([]);

  const set = <K extends keyof DeptDraft>(key: K, val: DeptDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const handleMemberSave = (member: OrgMember) => {
    const updated = editingMember === 'new'
      ? [...draft.members, member]
      : draft.members.map((m) => (m.id === member.id ? member : m));

    const validation = validateOrgHierarchy(updated);
    setHierarchyErrors(validation.errors);
    set('members', updated);
    setEditingMember(null);
  };

  const handleArchiveMember = (id: string) => {
    const updated = draft.members.map((m) =>
      m.id === id ? { ...m, status: 'archived' as const } : m,
    );
    set('members', updated);
  };

  const handleSave = () => {
    const validation = validateOrgHierarchy(draft.members);
    if (!validation.valid) { setHierarchyErrors(validation.errors); return; }
    const saved: OrgDepartment = {
      ...(department ?? {}),
      id: department?.id ?? generateOrgDepartmentId(),
      code: draft.code,
      label: draft.code === DEPARTMENT_CODES.CUSTOM ? draft.label : undefined,
      status: draft.status,
      members: draft.members,
      createdAt: department?.createdAt ?? new Date(),
    };
    onSave(saved);
  };

  const availableCodes = CANONICAL_DEPARTMENT_CODES.filter(
    (c) => !usedCanonicalCodes.includes(c) || c === department?.code,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {department
              ? t('orgStructure.dept.editDept')
              : t('orgStructure.dept.addDept')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('routing.targetDepartment')}</label>
              <Select
                value={draft.code}
                onValueChange={(v) => set('code', v as DepartmentCode)}
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder={t('orgStructure.dept.codePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {availableCodes.map((c) => (
                    <SelectItem key={c} value={c}>{t(`departments.${c}`)}</SelectItem>
                  ))}
                  <SelectItem value={DEPARTMENT_CODES.CUSTOM}>
                    {t(`departments.${DEPARTMENT_CODES.CUSTOM}`)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draft.code === DEPARTMENT_CODES.CUSTOM && (
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('orgStructure.dept.labelPlaceholder')}</label>
                <Input
                  value={draft.label}
                  onChange={(e) => set('label', e.target.value)}
                  placeholder={t('orgStructure.dept.labelPlaceholder')}
                />
              </div>
            )}
          </div>

          {hierarchyErrors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              {hierarchyErrors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">{t(`errors.${e.split(':')[0].replace('dept.', '').replace('member.', '').replace('org.', '')}`) || e}</p>
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{t('orgStructure.title')}</span>
              <Button variant="outline" size="sm" onClick={() => setEditingMember('new')}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('orgStructure.addMember')}
              </Button>
            </div>

            {editingMember !== null && (
              <div className="border rounded-md p-3 mb-3 bg-muted/20">
                <MemberEditor
                  member={editingMember === 'new' ? undefined : editingMember}
                  allMembers={draft.members}
                  onSave={handleMemberSave}
                  onCancel={() => setEditingMember(null)}
                />
              </div>
            )}

            <div className="space-y-1">
              {draft.members.length === 0 && (
                <p className="text-sm opacity-60 py-2">{t('orgStructure.noMembers')}</p>
              )}
              {draft.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${m.status === 'archived' ? 'line-through opacity-50' : ''}`}>
                      {m.displayName}
                    </span>
                    <Badge variant="outline" className="text-xs">{t(`roles.${m.role}`)}</Badge>
                    {m.isDepartmentHead && (
                      <Badge variant="warning" className="text-xs">{t('orgStructure.head')}</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingMember(m)}
                      className="h-7 w-7 p-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {m.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchiveMember(m.id)}
                        className="h-7 w-7 p-0 text-muted-foreground"
                      >
                        <Archive className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('buttons.cancel', { ns: 'common' })}
          </Button>
          <Button size="sm" onClick={handleSave}>
            {t('buttons.save', { ns: 'common' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
