/**
 * /shared/** — οι σύνδεσμοι διαμοιρασμού (`/shared/<token>` · `/shared/po/<token>`).
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ LAYOUT (ADR-876 Ε6).** Οι δύο σελίδες είναι `'use client'` και
 * φορτώνουν μέσω `LazyRoutes` (client module) — άρα είναι **δομικά ανίκανες** να εξάγουν
 * route segment config. Εδώ ζει το `force-dynamic` τους (καμία ενδιάμεση μνήμη δεν κρατά
 * σελίδα που ανοίγει με κλειδί — άγκυρα `credential-link-page.test.ts` Π2).
 *
 * 🔑 Τα `noindex`/`no-referrer` **ΔΕΝ** δηλώνονται πια εδώ: τα δίνει **μία φορά** το
 * `(link)/layout.tsx` σε όλη την ομάδα (ADR-939 §6) και κληρονομούνται.
 *
 * ⚠️ **ΟΧΙ μετατροπή των σελίδων σε server component**: ένα `LazyRoutes.X` διαβασμένο από
 * server αρχείο είναι **πρόσβαση ιδιότητας σε αναφορά πελάτη**, όχι component — θα έσπαγε
 * σιωπηλά. Η δήλωση ανεβαίνει ένα επίπεδο, εκεί όπου server αρχείο **μπορεί** να τη γράψει.
 *
 * ⚠️ Μηδέν DOM: το κέλυφος το αποφασίζει ο γονικός φάκελος (CHECK 3.52/3.63), όχι αυτό.
 *
 * @module app/(link)/shared/layout
 */

export const dynamic = 'force-dynamic';

export default function SharedLinkLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
