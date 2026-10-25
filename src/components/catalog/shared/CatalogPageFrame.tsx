'use client';

/**
 * @fileoverview **Το πλαίσιο κάθε σελίδας του καταλόγου** — τίτλος, εισαγωγή, ενέργειες, και οι τρεις καταστάσεις
 *   φόρτωσης ρητά (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/CatalogPageFrame
 *
 * ⚠️ `section w-full`, όχι `main`/`p-*`: το `<main>` και το κενό τα δίνει το κέλυφος (CHECK 3.63 — ίδιο ιδίωμα με το
 *    `DocumentRegistryContent`).
 * 🔑 Η αποτυχία ανάγνωσης **λέγεται** — ποτέ σιωπηλή άδεια λίστα που θα διαβαζόταν «δεν έχετε τίποτα».
 */

import React from 'react';

import type { CatalogLoadState } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogText } from './catalog-ui-hooks';

interface CatalogPageFrameProps {
  readonly title: string;
  readonly lead: string;
  readonly actions?: React.ReactNode;
  readonly state: CatalogLoadState;
  readonly children: React.ReactNode;
}

export function CatalogPageFrame({ title, lead, actions, state, children }: CatalogPageFrameProps) {
  const { t } = useCatalogText();
  return (
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <hgroup className="flex min-w-0 flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold text-foreground">{title}</h1>
          <p className="m-0 text-sm text-muted-foreground">{lead}</p>
        </hgroup>
        {actions ? <nav className="flex flex-wrap items-center gap-2" aria-label={t('common.actions')}>{actions}</nav> : null}
      </header>
      {state === 'loading' ? <p className="m-0 text-muted-foreground" role="status">{t('common.loading')}</p> : null}
      {state === 'failed' ? <p className="m-0 text-destructive" role="alert">{t('common.loadFailed')}</p> : null}
      {state === 'ready' ? children : null}
    </section>
  );
}
