'use client';

/**
 * @fileoverview **Η σελίδα «Ρυθμίσεις Εταιρείας»** — τίτλος η ίδια η σελίδα, καρτέλα στη διεύθυνση (ADR-ACC-018 §17.4).
 * @module components/settings/company/CompanySettingsPageContent
 *
 * 🔑 Η σελίδα γεννήθηκε ως «Δομή Οργανισμού» και οι άλλες καρτέλες μπήκαν μετά: ο τίτλος έμενε «Δομή Οργανισμού» σε
 *    κάθε καρτέλα, άνοιγε πάντα στη Δομή, και κάθε καρτέλα περίμενε το οργανόγραμμα. Τώρα (Stripe/GitHub Settings):
 *    - η καρτέλα ζει στο `?tab=` (`useActiveUrlTab`) ⇒ ο σύνδεσμος του λογοτύπου, η ανανέωση και το «πίσω» την κρατούν·
 *    - οι καρτέλες και ο builder συνδέσμων είναι ΜΙΑ δήλωση (`company-settings-urls`)·
 *    - το οργανόγραμμα φορτώνεται μόνο για τις καρτέλες που το χρειάζονται.
 */

import type { ReactNode } from 'react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useActiveUrlTab } from '@/hooks/useUrlTabParam';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  COMPANY_SETTINGS_TAB_PARAM,
  COMPANY_SETTINGS_TABS,
  type CompanySettingsTab,
} from '@/lib/navigation/company-settings-urls';
import { CompanyInfoTab } from './CompanyInfoTab';
import { TaxSettingsTab } from './TaxSettingsTab';
import { OrgStructureTab } from './OrgStructureTab';
import { RoutingEventsTab } from './RoutingEventsTab';
import { BOQCategoriesTab } from './BOQCategoriesTab';
import { AiProcessingTab } from './AiProcessingTab';
import { useOrgStructureSettings, type OrgStructureSettings } from './useOrgStructureSettings';

const TAB_LABEL_KEYS: Readonly<Record<CompanySettingsTab, string>> = {
  info: 'orgStructure.tabs.info',
  tax: 'orgStructure.tabs.tax',
  org: 'orgStructure.tabs.orgChart',
  routing: 'orgStructure.tabs.routing',
  boqCats: 'orgStructure.tabs.boqCategories',
  ai: 'orgStructure.tabs.ai',
};

/** Οι καρτέλες που δουλεύουν πάνω στο οργανόγραμμα — μόνο αυτές το φορτώνουν. */
const ORG_STRUCTURE_TABS: ReadonlySet<CompanySettingsTab> = new Set<CompanySettingsTab>(['org', 'routing']);

const isCompanySettingsTab = (tab: string): tab is CompanySettingsTab =>
  (COMPANY_SETTINGS_TABS as readonly string[]).includes(tab);

interface OrgStructureGateProps {
  readonly org: OrgStructureSettings;
  readonly children: (org: OrgStructureSettings) => ReactNode;
}

/** Φόρτωση · σφάλμα · επεξεργαστής. Ο επεξεργαστής ΔΕΝ δείχνεται χωρίς επιτυχή ανάγνωση (δες `useOrgStructureSettings`). */
function OrgStructureGate({ org, children }: OrgStructureGateProps) {
  const { t } = useTranslation('org-structure');
  return (
    <>
      {org.error && (
        <p role="alert" className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {org.error}
        </p>
      )}
      {org.load === 'ready' ? children(org) : null}
      {org.load === 'loading' || org.load === 'idle' ? (
        <p role="status" className="py-20 text-center text-sm text-muted-foreground">
          {t('orgStructure.subtitle')}…
        </p>
      ) : null}
    </>
  );
}

export function CompanySettingsPageContent() {
  const { t } = useTranslation('org-structure');
  const { activeTab, setActiveTab } = useActiveUrlTab(COMPANY_SETTINGS_TAB_PARAM, COMPANY_SETTINGS_TABS, { heal: true });
  const org = useOrgStructureSettings(isCompanySettingsTab(activeTab) && ORG_STRUCTURE_TABS.has(activeTab));

  return (
    <section className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-6">{t('companySettings.title')}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          {COMPANY_SETTINGS_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>{t(TAB_LABEL_KEYS[tab])}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info"><CompanyInfoTab /></TabsContent>
        <TabsContent value="tax"><TaxSettingsTab /></TabsContent>
        <TabsContent value="org">
          <OrgStructureGate org={org}>
            {(o) => <OrgStructureTab orgStructure={o.orgStructure} saving={o.saving} onSave={o.save} />}
          </OrgStructureGate>
        </TabsContent>
        <TabsContent value="routing">
          <OrgStructureGate org={org}>
            {(o) => <RoutingEventsTab orgStructure={o.orgStructure} saving={o.saving} onSave={o.save} />}
          </OrgStructureGate>
        </TabsContent>
        <TabsContent value="boqCats"><BOQCategoriesTab /></TabsContent>
        <TabsContent value="ai"><AiProcessingTab /></TabsContent>
      </Tabs>
    </section>
  );
}
