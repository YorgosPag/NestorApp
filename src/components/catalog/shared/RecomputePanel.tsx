'use client';
/**
 * **«Η πληρότητα πρέπει να ξαναϋπολογιστεί»** — πρόταση + πρόοδος της εργασίας (ADR-923 §5.10 Δ7, §5.10.4).
 *
 * Κοινό στις ρυθμίσεις (άλλαξαν γλώσσες) και στη λίστα προϊόντων (μπαγιάτικο `completenessHash`). Η εργασία είναι
 * ιδεμπότητη ⇒ «Δοκιμάστε ξανά» μετά από αποτυχία είναι **πάντα** ασφαλές, και το λέμε.
 *
 * @module components/catalog/shared/RecomputePanel
 */

import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CatalogRecompute } from '@/hooks/catalog/useCatalogRecompute';

import { useCatalogAccess, useCatalogText } from './catalog-ui-hooks';

export interface RecomputePanelProps {
  readonly recompute: CatalogRecompute;
  readonly familyId: string | null;
  /** Τι λέει η πρόταση πριν ξεκινήσει (π.χ. «Οι γλώσσες άλλαξαν»). */
  readonly prompt: string;
  /**
   * Η ανάγκη όταν **αποδεικνύεται από τα δεδομένα** (μπαγιάτικα παράγωγα στη λίστα) — αλλιώς οι γενιές του hook
   * (αλλαγή ρυθμίσεων). Παράγεται, δεν συγχρονίζεται με effect.
   */
  readonly needed?: boolean;
}

type Access = ReturnType<typeof useCatalogAccess>;

/**
 * Τι λέει το πάνελ: πρώτα ό,τι **τρέχει**, μετά ό,τι **χρειάζεται** (νεότερη αλλαγή), τελευταίο το αποτέλεσμα. Το «ποιος
 * μπορεί» μόνο σε **κριμένη** άρνηση — ζωντανά (ADR-923 §5.10.5) εμφανιζόταν όσο εκκρεμούσε η ταυτότητα.
 */
function statusText(props: RecomputePanelProps, access: Access, t: ReturnType<typeof useCatalogText>['t']): string {
  const { state } = props.recompute;
  const needed = props.needed ?? props.recompute.needed;
  if (state.kind === 'running') return t('recompute.running', { count: state.processed });
  if (state.kind === 'failed') return t('recompute.failed', { count: state.processed });
  if (needed || state.kind === 'idle') return access === 'denied' ? `${props.prompt} ${t('recompute.needsPermission')}` : props.prompt;
  return state.rejected > 0
    ? t('recompute.doneWithRejected', { count: state.processed, rejected: state.rejected })
    : t('recompute.done', { count: state.processed });
}

export function RecomputePanel(props: RecomputePanelProps) {
  const { t } = useCatalogText();
  // Η εργασία γράφει παράγωγα προϊόντων ⇒ η δικαιοδοσία των προϊόντων — το πάνελ τη ρωτά μόνο του (εκκρεμεί · ναι · όχι).
  const access = useCatalogAccess('products');
  const { state } = props.recompute;
  const needed = props.needed ?? props.recompute.needed;
  const busy = state.kind === 'running';
  return (
    <aside className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-3" aria-busy={busy || undefined}>
      <p className="m-0 mr-auto text-sm" role="status">{statusText(props, access, t)}</p>
      {access === 'granted' && (needed || state.kind === 'failed') ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void props.recompute.run(props.familyId)}>
          <RefreshCw className={busy ? 'mr-1 h-4 w-4 animate-spin' : 'mr-1 h-4 w-4'} aria-hidden />
          {state.kind === 'failed' ? t('recompute.retry') : t('recompute.run')}
        </Button>
      ) : null}
    </aside>
  );
}
