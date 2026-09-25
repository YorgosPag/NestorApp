'use client';

/**
 * 🔖 **«Αποθήκευση αναζήτησης»** στον χάρτη αποτελεσμάτων (ADR-888) — Zillow / Redfin / Rightmove «Save search».
 *
 * 🔑 **Η αυθεντία είναι το URL**: ό,τι αποθηκεύεται είναι ακριβώς η αναζήτηση που γράφει η διεύθυνση
 * (φίλτρα + `?draw=`), μέσω του `parseListingFilters` — ποτέ ένα δεύτερο αντίγραφο κατάστασης.
 *
 * ⚠️ **Το σώμα του παραθύρου φορτώνεται ΜΟΝΟ όταν ανοίξει** (`dynamic`): η δημόσια σελίδα δεν κατεβάζει τα
 * πεδία της φόρμας ζήτησης για όσους δεν αποθηκεύουν ποτέ.
 *
 * 🔁 **Ανώνυμος**: σύνδεση με επιστροφή στο ίδιο URL + `?save=1` ⇒ επιστρέφει με **ανοιχτό** παράθυρο.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { BookmarkCheck, BookmarkPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/auth/hooks/useAuth';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SAVE_SEARCH_INTENT_PARAM, demandDetailHref } from '@/lib/demand/demand-routes';
import { savedDemandForSearch } from '@/lib/demand/demand-saved-search';
import { searchResultsHref } from '@/lib/listings/listing-routes';
import { Link, useRouter } from '@/lib/workspace/navigation';
import { useMyDemands } from '@/services/realtime/hooks/useMyDemands';

// ⚠️ Μόνο το μικρό `search-region` εδώ: τα κείμενα του παραθύρου ζουν στο `property-market`, που το φέρνει
//    το δυναμικό σώμα — ώστε η κλειστότητα i18n της δημόσιας σελίδας να μη μεγαλώσει (CHECK 3.34).
const NS = 'search-region';

// ⚠️ Ο τύπος γράφεται ΕΔΩ και όχι `import type` από το σώμα: ο αναλυτής κλειστότητας θα ακολουθούσε την εισαγωγή.
const SaveSearchDialogBody = dynamic<{ readonly searchQuery: string; readonly onClose: () => void }>(
  () => import('./SaveSearchDialogBody').then((m) => m.SaveSearchDialogBody),
  { ssr: false },
);

/** Το query της αναζήτησης **χωρίς** την πρόθεση `save` — αυτό που γίνεται ζήτηση. */
function searchQueryOf(params: URLSearchParams): string {
  const copy = new URLSearchParams(params);
  copy.delete(SAVE_SEARCH_INTENT_PARAM);
  return copy.toString();
}

/** Ανοιχτό/κλειστό, με το `?save=1` της επιστροφής από τη σύνδεση να ανοίγει **μία** φορά. */
function useSaveSearchOpen(params: URLSearchParams): readonly [boolean, (next: boolean) => void] {
  const router = useRouter();
  const intent = params.get(SAVE_SEARCH_INTENT_PARAM) === '1';
  const [open, setOpen] = React.useState(intent);

  React.useEffect(() => {
    if (intent) setOpen(true);
  }, [intent]);

  const change = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next && intent) router.replace(searchResultsHref(searchQueryOf(params)), { scroll: false });
    },
    [intent, params, router],
  );
  return [open, change] as const;
}

/**
 * 🔑 **«Αποθηκευμένη;» από την ΑΛΗΘΕΙΑ, όχι από τοπική σημαία**: οι ζητήσεις του ανθρώπου διαβάζονται ζωντανά
 * (`useMyDemands`) — μόλις γραφτεί το έγγραφο, το κουμπί γίνεται «✓ Αποθηκευμένη» μόνο του, και το ίδιο ισχύει
 * σε ανανέωση, σε άλλη καρτέλα, σε άλλη συσκευή. Κλείνει και το κενό ιδεμπότητας: δεύτερο «Αποθήκευση» για την
 * ΙΔΙΑ αναζήτηση δεν προσφέρεται (Zillow/Redfin: «Save search» → «Saved»).
 */
function useSavedDemandId(searchQuery: string): string | null {
  const { user } = useAuth();
  const mine = useMyDemands(user?.uid ?? null);
  return React.useMemo(() => {
    if (mine.state !== 'ready') return null;
    const complete = mine.demands.flatMap((read) => (read.kind === 'complete' ? [read.demand] : []));
    return savedDemandForSearch(complete, searchQuery)?.id ?? null;
  }, [mine, searchQuery]);
}

/** «✓ Αποθηκευμένη αναζήτηση» — οδηγεί στη ζήτηση (όνομα · ειδοποιήσεις · απόσυρση). */
function SavedSearchLink({ demandId }: { readonly demandId: string }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const iconSizes = useIconSizes();
  return (
    <Button asChild size="sm" variant="secondary" className="pointer-events-auto shadow-sm">
      <Link href={demandDetailHref(demandId)}>
        <BookmarkCheck className={iconSizes.sm} aria-hidden="true" />
        {t(`${NS}:saveSearch.saved`)}
      </Link>
    </Button>
  );
}

export function SaveSearchButton(): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const iconSizes = useIconSizes();
  const raw = useSearchParams();
  const params = React.useMemo(() => new URLSearchParams(raw?.toString() ?? ''), [raw]);
  const [open, setOpen] = useSaveSearchOpen(params);
  const savedId = useSavedDemandId(searchQueryOf(params));

  // Ανοιχτό παράθυρο μένει ανοιχτό (δείχνει «Αποθηκεύτηκε»)· κλειστό + αποθηκευμένη ⇒ σύνδεσμος προς τη ζήτηση.
  if (savedId !== null && !open) return <SavedSearchLink demandId={savedId} />;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="pointer-events-auto shadow-sm"
      >
        <BookmarkPlus className={iconSizes.sm} aria-hidden="true" />
        {t(`${NS}:saveSearch.button`)}
      </Button>
      <DialogContent>
        {/* 🔴 Ο ΤΙΤΛΟΣ ΕΙΝΑΙ ΣΤΑΤΙΚΟΣ, ΟΧΙ στο δυναμικό σώμα: το Radix απαιτεί `DialogTitle` από το ΠΡΩΤΟ καρέ
            (αναγνώστες οθόνης) — όσο το σώμα φορτώνει, το παράθυρο θα ήταν ανώνυμο (βρέθηκε ζωντανά, ADR-888). */}
        <DialogHeader>
          <DialogTitle>{t(`${NS}:saveSearch.button`)}</DialogTitle>
        </DialogHeader>
        {open && <SaveSearchDialogBody searchQuery={searchQueryOf(params)} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
