'use client';

/**
 * @fileoverview **Ο προέλεγχος της εξαγωγής xChange** στο παράθυρο (ADR-923 §5.14.1 · απόφαση Ε3): πριν το κλικ, πόσα προϊόντα
 *   θα γραφτούν για το κοινό. Κανένα ⇒ κενή κατάσταση με την **αιτία** και σύνδεσμο **εκεί όπου διορθώνεται**, όχι κουμπί
 *   που κατεβάζει άκυρο αρχείο.
 * @related components/catalog/interop/use-xchange-export-preview.ts (η μέτρηση) · XChangeExportReport.tsx (η αναφορά μετά)
 * @module components/catalog/interop/XChangeExportPreviewNote
 *
 * 🔑 Η αιτία λέγεται με το **ίδιο** εύρημα που ρίχνει ο διακομιστής (`xchangeNothingToExportIssue`): μία φράση, όχι δύο.
 */

import React from 'react';
import { PackageX } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Link } from '@/lib/workspace/navigation';
import { typedHref } from '@/lib/workspace/route-worlds';
import { CATALOG_PAGES, VISIBILITY_TAB_QUERY } from '@/subapps/catalog/catalog-routes';
import { xchangeNothingToExportIssue } from '@/subapps/catalog/interop/etim/xchange-export-assembly';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { XChangeExportPreview } from '@/subapps/catalog/types/xchange-export';
import type { XChangeEmptyCause } from '@/subapps/catalog/vocabulary/etim';
import { useIssueMessage } from '../shared/CatalogIssues';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { XChangePreviewState } from './use-xchange-export-preview';

const PRODUCTS_FIX = { href: typedHref(CATALOG_PAGES.products), labelKey: 'xchangeExport.preview.fix.products' } as const;
const VISIBILITY_FIX = { href: typedHref(`${CATALOG_PAGES.discounts}${VISIBILITY_TAB_QUERY}` as const), labelKey: 'xchangeExport.preview.fix.visibility' } as const;

/** Πού διορθώνεται κάθε αιτία. Εξαντλητικό: νέα αιτία χωρίς προορισμό δεν μεταγλωττίζεται. */
const FIX_OF: Readonly<Record<XChangeEmptyCause, typeof PRODUCTS_FIX | typeof VISIBILITY_FIX>> = {
  catalogEmpty: PRODUCTS_FIX,
  noVisibilityRules: VISIBILITY_FIX,
  hiddenForAudience: VISIBILITY_FIX,
  noUsableIdentifier: PRODUCTS_FIX,
  noTradeIdentity: PRODUCTS_FIX,
};

function NothingToExport({ cause }: { readonly cause: XChangeEmptyCause }) {
  const { t } = useCatalogText();
  const message = useIssueMessage(true);
  const fix = FIX_OF[cause];
  return (
    <EmptyState icon={PackageX} size="sm" variant="card" title={t('xchangeExport.preview.emptyTitle')} description={message(xchangeNothingToExportIssue(cause))}>
      <Link href={fix.href} className="text-sm font-medium underline underline-offset-4">{t(fix.labelKey)}</Link>
    </EmptyState>
  );
}

function ExportableLine({ preview }: { readonly preview: XChangeExportPreview }) {
  const { t } = useCatalogText();
  const { brandMissing, mpnMissing, mpnTooLong } = preview.tradeIdentity;
  const left = preview.hidden + preview.unfitIdentifier + brandMissing + mpnMissing + mpnTooLong;
  return (
    <p className="m-0 text-sm text-muted-foreground" role="status">
      {t('xchangeExport.preview.ready', { count: preview.exported })}
      {left > 0 ? ` ${t('xchangeExport.preview.left', { count: left })}` : null}
    </p>
  );
}

/** Τα ευρήματα που θα έκαναν την εξαγωγή να αρνηθεί, πριν το κλικ (και μετά, αν ήρθαν από την ίδια την εξαγωγή). */
export function XChangeIssueList({ issues }: { readonly issues: readonly CatalogIssue[] }) {
  const message = useIssueMessage(true);
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm text-destructive" role="alert">
      {issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{message(issue)}</li>)}
    </ul>
  );
}

export function XChangeExportPreviewNote({ state }: { readonly state: XChangePreviewState }) {
  const { t } = useCatalogText();
  switch (state.kind) {
    case 'loading':
      return <p className="m-0 text-sm text-muted-foreground" role="status">{t('xchangeExport.preview.loading')}</p>;
    case 'refused':
      return <XChangeIssueList issues={state.issues} />;
    case 'unavailable':
      return null;
    case 'ready': {
      const { preview } = state;
      return (
        <>
          {preview.blockers.length > 0 ? <XChangeIssueList issues={preview.blockers} /> : null}
          {preview.emptyCause === null ? <ExportableLine preview={preview} /> : <NothingToExport cause={preview.emptyCause} />}
        </>
      );
    }
  }
}

/** Η εξαγωγή επιτρέπεται εκτός αν ο προέλεγχος **ξέρει** ότι θα αρνηθεί. Αποτυχία προελέγχου δεν μπλοκάρει (κρίνει ο διακομιστής). */
export function xchangePreviewAllowsExport(state: XChangePreviewState): boolean {
  if (state.kind === 'loading' || state.kind === 'refused') return false;
  return state.kind === 'unavailable' || (state.preview.emptyCause === null && state.preview.blockers.length === 0);
}
