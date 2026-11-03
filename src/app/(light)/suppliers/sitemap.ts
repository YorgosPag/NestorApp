/**
 * `/suppliers/sitemap.xml` — **το sitemap της βιτρίνας** (ADR-923 §5.13 Σ5).
 *
 * 🔑 Δυναμικό: στο `next build` δεν υπάρχει Firestore. Η μνήμη ζει στον αναγνώστη.
 * 🔑 Βλάβη ανάγνωσης ρίχνει 5xx, όχι κενό αρχείο: η μηχανή ξαναδοκιμάζει, ενώ ένα κενό sitemap θα έμοιαζε με απόσυρση.
 *
 * @module app/(light)/suppliers/sitemap
 */

import type { MetadataRoute } from 'next';

import { publicUrl } from '@/lib/http/public-origin';
import { readPublicSitemapPaths } from '@/services/public-catalog/public-catalog.reader';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = await readPublicSitemapPaths();
  return paths.flatMap((path) => {
    const url = publicUrl(path);
    return url === null ? [] : [{ url }];
  });
}
