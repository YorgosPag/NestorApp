'use client';

/**
 * @fileoverview **Η κατάσταση του πλέγματος γραμμών μιας έκδοσης** (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related price-line-rows.ts (καθαρό μοντέλο) · shared/use-rebased-draft.ts (πρόχειρο · rebase · ιστορικό) ·
 *   products/variants/use-variant-grid.ts (το ίδιο ιδίωμα) · services/catalog/catalog-pricing-api.client.ts
 * @module components/catalog/pricing/use-price-line-grid
 *
 * 🔑 **Οι γραμμές ΜΟΝΟ από τον διακομιστή** (απόφαση Ζ): `usePriceLinesView` = όλες οι σελίδες ως ΕΝΑ συνεπές στιγμιότυπο,
 *    ζωντανό με το σήμα `list:{id}`. Όσο αποθηκεύουμε, η ανανέωση **περιμένει** (`isHeld`) — αλλιώς ένα ενδιάμεσο
 *    στιγμιότυπο (μισές δέσμες) θα έκανε rebase πάνω σε κάτι που δεν είναι ούτε το πριν ούτε το μετά.
 * 🔑 **Επίλυση κωδικού** (επικόλληση 400 κωδικών από Excel): ένα αίτημα ανά **μοναδικό** κωδικό, με μνήμη — η αναίρεση
 *    ή ένα δεύτερο κελί με τον ίδιο κωδικό δεν ξαναρωτούν. Η απάντηση γράφει μόνο σε γραμμές που **ακόμη** τον περιμένουν.
 * 🔑 **Αποθήκευση = δέσμες σειριακά με αλυσίδα CAS** από το `linesRevision` του **ίδιου** στιγμιοτύπου που είδε ο άνθρωπος·
 *    μερική αποτυχία ⇒ «αποθηκεύτηκαν N από M», ποτέ σιωπηλή επιτυχία.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePriceLinesView } from '@/hooks/catalog/usePriceListViews';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { savePriceLines } from '@/services/catalog/catalog-pricing-api.client';
import type { DiscountGroupWire, PriceListWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogCodeResolver, type CatalogCodeResolver } from '../products/use-catalog-code-resolver';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';
import { useRebasedDraft, type RebasedDraft } from '../shared/use-rebased-draft';
import {
  hasPendingResolution,
  isPriceLineDraftDirty,
  pendingCodes,
  priceLineChangesOf,
  priceLineDraftOf,
  priceLineIssues,
  rebasePriceLineDraft,
  resolvePriceLineCode,
  type PriceLineDraft,
} from './price-line-rows';

export interface PriceLineGridInput {
  readonly list: PriceListWire;
  readonly versionId: string;
  readonly discountGroups: readonly DiscountGroupWire[];
  readonly attributes: readonly AttributeRecord[];
}

/** Τι έγινε στην τελευταία αποθήκευση — η οθόνη το λέει με αριθμούς. */
export type PriceLineSaveReport = { readonly kind: 'saved'; readonly total: number } | { readonly kind: 'partial'; readonly saved: number; readonly total: number };

const EMPTY: PriceLineDraft = { rows: [], removed: [] };

/** Ένα αίτημα ανά μοναδικό κωδικό, με μνήμη· η απάντηση περνά από το καθαρό `resolvePriceLineCode`. */
function useCodeResolution(state: RebasedDraft<PriceLineDraft>, resolve: CatalogCodeResolver) {
  const notice = useCatalogFailureNotice();
  const known = useRef(new Map<string, string | null>());
  const inFlight = useRef(new Set<string>());
  const { draft, amend } = state;
  useEffect(() => {
    for (const code of pendingCodes(draft)) {
      if (known.current.has(code)) { amend((current) => resolvePriceLineCode(current, code, known.current.get(code) ?? null)); continue; }
      if (inFlight.current.has(code)) continue;
      inFlight.current.add(code);
      resolve(code).then(
        (target) => {
          const variantId = target?.kind === 'product' ? target.id : null; // μοντέλο ≠ SKU: δεν τιμολογείται
          known.current.set(code, variantId);
          amend((current) => resolvePriceLineCode(current, code, variantId));
        },
        (cause: unknown) => notice(catalogFailureOf(cause)),
      ).finally(() => inFlight.current.delete(code));
    }
  }, [draft, amend, resolve, notice]);
}

function useSave(state: RebasedDraft<PriceLineDraft>, held: { current: boolean }, lines: ReturnType<typeof usePriceLinesView>) {
  const notice = useCatalogFailureNotice();
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<PriceLineSaveReport | null>(null);
  const view = lines.current.state === 'ready' ? lines.current.view : null;
  const save = useCallback(async () => {
    if (view === null) return;
    setSaving(true);
    held.current = true;
    const outcome = await savePriceLines(view.version.id, view.version.derived.linesRevision, priceLineChangesOf(state.draft));
    held.current = false;
    lines.release();
    setSaving(false);
    if (outcome.kind === 'saved') { setReport({ kind: 'saved', total: outcome.total }); state.clearConflicts(); }
    else { setReport({ kind: 'partial', saved: outcome.saved, total: outcome.total }); notice(catalogFailureOf(outcome.cause)); }
    await lines.revalidate();
  }, [view, state, held, lines, notice]);
  return { saving, report, save, clearReport: () => setReport(null) };
}

export function usePriceLineGrid(input: PriceLineGridInput) {
  const held = useRef(false);
  const isHeld = useCallback(() => held.current, []);
  const lines = usePriceLinesView(input.list.id, input.versionId, isHeld);
  const view = lines.current.state === 'ready' ? lines.current.view : null;
  const base = useMemo(() => (view ? priceLineDraftOf(view.lines, view.skuIdentifiers) : EMPTY), [view]);
  const state = useRebasedDraft<PriceLineDraft>(base, rebasePriceLineDraft);
  useCodeResolution(state, useCatalogCodeResolver(input.attributes));
  const saving = useSave(state, held, lines);
  const discountGroupIds = useMemo(() => new Set(input.discountGroups.map((group) => group.id)), [input.discountGroups]);
  const { kind, priceType } = input.list;
  const issues = useMemo(() => priceLineIssues(state.draft, { kind, priceType, discountGroupIds }), [state.draft, kind, priceType, discountGroupIds]);
  const dirty = isPriceLineDraftDirty(state.draft);
  const issueCount = [...issues.values()].reduce((sum, list) => sum + list.length, 0);
  return {
    ...state,
    ...saving,
    lines,
    version: view?.version ?? null,
    issues,
    issueCount,
    dirty,
    canSave: dirty && !saving.saving && issueCount === 0 && !hasPendingResolution(state.draft),
  };
}
