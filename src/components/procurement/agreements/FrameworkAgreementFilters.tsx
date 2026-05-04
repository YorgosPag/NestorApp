'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  FRAMEWORK_AGREEMENT_STATUSES,
  type FrameworkAgreementStatus,
} from '@/subapps/procurement/types/framework-agreement';

const ALL_STATUSES_VALUE = '__ALL__';

interface FrameworkAgreementFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: FrameworkAgreementStatus | null;
  onStatusChange: (status: FrameworkAgreementStatus | null) => void;
}

export function FrameworkAgreementFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
}: FrameworkAgreementFiltersProps) {
  const { t } = useTranslation('procurement');

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="pl-9"
          placeholder={t('hub.frameworkAgreements.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t('hub.frameworkAgreements.searchPlaceholder')}
        />
      </div>

      <Select
        value={status ?? ALL_STATUSES_VALUE}
        onValueChange={(v) =>
          onStatusChange(v === ALL_STATUSES_VALUE ? null : (v as FrameworkAgreementStatus))
        }
      >
        <SelectTrigger
          className="w-full sm:w-56"
          aria-label={t('hub.frameworkAgreements.filterByStatus')}
        >
          <SelectValue placeholder={t('hub.frameworkAgreements.allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES_VALUE}>
            {t('hub.frameworkAgreements.allStatuses')}
          </SelectItem>
          {FRAMEWORK_AGREEMENT_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`hub.frameworkAgreements.status.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
