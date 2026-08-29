'use client';

/**
 * @fileoverview **ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ ΑΙΤΗΜΑΤΑ** — η οθόνη του Σ2 (ADR-827 §9.21).
 * @related hooks/mandate/useMandateInbox.ts · services/mandate/mandate-inbox.service.ts
 * @module components/mandate/MandateInboxContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΕΝ ΕΙΝΑΙ Ο ΚΑΤΑΛΟΓΟΣ ΕΝΤΟΛΩΝ, ΚΑΙ Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ Η **ΚΑΤΕΥΘΥΝΣΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | | `/listings/mandates` | **εδώ** |
 * |---|---|---|
 * | τι δείχνει | εντολές που **έχει ήδη** το γραφείο | αιτήματα που **δεν έχει κρίνει** |
 * | ποιος αποφασίζει | ο **ιδιώτης** *(εγκρίνει τη συγκατάθεση)* | το **γραφείο** |
 * | πηγή | `owner_properties` κατά `authorCompanyId` | `mandate_requests` κατά `agencyCompanyId` |
 *
 * ⛔ **ΜΗΝ ΤΑ ΕΝΩΣΕΙΣ.** Είναι δύο **αντίθετες** ροές έγκρισης σε μία επιφάνεια: ο
 * μεσίτης δεν θα ήξερε ποιος περιμένει ποιον. Ο κατάλογος συνδέεται από εδώ με
 * **σύνδεσμο**, που είναι όλη η σχέση που χρειάζονται.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΠΡΟΪΟΝ, ΟΧΙ Η ΛΙΣΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το γραφείο δεν ρωτά *«τι έχω;»* — ρωτά *«τι πρέπει να κάνω τώρα;»*. Οι ομάδες
 * μπαίνουν με **σειρά επείγοντος** και η πρώτη είναι πάντα *«περιμένουν εσάς»*.
 *
 * ⚠️ **Οι άδειες ομάδες ΔΕΝ ζωγραφίζονται.** Τρεις επικεφαλίδες με μηδενικά είναι
 * θόρυβος σε οθόνη τριάζ — ενώ οι **μετρήσεις** (αδιάβαστα, κρυμμένα, κομμένα) ζουν
 * στην κεφαλίδα, όπου έχουν νόημα.
 */

import React from 'react';

import { Link } from '@/lib/workspace/navigation';
import { Button } from '@/components/ui/button';
import { MandateInboxRow } from '@/components/mandate/inbox/MandateInboxRow';
import {
  GROUP_HINT_KEYS,
  GROUP_LABEL_KEYS,
  INBOX_GROUPS,
  INBOX_KEYS,
  INBOX_NS,
  type MandateInboxGroup,
} from '@/components/mandate/inbox/mandate-inbox-labels';
import { useMandateInbox, type MandateInboxState } from '@/hooks/mandate/useMandateInbox';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MANDATE_CATALOG_ROUTE } from '@/lib/mandate/mandate-routes';

// 🧩 ADR-744 §15 — PER-ROUTE SLICE ΤΗΣ `/o/[workspace]/listings/mandates/requests`.
//
// Το `property-market` δεν ταξιδεύει ΟΛΟΚΛΗΡΟ πια. Χωρίς αυτή τη γραμμή, η οθόνη θα
// έβαφε **ωμά κλειδιά στο πρώτο καρέ** — η μία κλάση ελαττώματος ανταλλαγμένη με άλλη,
// που το ADR-744 §8 απαγορεύει ρητά.
//
// 🔴 **ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`**: εκείνο είναι Server Component, και τα
// Server/Client δέντρα έχουν **ΞΕΧΩΡΙΣΤΟΥΣ γράφους module** — εγγραφή από εκεί θα
// έγραφε σε **άλλο** στιγμιότυπο i18next: πράσινη κλήση που δεν κάνει τίποτα.
//
// ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE** — με `import()` το ωμό κλειδί απλώς
// μετακομίζει σε «ένα καρέ» και κρύβεται από το CHECK 3.51.
import routeSlice from '@/i18n/generated/routes/o__workspace__listings__mandates__requests.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/** Η κενή κατάσταση — **εξηγεί τι θα δει εδώ**, όχι μόνο ότι είναι άδειο. */
function EmptyState(): React.ReactElement {
  const { t } = useTranslation([INBOX_NS]);
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="m-0 font-medium text-foreground">{t(INBOX_KEYS.empty)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t(INBOX_KEYS.emptyHint)}</p>
    </div>
  );
}

type ReadyView = Extract<MandateInboxState, { state: 'ready' }>;

interface GroupSectionProps {
  readonly group: MandateInboxGroup;
  readonly view: ReadyView;
  readonly api: ReturnType<typeof useMandateInbox>;
}

function GroupSection({ group, view, api }: GroupSectionProps): React.ReactElement | null {
  const { t } = useTranslation([INBOX_NS]);
  const rows = view.inbox.groups[group];
  if (rows.length === 0) return null;

  return (
    <section>
      <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t(GROUP_LABEL_KEYS[group])} ({rows.length})
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t(GROUP_HINT_KEYS[group])}</p>
      <ul className="mt-3 grid list-none gap-3 p-0">
        {rows.map((row) => (
          <MandateInboxRow
            key={row.id}
            row={row}
            // 🔑 **Ο διακομιστής αποφασίζει ποια γραμμή είναι κρίσιμη**, όχι η οθόνη:
            //    το `actionable` είναι ήδη η απάντηση στο *«μπορεί να κριθεί;»*. Ένα
            //    χειρόγραφο `row.status === 'pending'` εδώ θα ήταν **δεύτερος κριτής**
            //    που αγνοεί το ρολόι, και θα πρόσφερε κουμπί σε ληγμένη πρόταση.
            decidable={group === 'actionable'}
            busy={view.busyId === row.id}
            opened={view.opened?.id === row.id}
            feedback={view.feedback}
            onOpen={api.open}
            onClose={api.close}
            onDecide={api.decide}
          />
        ))}
      </ul>
    </section>
  );
}

/** Οι μετρήσεις που **δεν** είναι γραμμές: αδιάβαστα, κρυμμένα, κομμένα. */
function Tallies({ view }: { readonly view: ReadyView }): React.ReactElement | null {
  const { t } = useTranslation([INBOX_NS]);
  const { unseen, withoutListing, truncated } = view.inbox;
  if (unseen === 0 && withoutListing === 0 && !truncated) return null;

  return (
    <ul className="mt-2 grid list-none gap-1 p-0 text-sm text-muted-foreground">
      {unseen > 0 && <li>{t(INBOX_KEYS.unseen, { count: unseen })}</li>}
      {/* 🔴 **Η σιωπηλή εξαφάνιση είναι το σχήμα «0 = κανείς δεν κοίταξε».** Ο μεσίτης
          που θυμάται 5 αιτήματα και βλέπει 4 πρέπει να μάθει **γιατί**. */}
      {withoutListing > 0 && (
        <li>{t(INBOX_KEYS.withoutListing, { count: withoutListing })}</li>
      )}
      {truncated && <li>{t(INBOX_KEYS.truncated)}</li>}
    </ul>
  );
}

export function MandateInboxContent(): React.ReactElement {
  const { t } = useTranslation([INBOX_NS]);
  const api = useMandateInbox();
  const { view } = api;

  if (view.state === 'loading') {
    return (
      <section className="flex w-full flex-col gap-6">
        <p className="m-0 text-sm text-muted-foreground">{t(INBOX_KEYS.loading)}</p>
      </section>
    );
  }

  if (view.state === 'failed') {
    return (
      <section className="flex w-full flex-col gap-2">
        {/* ⚠️ **«Δεν φορτώθηκαν» ≠ «δεν υπάρχουν»** (N.12): η βλάβη έχει δικό της
            μήνυμα και δικό της κουμπί, ποτέ την κενή κατάσταση. */}
        <p className="m-0 text-sm text-foreground">{t(INBOX_KEYS.failed)}</p>
        <Button size="sm" variant="outline" className="self-start" onClick={api.reload}>
          {t(INBOX_KEYS.retry)}
        </Button>
      </section>
    );
  }

  const total =
    view.inbox.groups.actionable.length +
    view.inbox.groups.lapsed.length +
    view.inbox.groups.decided.length;

  return (
    // 🔴 **ΚΑΝΕΝΑ `p-*` ΚΑΙ ΚΑΝΕΝΑ `max-w-*` ΕΔΩ** (ADR-797, CHECK 3.63). Το κενό και το
    //    πλάτος ανήκουν στο **κέλυφος**: *«page padding is a **layout** concern, not a
    //    component one»*. Μια σελίδα που κρατά δικό της `p-4` είναι **δεύτερη αυθεντία**
    //    που αποκλίνει σιωπηλά μόλις αλλάξει η κλίμακα — και το έπιασε η πύλη, όχι η
    //    ανάγνωση: η πρώτη γραφή αυτού του αρχείου είχε `<main className="p-4">`.
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{t(INBOX_KEYS.title)}</h1>
        <p className="m-0 text-sm text-muted-foreground">{t(INBOX_KEYS.lead)}</p>
        <Tallies view={view} />
        <Link href={MANDATE_CATALOG_ROUTE} className="inline-block text-sm text-muted-foreground">
          {t(INBOX_KEYS.backToCatalog)}
        </Link>
      </header>

      {total === 0 ? (
        <EmptyState />
      ) : (
        INBOX_GROUPS.map((group) => (
          <GroupSection key={group} group={group} view={view} api={api} />
        ))
      )}
    </section>
  );
}
