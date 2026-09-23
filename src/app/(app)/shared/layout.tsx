/**
 * /shared/** — οι σύνδεσμοι διαμοιρασμού (`/shared/<token>` · `/shared/po/<token>`).
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ LAYOUT (ADR-876 Ε6).** Οι δύο σελίδες είναι `'use client'` και
 * φορτώνουν μέσω `LazyRoutes` (client module) — άρα είναι **δομικά ανίκανες** να εξάγουν
 * metadata. Μέχρι σήμερα δεν δήλωναν **τίποτα**: ούτε `noindex`, ούτε `no-referrer`, σε
 * διευθύνσεις που **είναι** το κλειδί του κοινόχρηστου αρχείου / της παραγγελίας.
 *
 * ⚠️ **ΟΧΙ μετατροπή των σελίδων σε server component**: ένα `LazyRoutes.X` διαβασμένο από
 * server αρχείο είναι **πρόσβαση ιδιότητας σε αναφορά πελάτη**, όχι component — θα έσπαγε
 * σιωπηλά. Η δήλωση ανεβαίνει ένα επίπεδο, εκεί όπου server αρχείο **μπορεί** να τη γράψει.
 *
 * ⚠️ Μηδέν DOM: το κέλυφος το αποφασίζει ο γονικός φάκελος (CHECK 3.52/3.63), όχι αυτό.
 *
 * @module app/(app)/shared/layout
 */

import type { Metadata } from 'next';

import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

export default function SharedLinkLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
