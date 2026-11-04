'use client';

/**
 * **Τι βλέπει η σελίδα της βιβλιοθήκης** — σύνθεση των ζωντανών αναγνώσεων και του καθαρού στρώματος (ADR-928 Φ3γ-0).
 *
 * 🔑 Καμία νέα κρίση εδώ: ουρά (`reviewQueueOf`), πρόοδος (`seedProgressOf`) και εκκρεμή πρότυπα
 *    (`pendingSeedTemplatesOf` = ο **ίδιος** έλεγχος με τη σπορά) είναι καθαρές συναρτήσεις πάνω στις αναγνώσεις.
 * 🔑 Η προτεινόμενη βιβλιοθήκη (29 ρήτρες · 2 πρότυπα, μεγάλο κείμενο) φτάνει με `import()` (ADR-744 §34): χρειάζεται
 *    μόνο για την πρόοδο και τα εκκρεμή πρότυπα, ποτέ για το πρώτο καρέ.
 * 🔑 Fail-closed: όσο φορτώνουν ρήτρες/πρότυπα η σελίδα λέει «φόρτωση» — ποτέ «κενή βιβλιοθήκη» που θα πρότεινε σπορά
 *    σε χώρο που ήδη την έχει.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  useClauseProposals,
  useSubcontractClauseLibrary,
  useSubcontractTradeTemplates,
  type SubcontractClauseLibrary,
} from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { createModuleLogger } from '@/lib/telemetry';
import { reviewQueueOf, seedProgressOf, type ReviewQueueItem, type SeedProgress } from '@/subapps/procurement/subcontracts/library/review-queue';
import { pendingSeedTemplatesOf, type PendingSeedTemplate } from '@/subapps/procurement/subcontracts/library/seed-template-readiness';
import type { ClauseKey } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractTradeTemplate, SubcontractTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/types/trade-template';

const logger = createModuleLogger('useLibraryScreen');

interface DefaultLibrary {
  readonly clauseKeys: readonly ClauseKey[];
  readonly templates: readonly SubcontractTradeTemplateDefinition[];
}

/** Η προτεινόμενη βιβλιοθήκη, πίσω από `import()`. `null` όσο φτάνει (ή αν απέτυχε — καταγράφεται). */
function useDefaultLibrary(): DefaultLibrary | null {
  const [defaults, setDefaults] = useState<DefaultLibrary | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([import('@/config/subcontracts/default-clause-library'), import('@/config/subcontracts/default-trade-templates')])
      .then(([clauses, templates]) => {
        if (live) setDefaults({ clauseKeys: clauses.DEFAULT_CLAUSE_LIBRARY.map((draft) => draft.clauseKey), templates: templates.DEFAULT_TRADE_TEMPLATES });
      })
      .catch((error: unknown) => logger.warn('Default library chunk failed', { error: error instanceof Error ? error.message : String(error) }));
    return () => {
      live = false;
    };
  }, []);
  return defaults;
}

export type LibraryScreenState = 'loading' | 'failed' | 'empty' | 'ready';

export interface LibraryScreen {
  readonly state: LibraryScreenState;
  /** Ρήτρες **και** αρχειοθετημένες, με την εγκεκριμένη βιβλιοθήκη (χωρίς αρχειοθετημένες) και τις εκδόσεις σε ισχύ. */
  readonly library: SubcontractClauseLibrary;
  readonly templates: readonly SubcontractTradeTemplate[];
  readonly queue: readonly ReviewQueueItem[];
  /** Ανοιχτές προτάσεις που δεν έχουν φτάσει ακόμη — η ουρά δεν τις δείχνει χωρίς κείμενο. */
  readonly queueLoading: boolean;
  readonly progress: SeedProgress | null;
  readonly pendingTemplates: readonly PendingSeedTemplate[];
  /** Ο αριθμός των ρητρών της προτεινόμενης βιβλιοθήκης (`null` όσο φτάνει). */
  readonly defaultClauseCount: number | null;
  readonly defaultTemplateCount: number | null;
}

function screenStateOf(library: SubcontractClauseLibrary, templatesLoading: boolean, templatesError: string | null): LibraryScreenState {
  if (library.error !== null || templatesError !== null) return 'failed';
  if (library.clauses.length === 0 && !library.loading && !templatesLoading) return 'empty';
  return library.clauses.length === 0 ? 'loading' : 'ready';
}

export function useLibraryScreen(): LibraryScreen {
  const library = useSubcontractClauseLibrary({ includeArchived: true });
  const proposals = useClauseProposals(library.clauses);
  const { items: templates, loading: templatesLoading, error: templatesError } = useSubcontractTradeTemplates({ includeArchived: true });
  const defaults = useDefaultLibrary();

  const queue = useMemo(() => reviewQueueOf(library.clauses, proposals.versions, library.versions), [library.clauses, library.versions, proposals.versions]);
  const progress = useMemo(
    () => (defaults ? seedProgressOf(defaults.clauseKeys, library.clauses, library.versions) : null),
    [defaults, library.clauses, library.versions],
  );
  const pendingTemplates = useMemo(
    () => (defaults && !library.loading ? pendingSeedTemplatesOf(defaults.templates, templates, library.library) : []),
    [defaults, library.loading, library.library, templates],
  );

  return {
    state: screenStateOf(library, templatesLoading, templatesError),
    library,
    templates,
    queue,
    queueLoading: proposals.pending,
    progress,
    pendingTemplates,
    defaultClauseCount: defaults?.clauseKeys.length ?? null,
    defaultTemplateCount: defaults?.templates.length ?? null,
  };
}
