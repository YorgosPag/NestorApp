'use client';

/**
 * **Η προεπισκόπηση της συγγραφής ρήτρας** (ADR-928 §5.22): τρεις όψεις του ίδιου πρόχειρου.
 *   - «Όπως τυπώνεται» — ο **ίδιος** `ClausePrintedText` με τον έλεγχο και το έγγραφο, με τις προτιμώμενες τιμές·
 *   - «Αλλαγές» — η **ίδια** σύγκριση δύο καναλιών που θα δει ο εγκρίνων (`ClauseVersionDiffView`), έναντι της βάσης·
 *   - «Επίπτωση» — πρότυπα και πρόχειρα που δένουν τη ρήτρα (`ClauseUsagePanel`), μόνο σε υπάρχουσα ρήτρα.
 * 🔑 Ο συντάκτης βλέπει **ό,τι θα δει ο εγκρίνων** πριν πατήσει «Υποβολή» — η ίδια οθόνη από την άλλη πλευρά.
 * 🔑 Μεταφράσεις της βάσης + αλλαγμένο ελληνικό ⇒ ρητή προειδοποίηση: η νέα έκδοση κληρονομεί τη μετάφραση ως
 *    **πρόχειρο** (`carriedTranslations`), και το δίγλωσσο μπλοκάρεται ώσπου να εγκριθεί ξανά.
 */

import { useMemo } from 'react';
import { dequal } from 'dequal';
import { AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import type { SubcontractClause } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';
import { ClauseParametersTable, ClausePrintedText } from '../ClauseText';
import { ClauseUsagePanel } from '../ClauseUsagePanel';
import { ClauseVersionDiffView } from '../ClauseVersionDiffView';
import type { ClauseAuthoring } from './useClauseAuthoring';

interface ClauseAuthoringPreviewProps {
  readonly authoring: ClauseAuthoring;
  readonly clause: SubcontractClause | null;
  readonly templates: readonly SubcontractTradeTemplate[];
}

function StaleTranslationsNotice({ authoring }: { readonly authoring: ClauseAuthoring }) {
  const { t, i18n } = useTranslation('procurement');
  const { base, draft } = authoring;
  const languages = base ? Object.keys(base.translations) : [];
  if (!base || languages.length === 0 || dequal(base.body, draft.body)) return null;
  const names = new Intl.DisplayNames([resolveHumanLanguage(i18n.language)], { type: 'language' });
  return (
    <aside role="note" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <span>{t('subcontracts.library.authoring.translationsBehind', { languages: languages.map((language) => names.of(language) ?? language).join(', ') })}</span>
    </aside>
  );
}

export function ClauseAuthoringPreview({ authoring, clause, templates }: ClauseAuthoringPreviewProps) {
  const { t } = useTranslation('procurement');
  const after = useMemo(() => ({ body: authoring.draft.body, parameters: authoring.draft.parameters }), [authoring.draft.body, authoring.draft.parameters]);
  return (
    <section aria-label={t('subcontracts.editor.tabs.preview')} className="space-y-3">
      <StaleTranslationsNotice authoring={authoring} />
      <Tabs defaultValue="printed">
        <TabsList>
          <TabsTrigger value="printed">{t('subcontracts.library.authoring.preview.printed')}</TabsTrigger>
          <TabsTrigger value="changes">{t('subcontracts.library.authoring.preview.changes')}</TabsTrigger>
          {clause && <TabsTrigger value="usage">{t('subcontracts.library.authoring.preview.usage')}</TabsTrigger>}
        </TabsList>
        <TabsContent value="printed" className="space-y-3"><ClausePrintedText clause={after} /><ClauseParametersTable parameters={after.parameters} /></TabsContent>
        <TabsContent value="changes"><ClauseVersionDiffView before={authoring.base} after={after} /></TabsContent>
        {clause && <TabsContent value="usage"><ClauseUsagePanel clause={clause} templates={templates} /></TabsContent>}
      </Tabs>
    </section>
  );
}
