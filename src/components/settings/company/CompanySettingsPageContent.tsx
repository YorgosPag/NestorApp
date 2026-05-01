'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { API_ROUTES } from '@/config/domain-constants';
import { CompanyInfoTab } from './CompanyInfoTab';
import { TaxSettingsTab } from './TaxSettingsTab';
import { OrgStructureTab } from './OrgStructureTab';
import { RoutingEventsTab } from './RoutingEventsTab';
import { BOQCategoriesTab } from './BOQCategoriesTab';
import type { OrgStructure } from '@/types/org/org-structure';

interface OrgStructureState {
  orgStructure: OrgStructure | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export function CompanySettingsPageContent() {
  const { t } = useTranslation('org-structure');
  const { user } = useAuth();

  const [state, setState] = useState<OrgStructureState>({
    orgStructure: null,
    loading: true,
    saving: false,
    error: null,
  });

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await user!.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchOrgStructure = useCallback(async () => {
    if (!user) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(API_ROUTES.ORG_STRUCTURE, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { orgStructure: OrgStructure | null };
      setState((s) => ({ ...s, orgStructure: data.orgStructure, loading: false }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error';
      setState((s) => ({ ...s, error: msg, loading: false }));
    }
  }, [user, getAuthHeaders]);

  useEffect(() => {
    void fetchOrgStructure();
  }, [fetchOrgStructure]);

  const handleSave = useCallback(async (updated: OrgStructure) => {
    if (!user) return;
    setState((s) => ({ ...s, saving: true, error: null }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(API_ROUTES.ORG_STRUCTURE, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { orgStructure: OrgStructure };
      setState((s) => ({ ...s, orgStructure: data.orgStructure, saving: false }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error';
      setState((s) => ({ ...s, error: msg, saving: false }));
    }
  }, [user, getAuthHeaders]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        {t('orgStructure.subtitle')}…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-6">{t('orgStructure.title')}</h1>

      {state.error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <Tabs defaultValue="org">
        <TabsList className="mb-6">
          <TabsTrigger value="info">{t('orgStructure.tabs.info')}</TabsTrigger>
          <TabsTrigger value="tax">{t('orgStructure.tabs.tax')}</TabsTrigger>
          <TabsTrigger value="org">{t('orgStructure.tabs.orgChart')}</TabsTrigger>
          <TabsTrigger value="routing">{t('orgStructure.tabs.routing')}</TabsTrigger>
          <TabsTrigger value="boqCats">{t('orgStructure.tabs.boqCategories')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <CompanyInfoTab />
        </TabsContent>

        <TabsContent value="tax">
          <TaxSettingsTab />
        </TabsContent>

        <TabsContent value="org">
          <OrgStructureTab
            orgStructure={state.orgStructure}
            saving={state.saving}
            onSave={handleSave}
          />
        </TabsContent>

        <TabsContent value="routing">
          <RoutingEventsTab
            orgStructure={state.orgStructure}
            saving={state.saving}
            onSave={handleSave}
          />
        </TabsContent>

        <TabsContent value="boqCats">
          <BOQCategoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
