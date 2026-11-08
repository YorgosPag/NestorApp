'use client';

/**
 * @fileoverview **Ο αναγνώστης ενός δημοσιευμένου εντύπου** (ADR-923 §5.15.3) — ο **ένας** `PdfCanvasViewer` με άδεια και όλες
 *   τις στρώσεις αναγνώστη εντύπου, για τις τρεις πόρτες (ανώνυμος · αγοραστής · ιδιοκτήτης).
 * @related components/file-manager/PdfCanvasViewer.tsx (Η5: κανένας δεύτερος προβολέας) · services/catalog/catalog-editions-api.client.ts
 * @module components/catalog/editions/CatalogEditionReader
 *
 * 🔑 **Ο εκδότης της άδειας έρχεται από τον καλούντα** — αυτός ξέρει ποια πόρτα κρίνει τον θεατή του.
 * 🔑 Το κλειδί του εγγράφου είναι το `editionId` (αμετάβλητο αρχείο): η άδεια ανανεώνεται, το έγγραφο δεν ξαναφορτώνεται.
 * 🏆 **Πέρα από τους μεγάλους**: σε έντυπο που δεν είναι το ισχύον **του θεατή** (παλαιότερο, ή για άλλο κοινό) ο αναγνώστης το
 *    λέει και δίνει το ισχύον με ένα κλικ — Grohe/Geberit/Issuu/Publitas δεν το κάνουν. ⚠️ Ανοίγει στην αρχή: χωρίς χάρτη
 *    σελίδων (Θ.4) η σελίδα Ν της παλιάς δεν είναι η σελίδα Ν της νέας.
 */

import React, { useMemo } from 'react';
import { Link } from '@/lib/workspace/navigation';

import { PdfCanvasViewer } from '@/components/file-manager/PdfCanvasViewer';
import type { PdfViewerFeatures } from '@/components/file-manager/pdf-canvas-config';
import type { IssuePdfLicense } from '@/components/file-manager/pdf-range-transport';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { publicCatalogEditionSegmentOf } from '@/subapps/catalog/public/public-catalog-routes';
import type { CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';
import { usePublicCatalogText } from '@/components/public-catalog/public-catalog-text';
import type { CatalogEditionOpener } from './CatalogEditionShelf';

export interface CatalogEditionReaderProps {
  readonly edition: CatalogEditionView;
  readonly issue: IssuePdfLicense;
  /** Το ισχύον έντυπο του ίδιου ραφιού για τον θεατή, όταν αυτό εδώ **δεν** είναι το ισχύον. */
  readonly current: CatalogEditionView | null;
  readonly opener: CatalogEditionOpener;
  /** Η σελίδα στη διεύθυνση (`#page=N`): μόνο όπου ο αναγνώστης **είναι** η σελίδα, ποτέ μέσα σε διάλογο άλλης οθόνης. */
  readonly pageInUrl: boolean;
  readonly className?: string;
}

function CurrentEditionNotice({ current, opener }: { readonly current: CatalogEditionView; readonly opener: CatalogEditionOpener }) {
  const { t, text } = usePublicCatalogText();
  const title = text(current.title);
  return (
    <aside className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-[hsl(var(--bg-info))] p-3 text-sm" role="status">
      <p className="m-0">{t('editions.newerNotice', { title })}</p>
      {opener.kind === 'link' ? (
        <Button asChild size="sm"><Link href={opener.hrefOf(current)}>{t('editions.openCurrent')}</Link></Button>
      ) : (
        <Button type="button" size="sm" onClick={() => opener.onOpen(current)}>{t('editions.openCurrent')}</Button>
      )}
    </aside>
  );
}

export function CatalogEditionReader({ edition, issue, current, opener, pageInUrl, className }: CatalogEditionReaderProps) {
  const { text } = usePublicCatalogText();
  const title = text(edition.title);
  const license = useMemo(() => ({ key: edition.id, issue }), [edition.id, issue]);
  const features = useMemo<PdfViewerFeatures>(() => ({
    textSelection: true,
    links: true,
    pageInUrl,
    sidebar: true,
    // Ίδιο όνομα με το τμήμα της δημόσιας διεύθυνσης: ένα αρχείο, ένα όνομα, σε κάθε πόρτα.
    download: { fileName: `${publicCatalogEditionSegmentOf(edition)}.pdf` },
  }), [pageInUrl, edition]);
  const notice = !edition.current && current !== null && current.id !== edition.id ? current : null;
  return (
    <section className={cn('flex min-h-0 flex-col gap-2', className)} aria-label={title}>
      {notice !== null ? <CurrentEditionNotice current={notice} opener={opener} /> : null}
      <PdfCanvasViewer license={license} title={title} features={features} className="min-h-0 flex-1" />
    </section>
  );
}
