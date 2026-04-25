'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import type { OrgMember } from '@/types/org/org-structure';

interface ManagerPickerProps {
  members: OrgMember[];
  currentMemberId: string | null;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

/** Returns all descendant IDs of `memberId` in the flat members list (DFS). */
function getDescendantIds(members: OrgMember[], memberId: string): Set<string> {
  const result = new Set<string>();
  const stack = [memberId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const m of members) {
      if (m.reportsTo === id && !result.has(m.id)) {
        result.add(m.id);
        stack.push(m.id);
      }
    }
  }
  return result;
}

export function ManagerPicker({
  members,
  currentMemberId,
  value,
  onChange,
  disabled,
}: ManagerPickerProps) {
  const { t } = useTranslation('org-structure');

  const descendants = currentMemberId
    ? getDescendantIds(members, currentMemberId)
    : new Set<string>();

  const eligible = members.filter(
    (m) =>
      m.status === 'active' &&
      m.id !== currentMemberId &&
      !descendants.has(m.id),
  );

  const handleChange = (raw: string) => {
    onChange(raw === SELECT_CLEAR_VALUE ? null : raw);
  };

  return (
    <Select
      value={value ?? SELECT_CLEAR_VALUE}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger size="sm">
        <SelectValue placeholder={t('orgStructure.member.reportsToPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SELECT_CLEAR_VALUE}>
          {t('orgStructure.member.noManager')}
        </SelectItem>
        {eligible.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
