'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ManagerPicker } from './ManagerPicker';
import { validateOrgHierarchy } from '@/services/org-structure/utils/validate-org-hierarchy';
import { generateOrgMemberId } from '@/services/enterprise-id.service';
import type { OrgMember, OrgMemberMode, OrgMemberRole } from '@/types/org/org-structure';

const ROLES: OrgMemberRole[] = ['head', 'manager', 'senior', 'employee', 'intern', 'custom'];
const MODES: OrgMemberMode[] = ['plain', 'linked', 'created'];

interface MemberEditorProps {
  member?: OrgMember;
  allMembers: OrgMember[];
  onSave: (member: OrgMember) => void;
  onCancel: () => void;
}

type Draft = {
  displayName: string;
  mode: OrgMemberMode;
  role: OrgMemberRole;
  contactId: string;
  reportsTo: string | null;
  isDepartmentHead: boolean;
  receivesNotifications: boolean;
};

function buildDraft(member?: OrgMember): Draft {
  return {
    displayName: member?.displayName ?? '',
    mode: member?.mode ?? 'plain',
    role: member?.role ?? 'employee',
    contactId: member?.contactId ?? '',
    reportsTo: member?.reportsTo ?? null,
    isDepartmentHead: member?.isDepartmentHead ?? false,
    receivesNotifications: member?.receivesNotifications ?? false,
  };
}

export function MemberEditor({ member, allMembers, onSave, onCancel }: MemberEditorProps) {
  const { t } = useTranslation(['org-structure', 'common']);
  const [draft, setDraft] = useState<Draft>(() => buildDraft(member));
  const [cycleError, setCycleError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const handleReportsTo = (val: string | null) => {
    set('reportsTo', val);

    if (!val) { setCycleError(null); return; }

    const testId = member?.id ?? '__new__';
    const testMembers: OrgMember[] = [
      ...allMembers.filter((m) => m.id !== testId),
      {
        id: testId,
        displayName: draft.displayName,
        mode: draft.mode,
        contactId: null,
        userId: null,
        role: draft.role,
        reportsTo: val,
        isDepartmentHead: draft.isDepartmentHead,
        receivesNotifications: draft.receivesNotifications,
        emails: [],
        phones: [],
        status: 'active',
      },
    ];
    const result = validateOrgHierarchy(testMembers);
    const hasCycle = result.errors.some((e) => e.startsWith('dept.cycle'));
    setCycleError(hasCycle ? t('orgStructure.validation.cycleDetected') : null);
  };

  const handleSave = () => {
    if (!draft.displayName.trim() || cycleError) return;
    const saved: OrgMember = {
      ...(member ?? {}),
      id: member?.id ?? generateOrgMemberId(),
      displayName: draft.displayName.trim(),
      mode: draft.mode,
      contactId: (draft.mode !== 'plain' && draft.contactId) ? draft.contactId : null,
      userId: member?.userId ?? null,
      role: draft.role,
      reportsTo: draft.reportsTo,
      isDepartmentHead: draft.isDepartmentHead,
      receivesNotifications: draft.receivesNotifications,
      emails: member?.emails ?? [],
      phones: member?.phones ?? [],
      status: member?.status ?? 'active',
    };
    onSave(saved);
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <label className="text-xs font-medium">{t('orgStructure.member.modeSelector')}</label>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <Badge
              key={m}
              variant={draft.mode === m ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => set('mode', m)}
            >
              {t(`memberMode.${m}`)}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">{t('orgStructure.member.displayNamePlaceholder')}</label>
        <Input
          value={draft.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder={t('orgStructure.member.displayNamePlaceholder')}
        />
      </div>

      {draft.mode !== 'plain' && (
        <div className="space-y-1">
          <label className="text-xs font-medium">{t('orgStructure.member.contactIdPlaceholder')}</label>
          <Input
            value={draft.contactId}
            onChange={(e) => set('contactId', e.target.value)}
            placeholder={t('orgStructure.member.contactIdPlaceholder')}
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium">{t('orgStructure.head')}</label>
        <Select value={draft.role} onValueChange={(v) => set('role', v as OrgMemberRole)}>
          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">{t('orgStructure.reportsTo')}</label>
        <ManagerPicker
          members={allMembers}
          currentMemberId={member?.id ?? null}
          value={draft.reportsTo}
          onChange={handleReportsTo}
        />
        {cycleError && (
          <p className="text-xs text-destructive">{cycleError}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={draft.isDepartmentHead}
            onChange={(e) => set('isDepartmentHead', e.target.checked)}
          />
          {t('orgStructure.member.isDeptHead')}
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={draft.receivesNotifications}
            onChange={(e) => set('receivesNotifications', e.target.checked)}
          />
          {t('orgStructure.member.receivesNotifications')}
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t('buttons.cancel', { ns: 'common' })}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!draft.displayName.trim() || !!cycleError}
        >
          {member ? t('orgStructure.editMember') : t('orgStructure.addMember')}
        </Button>
      </div>
    </div>
  );
}
