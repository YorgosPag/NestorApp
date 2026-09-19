'use client';

/**
 * **Το ημερολόγιο διαμονής της αγγελίας** — φόρτωση ανά μήνα, επιλογή, απάντηση του διακομιστή.
 *
 * ⚠️ **Φορτώνεται με `next/dynamic` από το `ListingStay`** (ADR-744 · ADR-835 §21): βρίσκεται
 * κάτω από την πρώτη οθόνη, και τα κλειδιά του δεν ανήκουν στο σύγχρονο slice της σελίδας —
 * ίδιο πρότυπο με τον καμβά του 3Δ μοντέλου. **Default export** γι' αυτόν τον λόγο.
 *
 * 🔑 **Η τελική απάντηση έρχεται από τον ΔΙΑΚΟΜΙΣΤΗ** (`useStayAnswers`), όχι από το πλέγμα: το
 * πλέγμα είναι ένδειξη, η μηχανή ετυμηγορία — και η απάντηση φέρνει και την τιμολόγηση.
 *
 * 🏆 **Τα κατοικίδια ταξιδεύουν από την αναζήτηση** (ADR-777 §8.60.21.7): το `?pets=` διαβάζεται από τον
 * **ίδιο** αναλυτή (`parseListingFilters`), ώστε το σύνολο της σελίδας να είναι το σύνολο της κάρτας.
 * Ο επιλογέας ζει **έξω** από τη φόρμα αιτήματος: ένα «πάνω από το όριο» κρύβει τη φόρμα — όχι τον
 * τρόπο να το διορθώσεις.
 *
 * @related ADR-835 §4.5 · §21 · ADR-777 §8.60.21.7 · hooks/listings/usePublicStayNights.ts · hooks/listings/useStayAnswers.ts
 */

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { StayCountSelect, STAY_PET_CHOICES } from '@/components/shared/stay/StayCountSelect';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useStayAnswers } from '@/hooks/listings/useStayAnswers';
import { readableStayRequestsOf, useMyStayRequests } from '@/hooks/listings/useMyStayRequests';
import { useAuth } from '@/auth/hooks/useAuth';
import { usePublicStayNights, type PublicStayNightsState } from '@/hooks/listings/usePublicStayNights';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { parseListingFilters } from '@/lib/listings/listing-filters';
import { addMonthsToMonthKey, monthKeyOf } from '@/lib/stay/stay-calendar-month';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';
import { NO_STAY_SELECTION, nextStaySelection, type StayPublicSelection } from '@/lib/stay/stay-public-selection';
import { isMyPendingNight } from '@/lib/stay/stay-guest-request-view';
import { todayLocalDate } from '@/lib/date-local';
import type { PublicListing } from '@/types/public-listing';

import { ListingStayAnswer } from './ListingStayAnswer';
import { ListingStayCalendar } from './ListingStayCalendar';
import { ListingStayRequest } from './ListingStayRequest';

function queryOf(selection: StayPublicSelection, pets: number | null): StayQuery | null {
  return selection.kind === 'range' ? { checkIn: selection.checkIn, checkOut: selection.checkOut, guests: null, pets } : null;
}

/** Τα κατοικίδια της αναζήτησης που έφερε τον επισκέπτη εδώ — `null` = δεν δηλώθηκαν. */
function usePetsFromSearch(): number | null {
  const searchParams = useSearchParams();
  return React.useMemo(() => parseListingFilters(new URLSearchParams(searchParams?.toString() ?? '')).pets, [searchParams]);
}

function SelectionLine({ selection, onClear }: {
  readonly selection: StayPublicSelection;
  readonly onClear: () => void;
}): React.ReactElement {
  const { t } = useTranslation(['short-stay']);
  if (selection.kind === 'none') return <p className="text-sm text-muted-foreground">{t('short-stay:calendar.pickCheckIn')}</p>;
  if (selection.kind === 'check-in') return <p className="text-sm text-muted-foreground">{t('short-stay:calendar.pickCheckOut')}</p>;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
      {t('short-stay:calendar.selected', { from: formatCalendarDay(selection.checkIn, true), to: formatCalendarDay(selection.checkOut, true) })}
      <button type="button" onClick={onClear} className="underline">{t('short-stay:calendar.clear')}</button>
    </p>
  );
}

/** Ό,τι λέγεται **αντί** για ημερολόγιο: φόρτωση · αποτυχία · αδήλωτο · αδιάβαστο. */
function NightsNotice({ state, onRetry }: {
  readonly state: PublicStayNightsState;
  readonly onRetry: () => void;
}): React.ReactElement | null {
  const { t } = useTranslation(['short-stay']);
  if (state.kind === 'loading') return <p className="text-sm text-muted-foreground">{t('short-stay:calendar.loading')}</p>;
  if (state.kind === 'failed') {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-foreground">
        {t('short-stay:calendar.failed')}
        <button type="button" onClick={onRetry} className="underline">{t('short-stay:calendar.retry')}</button>
      </p>
    );
  }
  if (state.nights.kind === 'undeclared') return <p className="text-sm text-foreground">{t('short-stay:calendar.undeclared')}</p>;
  if (state.nights.kind === 'unreadable') return <p role="alert" className="text-sm text-foreground">{t('short-stay:calendar.unreadable')}</p>;
  return null;
}

/**
 * **Η ερώτηση του επισκέπτη** — επιλογή νυχτών, κατοικίδια (από την αναζήτηση), και η απάντηση του
 * διακομιστή. `refreshAnswers` = ξαναρωτά την ίδια ερώτηση (ο γραφέας είπε `price-changed`).
 */
function useStayQuestion(listingId: string) {
  const [selection, setSelection] = React.useState<StayPublicSelection>(NO_STAY_SELECTION);
  const petsFromSearch = usePetsFromSearch();
  const [pets, setPets] = React.useState<number | null>(petsFromSearch);
  const [revision, setRevision] = React.useState(0);
  const listingIds = React.useMemo(() => [listingId], [listingId]);
  const query = React.useMemo(() => queryOf(selection, pets), [selection, pets]);
  const answers = useStayAnswers(listingIds, query, revision);
  const refreshAnswers = React.useCallback(() => setRevision((current) => current + 1), []);
  return { selection, setSelection, pets, setPets, answers, refreshAnswers };
}

/**
 * **Τα αιτήματά μου** — ζουν ΕΔΩ, στον γονέα: ένα fetch για τις γραμμές αιτημάτων **και** για τη
 * σήμανση «το αίτημά σας» στο πλέγμα (ADR-835 §23.12 Ε3 — πριν, ο επισκέπτης έβλεπε το δικό του
 * αίτημα ως «σε αναμονή για άλλον επισκέπτη»).
 */
function useMyRequests(listingId: string) {
  const { user } = useAuth();
  const mine = useMyStayRequests(listingId, user !== null);
  const myRequests = readableStayRequestsOf(mine.state);
  const isMine = React.useCallback((day: string) => isMyPendingNight(myRequests, day), [myRequests]);
  return { mine, isMine };
}

export default function ListingStayBooking({ listing }: { readonly listing: PublicListing }): React.ReactElement {
  const { t } = useTranslation(['short-stay']);
  const [monthKey, setMonthKey] = React.useState(() => monthKeyOf(todayLocalDate()));
  const { state, reload } = usePublicStayNights(listing.id, monthKey);
  const { selection, setSelection, pets, setPets, answers, refreshAnswers } = useStayQuestion(listing.id);
  const { mine, isMine } = useMyRequests(listing.id);

  if (state.kind !== 'loaded' || state.nights.kind !== 'declared') {
    return <NightsNotice state={state} onRetry={reload} />;
  }
  const nights = state.nights.nights;

  return (
    <>
      <SelectionLine selection={selection} onClear={() => setSelection(NO_STAY_SELECTION)} />
      <StayCountSelect
        label={t('short-stay:pets.filterLabel')} anyLabel={t('short-stay:pets.filterAny')}
        choices={STAY_PET_CHOICES} value={pets} onChange={setPets}
      />
      <ListingStayCalendar
        monthKey={monthKey} nights={nights} selection={selection}
        onShiftMonth={(delta) => setMonthKey((current) => addMonthsToMonthKey(current, delta))}
        onPick={(day) => setSelection((current) => nextStaySelection(current, day, nights))}
        isMine={isMine}
      />
      <ListingStayAnswer listingId={listing.id} state={answers} />
      {/* Στάδιο Δ (ADR-835 §23): η υπόσχεση πριν, το αίτημα, και τα αιτήματά μου. */}
      <ListingStayRequest
        mine={mine}
        query={selection.kind === 'range' ? { checkIn: selection.checkIn, checkOut: selection.checkOut, pets: pets ?? 0 } : null}
        answer={answers.kind === 'loaded' ? answers.answers[listing.id] : undefined}
        maxGuests={listing.stay?.maxGuests ?? null}
        onChanged={() => { setSelection(NO_STAY_SELECTION); reload(); }}
        onPriceChanged={refreshAnswers}
      />
    </>
  );
}
