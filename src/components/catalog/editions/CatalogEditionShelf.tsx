'use client';

/**
 * @fileoverview **Το ράφι των εντύπων** (ADR-923 §5.15.3) — ένα component για τη δημόσια βιτρίνα και για τον αγοραστή: ανά
 *   ράφι το ισχύον έντυπο του θεατή μπροστά, και από κάτω οι «Άλλες εκδόσεις» (παλαιότερες ή για άλλο κοινό).
 * @related subapps/catalog/publishing/catalog-edition-policy.ts (`catalogEditionShelvesOf` — η ομαδοποίηση, καμία κρίση)
 * @module components/catalog/editions/CatalogEditionShelf
 *
 * 🔑 **Το «ισχύον» δεν κρίνεται εδώ**: ήρθε σημαδεμένο από τον διακομιστή (ο θεατής δεν ξέρει το κοινό).
 * 🔑 Η κατάσταση **λέγεται με λέξη** (CHECK 3.41), ποτέ μόνο με χρώμα ή θέση.
 * 🔑 Πέρα από ArchiExpo/Grohe/Geberit: οι παλαιότερες **δεν** χάνονται και **δεν** μπερδεύονται με την ισχύουσα — ζουν κάτω από
 *    αυτήν, στο ίδιο ράφι, και ο σταθερός σύνδεσμος του ραφιού δείχνει πάντα την ισχύουσα **του θεατή**.
 * ⚠️ Κείμενα από το `public-catalog` (ζει και στη βιτρίνα και, σε διάλογο, μέσα στην εφαρμογή). Καμία ειδοποίηση (toast): ο
 *    πάροχος δεν ζει στη βιτρίνα.
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { BookOpen } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/intl-formatting';
import { catalogEditionShelvesOf, type CatalogEditionShelfView as Shelf } from '@/subapps/catalog/publishing/catalog-edition-policy';
import type { HumanLanguage } from '@/i18n/languages';
import type { CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';
import { formatFileSize } from '@/utils/file-validation';
import { usePublicCatalogText } from '@/components/public-catalog/public-catalog-text';

/** Πώς ανοίγει ένα έντυπο: σύνδεσμος (βιτρίνα — βαθύς σύνδεσμος, νέα καρτέλα, ιστορικό) ή πράξη (διάλογος μέσα στην εφαρμογή). */
export type CatalogEditionOpener =
  | { readonly kind: 'link'; readonly hrefOf: (edition: CatalogEditionView) => string }
  | { readonly kind: 'action'; readonly onOpen: (edition: CatalogEditionView) => void };

export interface CatalogEditionShelfProps {
  readonly editions: readonly CatalogEditionView[];
  readonly opener: CatalogEditionOpener;
  /** Ο σταθερός σύνδεσμος ενός ραφιού, όπου υπάρχει (βιτρίνα). */
  readonly shelfHrefOf?: (shelfKey: string) => string;
}

/** Η γλώσσα του εντύπου, ανά γλώσσα περιεχομένου (κλειστό σύνολο της ρίζας). */
const LANGUAGE_KEYS: Readonly<Record<HumanLanguage, string>> = { el: 'editions.language.el', en: 'editions.language.en' };

function EditionFacts({ edition }: { readonly edition: CatalogEditionView }) {
  const { t, language } = usePublicCatalogText();
  return (
    <p className="m-0 text-xs text-muted-foreground">
      <time dateTime={edition.publishedAt}>{formatDate(edition.publishedAt)}</time>
      {` · ${t('editions.pages', { count: edition.pageCount })} · ${formatFileSize(edition.sizeBytes, language)} · ${t(LANGUAGE_KEYS[edition.language])}`}
    </p>
  );
}

function OpenEdition({ edition, opener }: { readonly edition: CatalogEditionView; readonly opener: CatalogEditionOpener }) {
  const { t, text } = usePublicCatalogText();
  const label = t('editions.open', { title: text(edition.title) });
  if (opener.kind === 'link') {
    return <Button asChild size="sm" variant="outline"><Link href={opener.hrefOf(edition)} aria-label={label}>{t('editions.read')}</Link></Button>;
  }
  return <Button type="button" size="sm" variant="outline" aria-label={label} onClick={() => opener.onOpen(edition)}>{t('editions.read')}</Button>;
}


function OtherEditions({ shelf, opener }: { readonly shelf: Shelf; readonly opener: CatalogEditionOpener }) {
  const { t, text } = usePublicCatalogText();
  if (shelf.others.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">{t('editions.others', { count: shelf.others.length })}</summary>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {shelf.others.map((edition) => (
          <li key={edition.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
            <section className="min-w-0">
              <h4 className="m-0 truncate text-sm font-medium">{text(edition.title)}</h4>
              {/* Μη ισχύουσα: παλαιότερη (αντικαταστάθηκε) ή ισχύουσα για **άλλο** κοινό που βλέπει κι αυτός ο θεατής. */}
              <p className="m-0 text-xs text-muted-foreground">{t(edition.status === 'superseded' ? 'editions.status.superseded' : 'editions.status.alternate')}</p>
              <EditionFacts edition={edition} />
            </section>
            <OpenEdition edition={edition} opener={opener} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function ShelfCard({ shelf, opener, shelfHrefOf }: { readonly shelf: Shelf } & Omit<CatalogEditionShelfProps, 'editions'>) {
  const { t, text } = usePublicCatalogText();
  const lead = shelf.current ?? shelf.others[0];
  if (lead === undefined) return null;
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <section className="flex min-w-0 items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <section className="min-w-0">
            <h3 className="m-0 text-base font-semibold">{text(lead.title)}</h3>
            {shelf.current !== null ? <Badge variant="success">{t('editions.status.current')}</Badge> : null}
            <EditionFacts edition={lead} />
          </section>
        </section>
        {shelf.current !== null ? <OpenEdition edition={shelf.current} opener={opener} /> : null}
      </header>
      {shelfHrefOf && shelf.current !== null ? (
        <p className="m-0 text-xs"><Link href={shelfHrefOf(shelf.shelfKey)}>{t('editions.shelfLink')}</Link></p>
      ) : null}
      <OtherEditions shelf={shelf} opener={opener} />
    </li>
  );
}

export function CatalogEditionShelf({ editions, opener, shelfHrefOf }: CatalogEditionShelfProps) {
  const { t } = usePublicCatalogText();
  const shelves = catalogEditionShelvesOf(editions);
  if (shelves.length === 0) return <p className="m-0 text-sm text-muted-foreground" role="status">{t('editions.empty')}</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label={t('editions.title')}>
      {shelves.map((shelf) => <ShelfCard key={shelf.shelfKey} shelf={shelf} opener={opener} shelfHrefOf={shelfHrefOf} />)}
    </ul>
  );
}
