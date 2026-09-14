'use client';

/**
 * @fileoverview 🏆 **«ΕΜΦΑΝΙΣΗ ΤΗΛΕΦΩΝΟΥ / EMAIL»** — ο αριθμός δεν υπάρχει στη σελίδα μέχρι να
 *   τον ζητήσει άνθρωπος (ADR-841 §7 Α21.16).
 * @related app/api/pro/[companyId]/locations/[locationId]/channels/route.ts
 * @module components/mandate/ChannelReveal
 *
 * 🔑 **Ένα αίτημα φέρνει και τα δύο κανάλια του καταστήματος** — ο άνθρωπος που πάτησε «τηλέφωνο»
 * δεν πρέπει να ξοδέψει δεύτερο «εισιτήριο» ορίου για το email.
 *
 * ⚠️ **Τρεις αποτυχίες, τρία κείμενα** (N.12): `429` ⇒ *«περιμένετε»* · `404` ⇒ *«δεν δημοσιεύονται
 * πια»* · οτιδήποτε άλλο ⇒ *«ξαναδοκιμάστε»*. Ένα κοινό «σφάλμα» θα έστελνε τον επισκέπτη να
 * πατά ξανά ακριβώς όταν το όριο του λέει να σταματήσει.
 *
 * ♿ Μετά την αποκάλυψη η εστίαση πηγαίνει στον **πρώτο σύνδεσμο** — ο χρήστης πληκτρολογίου/
 * αναγνώστη οθόνης πατά Enter και καλεί, χωρίς να ψάξει πού εμφανίστηκε ο αριθμός.
 */

import React from 'react';
import { Mail, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { splitTextIntoLinkSegments } from '@/lib/validation/text-link-segments';
import type { RevealedChannels, ShowcaseChannelKind } from '@/types/showcase-card';
import { AGENCY_PUBLIC_NS, PROFILE_KEYS } from './agency-directory-labels';

type RevealState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | { readonly phase: 'revealed'; readonly channels: RevealedChannels }
  | { readonly phase: 'throttled' }
  | { readonly phase: 'gone' }
  | { readonly phase: 'failed' };

/** Η διεύθυνση της πόρτας — `encodeURIComponent`, γιατί οι ταυτότητες ταξιδεύουν στη διαδρομή. */
export function channelRevealPath(companyId: string, locationId: string): string {
  return `/api/pro/${encodeURIComponent(companyId)}/locations/${encodeURIComponent(locationId)}/channels`;
}

/**
 * 🔑 Το `mailto:` το χτίζει **ο ΕΝΑΣ κατασκευαστής** του ADR-751 (`text-link-segments`), ποτέ
 * αυτό το αρχείο. `null` ⇒ ο ανιχνευτής δεν το αναγνωρίζει ως διεύθυνση: δείχνεται ως κείμενο,
 * όχι ως σύνδεσμος που θα άνοιγε κάτι άλλο από αυτό που γράφει.
 */
function emailHref(email: string): string | null {
  const segments = splitTextIntoLinkSegments(email, { kinds: ['email'] });
  const only = segments.length === 1 ? segments[0] : undefined;
  return only?.kind === 'email' ? only.href : null;
}

function useChannelReveal(companyId: string, locationId: string) {
  const [state, setState] = React.useState<RevealState>({ phase: 'idle' });

  const reveal = React.useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const response = await fetch(channelRevealPath(companyId, locationId), { cache: 'no-store' });
      if (response.status === 429) return setState({ phase: 'throttled' });
      if (response.status === 404) return setState({ phase: 'gone' });
      const body = (await response.json().catch(() => null)) as { channels?: RevealedChannels } | null;
      setState(response.ok && body?.channels ? { phase: 'revealed', channels: body.channels } : { phase: 'failed' });
    } catch {
      setState({ phase: 'failed' });
    }
  }, [companyId, locationId]);

  return { state, reveal };
}

function RevealedList({ channels }: { readonly channels: RevealedChannels }): React.ReactElement {
  const first = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => first.current?.focus(), []);
  const linkClass = 'inline-flex items-center gap-2 font-medium text-foreground underline underline-offset-4';

  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {channels.phones.map((phone, index) => (
        <li key={phone.href}>
          <a ref={index === 0 ? first : undefined} href={phone.href} className={linkClass}>
            <Phone aria-hidden="true" className="h-4 w-4" /> {phone.display}
          </a>
        </li>
      ))}
      {channels.emails.map((email, index) => {
        const href = emailHref(email);
        const content = (
          <>
            <Mail aria-hidden="true" className="h-4 w-4" /> {email}
          </>
        );
        return (
          <li key={email}>
            {href === null ? (
              <span className="inline-flex items-center gap-2 font-medium text-foreground">{content}</span>
            ) : (
              <a ref={channels.phones.length === 0 && index === 0 ? first : undefined} href={href} className={linkClass}>
                {content}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * ⚠️ **Τρεις ρητές κλήσεις `t()`, ΟΧΙ πίνακας που δείχνει στο `PROFILE_KEYS`**: ο τεμαχιστής του
 * ADR-744 (CHECK 3.34) λύνει **μία** ευρετηρίαση με κυριολεκτική τιμή — τιμή που είναι αναφορά σε
 * άλλη σταθερά είναι **δεύτερο** επίπεδο και μένει ανεπίλυτη.
 */
function FailureNote({ phase }: { readonly phase: 'throttled' | 'gone' | 'failed' }): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const text =
    phase === 'throttled'
      ? t(PROFILE_KEYS.cardRevealThrottled)
      : phase === 'gone'
        ? t(PROFILE_KEYS.cardRevealGone)
        : t(PROFILE_KEYS.cardRevealFailed);
  return <p className="m-0 text-sm text-muted-foreground">{text}</p>;
}

export function ChannelReveal({
  companyId,
  locationId,
  kinds,
}: {
  readonly companyId: string;
  readonly locationId: string;
  readonly kinds: readonly ShowcaseChannelKind[];
}): React.ReactElement | null {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { state, reveal } = useChannelReveal(companyId, locationId);
  if (kinds.length === 0) return null;
  if (state.phase === 'revealed') return <RevealedList channels={state.channels} />;

  const loading = state.phase === 'loading';
  return (
    <section className="flex flex-col gap-2" aria-live="polite">
      <span className="flex flex-wrap gap-2">
        {kinds.includes('phone') ? (
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void reveal()}>
            <Phone aria-hidden="true" /> {loading ? t(PROFILE_KEYS.cardRevealing) : t(PROFILE_KEYS.cardShowPhone)}
          </Button>
        ) : null}
        {kinds.includes('email') ? (
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void reveal()}>
            <Mail aria-hidden="true" /> {loading ? t(PROFILE_KEYS.cardRevealing) : t(PROFILE_KEYS.cardShowEmail)}
          </Button>
        ) : null}
      </span>
      {state.phase === 'throttled' || state.phase === 'gone' || state.phase === 'failed' ? (
        <FailureNote phase={state.phase} />
      ) : null}
    </section>
  );
}
