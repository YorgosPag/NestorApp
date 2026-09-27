'use client';

/**
 * @fileoverview **ΤΟ ΚΟΙΝΟ ΚΕΛΥΦΟΣ ΤΩΝ ΔΥΟ ΑΔΕΛΦΩΝ ΣΕΛΙΔΩΝ** — `/listing/[id]/photos` και `/listing/[id]/floorplan`
 * (ADR-884 Φ2στ · §4.12 Μέρος Δ).
 * @related `ListingPhotosPageContent.tsx` · `ListingFloorplanPageContent.tsx` · `ListingMediaTabs.tsx`
 * @module components/listing-detail/media/ListingMediaPageChrome
 *
 * 🔑 **ΕΞΗΧΘΗ ΓΙΑΤΙ ΤΟ jscpd ΤΟ ΕΠΙΑΣΕ ΣΤΟ ΙΔΙΟ COMMIT** (N.18, CHECK 3.28 `--diff`): οι δύο σελίδες γεννήθηκαν
 * ως δίδυμα — ίδιο φορτωτή (`usePublicListing`), ίδια τρία μηνύματα χωρίς περιεχόμενο, ίδια μία-γραμμή
 * επικεφαλίδα (πίσω · τίτλος · καρτέλες). Η ερώτηση *«πώς μοιάζει η σελίδα ΟΣΟ ΔΕΝ ΕΧΕΙ ακόμη αγγελία;»* και
 * *«πώς μοιάζει η επικεφαλίδα;»* έχουν **ΜΙΑ** απάντηση, εδώ — οι δύο σελίδες διαφέρουν μόνο στο **σώμα**
 * (πλέγμα φωτογραφιών εναντίον στοίβας κατόψεων), που ζει στο δικό της αρχείο η καθεμία.
 */

import type { ReactElement, ReactNode } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { Link } from '@/lib/workspace/navigation';
import { usePublicListing } from '@/services/realtime/hooks/usePublicListings';
import type { PublicListing } from '@/types/public-listing';

import { ListingMediaTabs, type ListingMediaTabId, type ListingMediaTabsAvailability } from './ListingMediaTabs';

/**
 * Οι **τρεις** καταστάσεις χωρίς περιεχόμενο — ίδια επιφάνεια-καμβάς με το σώμα, ώστε το κάδρο να μη μεταπηδά.
 *
 * ⚠️ **ΧΩΡΙΣ `data-shell-viewport`**: και οι δύο σελίδες είναι πλέγμα/λίστα με φυσική κύλιση εγγράφου — όχι
 * επιφάνεια χειρισμού (χάρτης, πανόραμα). Το `.shell-surface.json` (§`$reflowExceptionWhy`) το λέει ρητά: *«μια
 * φόρμα, ένα τιμολόγιο ή μια λίστα ΔΕΝ δικαιούνται την εξαίρεση»* από το WCAG 2.2 SC 1.4.10 — άρα εδώ ΔΕΝ κλειδώνει.
 */
export function MediaPageNotice({ message }: { readonly message: string }): ReactElement {
  return (
    <section className="flex flex-1 flex-col items-center justify-center p-6">
      <p className="text-sm text-muted-foreground" role="status">{message}</p>
    </section>
  );
}

/** Η μία-γραμμή επικεφαλίδα και των δύο σελίδων — πίσω στην αγγελία · τίτλος · οι τρεις καρτέλες. */
export function MediaPageHeader({
  listingId,
  title,
  current,
  available,
}: {
  readonly listingId: string;
  readonly title: string;
  readonly current: ListingMediaTabId;
  readonly available: ListingMediaTabsAvailability;
}): ReactElement {
  const { t } = useTranslation(['listing-detail']);
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2">
      <nav>
        <Link href={listingDetailHref(listingId)} className="text-sm underline">
          {t('listing-detail:media.backToListing')}
        </Link>
      </nav>
      <h1 className="m-0 text-base font-semibold">{title}</h1>
      <ListingMediaTabs listingId={listingId} current={current} available={available} />
    </header>
  );
}

/**
 * Ο **ίδιος φορτωτής** με τη σελίδα αγγελίας (`usePublicListing`) — δεν υπάρχει δεύτερο ερώτημα να αποκλίνει.
 * Αποδίδει `render(listing)` μόνο όταν βρέθηκε· τα τρία μηνύματα χωρίς περιεχόμενο ζουν εδώ, μία φορά.
 */
export function ListingMediaPageBody({
  listingId,
  render,
}: {
  readonly listingId: string;
  readonly render: (listing: PublicListing) => ReactNode;
}): ReactElement {
  const { t } = useTranslation(['search-results']);
  const lookup = usePublicListing(listingId);

  if (lookup.state === 'loading') return <MediaPageNotice message={t('search-results:detail.loading')} />;
  if (lookup.state === 'absent') return <MediaPageNotice message={t('search-results:detail.absent.title')} />;
  if (lookup.state === 'error') return <MediaPageNotice message={t('search-results:detail.error.title')} />;

  return <>{render(lookup.listing)}</>;
}
