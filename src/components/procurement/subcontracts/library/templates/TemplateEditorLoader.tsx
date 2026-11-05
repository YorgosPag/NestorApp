'use client';

/**
 * **Ποιο πρότυπο επεξεργάζεται η σελίδα** (ADR-928 §5.22 · Φ3γ-0b-2) — η είσοδος του `import()`.
 *
 * 🔑 Επεξεργασία ⇒ το ζωντανό πρότυπο. Νέο ⇒ αντίγραφο του `?from=` (ενεργού), αλλιώς του πρώτου ενεργού, αλλιώς του
 *    προτεινόμενου προτύπου του Nestor App (με `import()`: η προτεινόμενη βιβλιοθήκη δεν μπαίνει στο πρώτο καρέ).
 * 🔑 Τα πρότυπα του χώρου (και αρχειοθετημένα) δίνουν τους πιασμένους κωδικούς· η βιβλιοθήκη, τις εγκεκριμένες ρήτρες.
 */

import { useEffect, useMemo, useState } from 'react';
import { StaticPageLoading } from '@/core/states';
import type { SubcontractLibraryAuthorityView } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import type { SubcontractClause } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractTradeTemplate, SubcontractTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/types/trade-template';
import { TemplateEditor } from './TemplateEditor';
import type { TemplateEditorTarget } from './useTemplateEditor';

export interface TemplateEditorLoaderProps {
  readonly template: SubcontractTradeTemplate | null;
  readonly sourceId: string | null;
  readonly templates: readonly SubcontractTradeTemplate[];
  readonly clauses: readonly SubcontractClause[];
  readonly library: ApprovedLibrary;
  readonly authority: SubcontractLibraryAuthorityView;
}

/** Το προτεινόμενο πρότυπο του Nestor App, μόνο όταν ο χώρος δεν έχει κανένα δικό του. */
function useFallbackSource(needed: boolean): SubcontractTradeTemplateDefinition | null {
  const [source, setSource] = useState<SubcontractTradeTemplateDefinition | null>(null);
  useEffect(() => {
    if (!needed) return;
    let live = true;
    void import('@/config/subcontracts/default-trade-templates').then(({ DEFAULT_TRADE_TEMPLATES }) => {
      if (live) setSource(DEFAULT_TRADE_TEMPLATES[0] ?? null);
    });
    return () => {
      live = false;
    };
  }, [needed]);
  return source;
}

export default function TemplateEditorLoader({ template, sourceId, templates, clauses, library, authority }: TemplateEditorLoaderProps) {
  const own = useMemo(() => {
    const active = templates.filter((candidate) => !candidate.isArchived);
    return active.find((candidate) => candidate.id === sourceId) ?? active[0] ?? null;
  }, [templates, sourceId]);
  const fallback = useFallbackSource(template === null && own === null);
  const target = useMemo<TemplateEditorTarget | null>(() => {
    if (template) return { kind: 'edit', template };
    const source = own ?? fallback;
    return source ? { kind: 'create', source } : null;
  }, [template, own, fallback]);
  if (target === null) return <StaticPageLoading />;
  return <TemplateEditor target={target} templates={templates} clauses={clauses} library={library} authority={authority} />;
}
