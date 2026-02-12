"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageLayout } from '@/components/app/page-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSpacingClass } from '@/lib/design-system';
import { useObligations } from '@/hooks/useObligations';
import { ObligationsRegisterTable } from '@/components/obligations/workspace';
import type { ObligationStatus } from '@/types/obligations';
import {
  OBLIGATION_WORKFLOW_LABEL_KEYS,
  OBLIGATION_WORKFLOW_SEQUENCE,
} from '@/components/obligations/workspace';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const STATUS_ALL = 'all';

type StatusFilter = ObligationStatus | typeof STATUS_ALL;

export default function ObligationsPage() {
  const { t, isNamespaceReady } = useTranslation('obligations');
  const { obligations, loading, error, deleteObligation } = useObligations();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(STATUS_ALL);

  const filtered = useMemo(() => {
    return obligations.filter((obligation) => {
      const matchesStatus = statusFilter === STATUS_ALL || obligation.status === statusFilter;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        term.length === 0 ||
        obligation.title.toLowerCase().includes(term) ||
        obligation.projectName.toLowerCase().includes(term) ||
        obligation.contractorCompany.toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [obligations, search, statusFilter]);

  const handleDelete = async (id: string) => {
    await deleteObligation(id);
  };

  if (!isNamespaceReady) {
    return (
      <PageLayout>
        <main className={`max-w-full mx-auto ${getSpacingClass('p', 'md')} md:p-6 lg:p-8`}>
          <section className="rounded-lg border p-6 text-sm text-muted-foreground">...</section>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <main className={`max-w-full mx-auto ${getSpacingClass('p', 'md')} md:p-6 lg:p-8 space-y-6`}>
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('workspace.register.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('workspace.register.subtitle')}</p>
          </div>
          <Link href="/obligations/new">
            <Button>{t('workspace.register.create')}</Button>
          </Link>
        </header>

        <section className="rounded-lg border p-4 grid gap-4 md:grid-cols-2" aria-label={t('workspace.register.title')}>
          <fieldset className="space-y-2">
            <label className="text-sm font-medium" htmlFor="register-search">{t('workspace.register.searchLabel')}</label>
            <Input
              id="register-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('workspace.register.searchPlaceholder')}
            />
          </fieldset>
          <fieldset className="space-y-2">
            <label className="text-sm font-medium" htmlFor="status-filter">{t('workspace.register.statusLabel')}</label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder={t('workspace.register.statusLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>{t('workspace.register.allStatuses')}</SelectItem>
                {OBLIGATION_WORKFLOW_SEQUENCE.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(OBLIGATION_WORKFLOW_LABEL_KEYS[status])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        </section>

        {loading && (
          <section className="rounded-lg border p-6 text-sm text-muted-foreground">{t('workspace.register.loading')}</section>
        )}

        {error && (
          <section className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
            {t('workspace.register.loadError')}
          </section>
        )}

        {!loading && !error && (
          <ObligationsRegisterTable obligations={filtered} onDelete={handleDelete} />
        )}
      </main>
    </PageLayout>
  );
}
