'use client';

/**
 * @fileoverview **ΓΙΑ ΠΟΙΟ ΠΡΑΓΜΑ ΜΙΛΑΜΕ** — η κάρτα συμφραζομένων της συνομιλίας (ADR-867 Β9γ).
 * @related services/network-messaging/thread-context.ts · ADR-848 (ποτέ «Άνοιγμα» προς το πουθενά)
 * @module components/network-messaging/ThreadContextCard
 *
 * 🌐 **ΤΟ ΠΡΟΤΥΠΟ** (έρευνα 2026-09-21): **Zillow Premier Agent** — το ακίνητο είναι σύνδεσμος
 * **μέσα** στη συνομιλία, ώστε ο μεσίτης να έχει «the right context»· **HubSpot/Intercom** — τρίτη
 * στήλη με το **συνδεδεμένο έγγραφο**. Η συνομιλία απέκτησε δική της διεύθυνση, άρα ο άνθρωπος
 * φτάνει εδώ χωρίς να έχει δει τη σελίδα της πράξης· χωρίς αυτή την κάρτα θα διάβαζε μηνύματα
 * για «κάτι».
 *
 * 🏆 **ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ**: οι HubSpot/Intercom δίνουν **πάντα** σύνδεσμο — δεν έχουν το
 * πρόβλημά μας (ένα έγγραφο, ένας μισθωτής). Εδώ η **ίδια** αγγελία έχει δύο πλευρές σε δύο χώρους,
 * και για αγγελία **ιδιώτη** η σελίδα της πράξης **δεν ανοίγει από το γραφείο**. Άρα: **όνομα
 * πάντα, σύνδεσμος μόνο όταν ανοίγει** — αλλιώς το λέμε με λέξεις. Ακριβώς αυτή η υπόσχεση
 * (σύνδεσμος που απαντούσε «δεν βρέθηκε») ήταν το ελάττωμα που γέννησε το Β9γ.
 *
 * ⚠️ **Καμία γεωμετρία διαδρόμου** (CHECK 3.63): η κάρτα δεν ξέρει πού ζει.
 */

import * as React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';

import { CONTEXT_KEYS, NETWORK_NS } from './network-messaging-keys';

export interface ThreadContextCardProps {
  /** `null` ⇒ δεν ξέρουμε τι είναι (νήμα σχέσης, ή αγγελία που δεν διαβάστηκε) ⇒ **καμία κάρτα**. */
  readonly title: string | null;
  /** `null` ⇒ ξέρουμε, αλλά **δεν ανοίγει από τον χώρο σου**. */
  readonly href: string | null;
}

export function ThreadContextCard({ title, href }: ThreadContextCardProps): React.ReactElement | null {
  const { t } = useTranslation([NETWORK_NS]);

  // ⚠️ **Καμία κάρτα «άγνωστο αντικείμενο»**: μια κάρτα που λέει «δεν ξέρω» είναι θόρυβος, όχι
  //    ειλικρίνεια. Η σιωπή εδώ είναι η σωστή απάντηση (νήμα σχέσης — Β8 — δεν έχει αντικείμενο).
  if (title === null) return null;

  return (
    <section
      aria-label={t(CONTEXT_KEYS.label)}
      className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-4 py-3"
    >
      <p className="m-0 text-xs uppercase tracking-wide text-muted-foreground">{t(CONTEXT_KEYS.label)}</p>
      <p className="m-0 text-sm font-medium text-foreground">{title === '' ? t(CONTEXT_KEYS.untitled) : title}</p>
      {href === null ? (
        <p className="m-0 text-xs text-muted-foreground">{t(CONTEXT_KEYS.noAccess)}</p>
      ) : (
        <Link href={href} className="text-xs font-medium text-foreground underline underline-offset-4">
          {t(CONTEXT_KEYS.open)}
        </Link>
      )}
    </section>
  );
}
