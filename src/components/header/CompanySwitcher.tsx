'use client';

/**
 * CompanySwitcher — ADR-340
 *
 * Visible ONLY for super_admin users. Allows switching the active company
 * context for all CRM operations (events, contacts, projects).
 */

import { Building2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSuperAdminCompany } from '@/contexts/SuperAdminCompanyContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function CompanySwitcher() {
  const { t } = useTranslation(['admin']);
  const { isSuperAdmin, activeCompanyId, companies, loading, setActiveCompanyId } = useSuperAdminCompany();

  if (!isSuperAdmin || (!loading && companies.length <= 1)) return null;

  return (
    <div className="flex items-center gap-1.5 px-2">
      <Building2 className="h-4 w-4 shrink-0 text-amber-400" />
      <Select
        value={activeCompanyId ?? ''}
        onValueChange={setActiveCompanyId}
        disabled={loading || companies.length === 0}
      >
        <SelectTrigger
          className={cn(
            'h-8 min-w-[140px] max-w-[200px] text-xs border-amber-400/40',
            'bg-amber-400/10 text-amber-300 hover:bg-amber-400/20',
            'focus:ring-amber-400/50'
          )}
        >
          <SelectValue placeholder={t('companySwitcher.selectCompany')} />
        </SelectTrigger>
        <SelectContent>
          {companies.length === 0 && (
            <SelectItem value="__none__" disabled>
              {loading ? '…' : t('companySwitcher.noCompanies')}
            </SelectItem>
          )}
          {companies.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
