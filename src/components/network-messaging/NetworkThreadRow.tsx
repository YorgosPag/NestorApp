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
 * ⚠️ **Γραμμή χωρίς προορισμό ΔΕΝ είναι σύνδεσμος** (`href === null`, νήμα σχέσης — Β8). Ένα
 * «Άνοιγμα» προς το πουθενά θα ήταν ψέμα (ADR-848), και ένας `<a>` χωρίς `href` δεν εστιάζεται
 * ούτε ανακοινώνεται — άρα η γραμμή μένει **κείμενο**, ειλικρινά.
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
}

/** Ο κορμός — ίδιος είτε η γραμμή είναι σύνδεσμος είτε όχι, ώστε να μην αποκλίνουν δύο όψεις. */
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

export function NetworkThreadRow({ item }: NetworkThreadRowProps): React.ReactElement {
  return (
    <li className="list-none">
      {item.href === null ? (
        <span className={SHAPE}>
          <RowBody item={item} />
        </span>
      ) : (
        <Link href={item.href} className={`${SHAPE} transition-colors hover:bg-muted`}>
          <RowBody item={item} />
        </Link>
      )}
    </li>
  );
}
