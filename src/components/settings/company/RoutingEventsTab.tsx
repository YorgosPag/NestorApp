'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import {
  NOTIFICATION_EVENTS,
  DEFAULT_EVENT_TO_DEPARTMENT,
} from '@/config/notification-events';
import { DEPARTMENT_CODES, CANONICAL_DEPARTMENT_CODES } from '@/config/department-codes';
import type { OrgStructure, NotificationRoutingRule } from '@/types/org/org-structure';
import type { NotificationEventCode } from '@/config/notification-events';
import type { DepartmentCode } from '@/config/department-codes';

interface RoutingEventsTabProps {
  orgStructure: OrgStructure | null;
  saving: boolean;
  onSave: (updated: OrgStructure) => void;
}

type RowDraft = {
  event: NotificationEventCode;
  targetDepartmentCode: DepartmentCode | typeof SELECT_CLEAR_VALUE;
  overrideEmail: string;
};

const ALL_EVENTS = Object.values(NOTIFICATION_EVENTS) as NotificationEventCode[];
const ALL_DEPT_CODES = [...CANONICAL_DEPARTMENT_CODES, DEPARTMENT_CODES.CUSTOM];

function buildRows(orgStructure: OrgStructure | null): RowDraft[] {
  return ALL_EVENTS.map((event) => {
    const rule = orgStructure?.notificationRouting?.find((r) => r.event === event);
    return {
      event,
      targetDepartmentCode: rule?.targetDepartmentCode ?? SELECT_CLEAR_VALUE,
      overrideEmail: rule?.overrideEmail ?? '',
    };
  });
}

export function RoutingEventsTab({ orgStructure, saving, onSave }: RoutingEventsTabProps) {
  const { t } = useTranslation(['org-structure', 'common']);
  const [rows, setRows] = useState<RowDraft[]>(() => buildRows(orgStructure));
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    setRows(buildRows(orgStructure));
  }, [orgStructure]);

  const updateRow = (event: NotificationEventCode, patch: Partial<Omit<RowDraft, 'event'>>) =>
    setRows((prev) => prev.map((r) => (r.event === event ? { ...r, ...patch } : r)));

  const handleSave = () => {
    const routing: NotificationRoutingRule[] = rows
      .filter((r) => r.targetDepartmentCode !== SELECT_CLEAR_VALUE || r.overrideEmail)
      .map((r) => ({
        event: r.event,
        targetDepartmentCode:
          r.targetDepartmentCode !== SELECT_CLEAR_VALUE
            ? r.targetDepartmentCode
            : DEFAULT_EVENT_TO_DEPARTMENT[r.event],
        ...(r.overrideEmail ? { overrideEmail: r.overrideEmail } : {}),
      }));

    onSave({
      ...(orgStructure ?? { id: '', departments: [], updatedAt: new Date(), updatedBy: '' }),
      notificationRouting: routing,
    });
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('routing.title')}</p>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs font-medium">
              <th className="text-left px-3 py-2">{t('routing.event')}</th>
              <th className="text-left px-3 py-2">{t('routing.overrideDept')}</th>
              <th className="text-left px-3 py-2">{t('routing.overrideEmail')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const defaultDept = DEFAULT_EVENT_TO_DEPARTMENT[row.event];
              return (
                <tr key={row.event} className="border-t hover:bg-muted/10">
                  <td className="px-3 py-2">
                    <div>
                      <span>{t(`routing.events.${row.event}`)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t('routing.defaultDept')}: {t(`departments.${defaultDept}`)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 min-w-[160px]">
                    <Select
                      value={row.targetDepartmentCode}
                      onValueChange={(v) =>
                        updateRow(row.event, { targetDepartmentCode: v as DepartmentCode | typeof SELECT_CLEAR_VALUE })
                      }
                    >
                      <SelectTrigger size="sm">
                        <SelectValue placeholder={t('routing.defaultDept')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_CLEAR_VALUE}>
                          {t('routing.defaultDept')}
                        </SelectItem>
                        {ALL_DEPT_CODES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(`departments.${c}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.overrideEmail}
                      onChange={(e) => updateRow(row.event, { overrideEmail: e.target.value })}
                      placeholder="override@company.gr"
                      className="h-8 text-sm"
                      type="email"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3">
        {savedOk && (
          <span className="text-sm text-green-600">{t('routing.savedOk')}</span>
        )}
        <Button onClick={handleSave} disabled={saving} size="sm">
          {t('routing.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
