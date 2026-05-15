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
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { TabbedAddNewContactDialog } from '@/components/contacts/dialogs/TabbedAddNewContactDialog';
import { validateOrgHierarchy } from '@/services/org-structure/utils/validate-org-hierarchy';
import { generateOrgMemberId } from '@/services/enterprise-id.service';
import type { OrgMember, OrgMemberMode, OrgMemberRole, OrgEmailInfo } from '@/types/org/org-structure';

const ROLES: OrgMemberRole[] = ['head', 'manager', 'senior', 'employee', 'intern', 'custom'];
const MODES: OrgMemberMode[] = ['linked'];

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
  emails: OrgEmailInfo[];
};

function buildDraft(member?: OrgMember): Draft {
  return {
    displayName: member?.displayName ?? '',
    mode: (member?.mode && member.mode !== 'plain') ? member.mode : 'linked',
    role: member?.role ?? 'employee',
    contactId: member?.contactId ?? '',
    reportsTo: member?.reportsTo ?? null,
    isDepartmentHead: member?.isDepartmentHead ?? false,
    receivesNotifications: member?.receivesNotifications ?? false,
    emails: member?.emails ?? [],
  };
}

export function MemberEditor({ member, allMembers, onSave, onCancel }: MemberEditorProps) {
  const { t } = useTranslation(['org-structure', 'common']);
  const [draft, setDraft] = useState<Draft>(() => buildDraft(member));
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [contactSearchKey, setContactSearchKey] = useState(0);

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const handleContactCreated = () => {
    setShowCreateContact(false);
    setContactSearchKey((k) => k + 1);
  };

  const handleContactSelect = (contact: ContactSummary | null) => {
    if (!contact) {
      setDraft((d) => ({ ...d, contactId: '', emails: [] }));
      return;
    }
    setDraft((d) => ({
      ...d,
      contactId: contact.id,
      displayName: contact.name,
      emails: contact.email
        ? [{ email: contact.email, type: 'work' as const, isPrimary: true }]
        : d.emails,
    }));
  };

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
      emails: draft.emails,
      phones: member?.phones ?? [],
      status: member?.status ?? 'active',
    };
    onSave(saved);
  };

  return (
    <div className="space-y-4 py-2">

      <div className="space-y-1">
        <label className="text-xs font-medium">{t('orgStructure.member.displayNamePlaceholder')}</label>
        <Input
          value={draft.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder={t('orgStructure.member.displayNamePlaceholder')}
        />
      </div>

      {draft.mode === 'linked' && (
        <div className="space-y-1">
          <label className="text-xs font-medium">{t('orgStructure.member.selectContact')}</label>
          <ContactSearchManager
            key={contactSearchKey}
            selectedContactId={draft.contactId}
            onContactSelect={handleContactSelect}
            allowedContactTypes={['individual']}
            onCreateNew={() => setShowCreateContact(true)}
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
          disabled={draft.isDepartmentHead}
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
            onChange={(e) => {
              set('isDepartmentHead', e.target.checked);
              if (e.target.checked) {
                set('reportsTo', null);
                setCycleError(null);
              }
            }}
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

      <TabbedAddNewContactDialog
        open={showCreateContact}
        onOpenChange={setShowCreateContact}
        onContactAdded={handleContactCreated}
        allowedContactTypes={['individual']}
        presentation="sheet"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t('modal.cancel', { ns: 'common' })}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!draft.displayName.trim() || !!cycleError}
        >
          {t('modal.confirm', { ns: 'common' })}
        </Button>
      </div>
    </div>
  );
}
