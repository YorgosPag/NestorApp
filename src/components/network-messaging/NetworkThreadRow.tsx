'use client';

/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ «ΤΑ ΜΗΝΥΜΑΤΑ ΜΟΥ»** (ADR-867 Β9β).
 * @related `hooks/network-messaging/useNetworkThreadDirectory` · `network-messaging-keys.ts`
 * @module components/network-messaging/NetworkThreadRow
 *
 * 🏆 **ΤΟ ΣΗΜΑ ΤΗΣ ΙΔΙΟΤΗΤΑΣ — ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ.** Το Zillow χωρίζει «ιδιώτης» και
 * «επαγγελματίας» σε **δύο εφαρμογές**, το Slack σε **δύο workspaces** — και τα δύο αναγκάζουν τον
 * άνθρωπο να θυμάται **πού** ήταν η κουβέντα. Εδώ η λίστα είναι **μία**, και κάθε γραμμή λέει με
 * **ποια ιδιότητα** συμμετέχεις: ρόλος, και — όταν υπάρχει — η **δεύτερη** ιδιότητα
 * (`alsoHostRole`). Το σενάριο του ιδιοκτήτη που είναι **και** υπεύθυνος του γραφείου δεν μπορεί
 * καν να διατυπωθεί σε δύο χωριστές εφαρμογές.
 *
 * 🔑 **ΚΑΘΕ ΓΡΑΜΜΗ ΕΙΝΑΙ ΣΥΝΔΕΣΜΟΣ** (Β9γ). Εδώ υπήρχε κλάδος «`href === null` ⇒ κείμενο, όχι
 * σύνδεσμος» για το νήμα σχέσης που «δεν είχε οθόνη». Τώρα **κάθε** νήμα έχει διεύθυνση, οπότε ο
 * κλάδος έφυγε μαζί με το `| null` του τύπου: κλάδος που δεν εκτελείται ποτέ δεν είναι
 * προνοητικότητα, είναι νεκρός κώδικας (CHECK 3.22).
 * ⚠️ Η **τρέχουσα** γραμμή δηλώνεται με `aria-current="page"` — στο πλαϊνό φύλλο της οθόνης
 * συνομιλίας κάποιος που δεν βλέπει το χρώμα πρέπει να ξέρει ποια είναι ανοιχτή.
 */

import * as React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import { Link } from '@/lib/workspace/navigation';
import type { NetworkThreadListItem } from '@/types/network-wire';

import {
  ALSO_HOST_KEYS,
  DIRECTORY_KEYS,
  DIRECTORY_TITLE_KEYS,
  NETWORK_NS,
  ROLE_KEYS,
} from './network-messaging-keys';

const MOMENT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

export interface NetworkThreadRowProps {
  readonly item: NetworkThreadListItem;
  /** Η γραμμή που είναι **ανοιχτή τώρα** — μόνο στο πλαϊνό φύλλο της συνομιλίας. */
  readonly current?: boolean;
}

/** Ο κορμός της γραμμής — τίτλος, ιδιότητα, στιγμή. */
function RowBody({ item }: NetworkThreadRowProps): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const moment = item.lastMessageAt ?? item.activityAt;

  return (
    <>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{t(DIRECTORY_TITLE_KEYS[item.side])}</span>
          {item.unread && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-semibold text-primary-foreground">
              {t(DIRECTORY_KEYS.unread)}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>{t(ROLE_KEYS[item.role])}</span>
          {item.alsoHostRole !== null && <span>· {t(ALSO_HOST_KEYS[item.alsoHostRole])}</span>}
          {item.muted && <span>· {t(DIRECTORY_KEYS.muted)}</span>}
        </span>
      </span>
      <time dateTime={moment} className="shrink-0 text-xs text-muted-foreground">
        {formatDate(moment, MOMENT)}
      </time>
    </>
  );
}

const SHAPE = 'flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3';

export function NetworkThreadRow({ item, current = false }: NetworkThreadRowProps): React.ReactElement {
  return (
    <li className="list-none">
      <Link
        href={item.href}
        aria-current={current ? 'page' : undefined}
        className={`${SHAPE} transition-colors hover:bg-muted ${current ? 'border-primary bg-muted' : ''}`}
      >
        <RowBody item={item} />
      </Link>
    </li>
  );
}
