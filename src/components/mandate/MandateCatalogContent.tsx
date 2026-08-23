'use client';

/**
 * @fileoverview **Ο ΚΑΤΑΛΟΓΟΣ ΕΝΤΟΛΩΝ** — η άλλη μισή πόρτα του §8.33.
 * @related ADR-777 §8.34 · hooks/mandate/useMandateCatalog.ts · lib/mandate/mandate-standing.ts
 * @module components/mandate/MandateCatalogContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΠΡΟΪΟΝ, ΟΧΙ Η ΛΙΣΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το γραφείο δεν ρωτά *«τι έχω;»* — ρωτά *«τι πρέπει να κάνω τώρα;»*. Άρα οι ομάδες
 * μπαίνουν με **σειρά επείγοντος** και όχι αλφαβητικά ή χρονολογικά, και η πρώτη είναι
 * πάντα *«περιμένουν εσάς»*: οι εντολές όπου ο πελάτης **δεν μπορεί** να προχωρήσει
 * μέχρι να κουνηθεί κάποιος εδώ.
 *
 * 🏆 Το DocuSign έχει τους ίδιους κάδους (*Action Required · Waiting for Others ·
 * Expiring Soon · Completed*) και **δεν μπορεί** να έχει τον πρώτο μας: φάκελος χωρίς
 * διεύθυνση παραλήπτη δεν γεννιέται. Το MLS δεν έχει κανέναν, γιατί δεν παρακολουθεί
 * καθόλου την έγκριση του ιδιοκτήτη.
 *
 * ⚠️ **Οι άδειες ομάδες ΔΕΝ ζωγραφίζονται.** Πέντε επικεφαλίδες με μηδενικά είναι
 * θόρυβος σε οθόνη τριάζ — ενώ η **λογιστική** των μηδενικών ζει στο `tally` του
 * διακομιστή, όπου έχει νόημα.
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { MandateCatalogRow } from '@/components/mandate/catalog/MandateCatalogRow';
import {
  CATALOG_KEYS,
  CATALOG_NS,
  GROUP_LABEL_KEYS,
} from '@/components/mandate/catalog/mandate-catalog-labels';
import { Button } from '@/components/ui/button';
import { useMandateCatalog, type MandateCatalogState } from '@/hooks/mandate/useMandateCatalog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  MANDATE_STANDING_GROUPS,
  type MandateStandingGroup,
} from '@/lib/mandate/mandate-standing';
import { NEW_BROKERED_LISTING_ROUTE } from '@/lib/mandate/mandate-routes';
import type { MandateCatalogRow as CatalogRow } from '@/services/mandate/mandate-catalog.service';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/o/[workspace]/listings/mandates` (ADR-777 §8.39).
//
// Το `property-market` έπαψε να ταξιδεύει ΟΛΟΚΛΗΡΟ σε 141 διαδρομές (§8.38). Χωρίς
// αυτή τη γραμμή, αυτή η οθόνη θα έβαφε **ωμά κλειδιά στο πρώτο καρέ** — η μία κλάση
// ελαττώματος ανταλλαγμένη με άλλη, που το ADR-744 §8 απαγορεύει ρητά.
//
// 🔴 **ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`**: εκείνο είναι Server Component, και τα Server/Client
// δέντρα έχουν **ΞΕΧΩΡΙΣΤΟΥΣ γράφους module** — εγγραφή από εκεί θα έγραφε σε **άλλο**
// στιγμιότυπο i18next: πράσινη κλήση που δεν κάνει τίποτα.
//
// ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE** — με `import()` το ωμό κλειδί απλώς
// μετακομίζει σε «ένα καρέ» και κρύβεται από το CHECK 3.51.
import routeSlice from '@/i18n/generated/routes/o__workspace__listings__mandates.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/** Η κενή κατάσταση — **εξηγεί τι θα δει εδώ**, όχι μόνο ότι είναι άδειο. */
function EmptyState(): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="m-0 font-medium text-foreground">{t(CATALOG_KEYS.empty)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t(CATALOG_KEYS.emptyHint)}</p>
    </div>
  );
}

/**
 * ⚠️ **Οι τύποι της γραμμής διαβάζονται ΑΠΟ τη γραμμή** (`React.ComponentProps`), όχι
 * ξαναγραμμένοι εδώ: μια αλλαγή στην υπογραφή του `MandateCatalogRow` πρέπει να
 * **σπάει** αυτό το αρχείο, όχι να το αφήνει να περνά ένα σχεδόν-σωστό αντικείμενο.
 */
type RowFeedback = React.ComponentProps<typeof MandateCatalogRow>['feedback'];
type RowAct = React.ComponentProps<typeof MandateCatalogRow>['onAct'];
type RowPresence = React.ComponentProps<typeof MandateCatalogRow>['onSetPresence'];

interface GroupSectionProps {
  readonly group: MandateStandingGroup;
  readonly rows: readonly CatalogRow[];
  readonly busyId: string | null;
  readonly feedbackFor: (ownerPropertyId: string) => RowFeedback;
  readonly onAct: RowAct;
  readonly onSetPresence: RowPresence;
}

function GroupSection({
  group,
  rows,
  busyId,
  feedbackFor,
  onAct,
  onSetPresence,
}: GroupSectionProps): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-lg font-semibold text-foreground">
        {t(GROUP_LABEL_KEYS[group])}{' '}
        <span className="text-sm font-normal text-muted-foreground">
          {t(CATALOG_KEYS.groupCount, { count: rows.length })}
        </span>
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => (
          <li key={row.ownerPropertyId}>
            <MandateCatalogRow
              row={row}
              busy={busyId === row.ownerPropertyId}
              feedback={feedbackFor(row.ownerPropertyId)}
              onAct={onAct}
              onSetPresence={onSetPresence}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Το σώμα: **τρεις** καταστάσεις φόρτωσης, ρητά και χωρίς `default`.
 *
 * ⚠️ Η αποτυχία δίνει **κουμπί**, όχι μόνο μήνυμα: ένας κατάλογος που λέει «δοκιμάστε
 * ξανά» και δεν προσφέρει τρόπο να δοκιμάσεις είναι οδηγία, όχι διέξοδος.
 */
function CatalogBody({
  view,
  reload,
  act,
  setPresence,
}: {
  readonly view: MandateCatalogState;
  readonly reload: () => void;
  readonly act: RowAct;
  readonly setPresence: RowPresence;
}): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);

  if (view.state === 'loading') {
    return <p className="text-muted-foreground">{t(CATALOG_KEYS.loading)}</p>;
  }

  if (view.state === 'failed') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="m-0 text-foreground">{t(CATALOG_KEYS.error)}</p>
        <Button type="button" size="sm" variant="secondary" onClick={reload}>
          {t(CATALOG_KEYS.retry)}
        </Button>
      </div>
    );
  }

  const { catalog, busyId, feedback } = view;
  if (catalog.rows.length === 0) return <EmptyState />;

  const feedbackFor = (ownerPropertyId: string): RowFeedback =>
    feedback !== null && feedback.ownerPropertyId === ownerPropertyId ? feedback : null;

  return (
    <>
      {catalog.truncated ? (
        <p className="m-0 text-sm text-muted-foreground">
          {t(CATALOG_KEYS.truncated, { count: catalog.rows.length })}
        </p>
      ) : null}

      {MANDATE_STANDING_GROUPS.map((group) => {
        const rows = catalog.rows.filter((row) => row.group === group);
        if (rows.length === 0) return null;
        return (
          <GroupSection
            key={group}
            group={group}
            rows={rows}
            busyId={busyId}
            feedbackFor={feedbackFor}
            onAct={act}
            onSetPresence={setPresence}
          />
        );
      })}
    </>
  );
}

export function MandateCatalogContent(): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);
  const { view, reload, act, setPresence } = useMandateCatalog();

  return (
    // 🔴 **`section`, ΟΧΙ `main` — και `w-full`, ΟΧΙ κεντραρισμένη στήλη.** Και τα δύο
    // ήταν λάθος στην πρώτη γραφή, και τα δύο τα οδήγησε το **στιγμιότυπο**:
    //
    // 1. Το κέλυφος του `(app)` αποδίδει **ήδη** `<main className="flex-1
    //    overflow-y-auto … w-full max-w-full">` (`MainContentBridge`). Ένα δεύτερο
    //    `<main>` μέσα του είναι **άκυρο HTML** και δύο ορόσημα «κύριο περιεχόμενο»
    //    στην ίδια σελίδα — που για αναγνώστη οθόνης σημαίνει «ποιο από τα δύο;».
    // 2. Το `mx-auto max-w-3xl` είναι το ιδίωμα του **`(me)`**, του **ιδιώτη**:
    //    στενή, εστιασμένη στήλη. Οι σελίδες του `(app)` είναι **`w-full`**
    //    (μετρημένο: `ContactsPageContent` · `BuildingsPageContent`). Ο κατάλογος
    //    τριάζ σαρώνεται καθημερινά σε οθόνη γραφείου· μια στήλη 896px στη μέση των
    //    1920 πετάει ακριβώς τον χώρο που χρειάζεται.
    //
    // ⚠️ **ΔΕΝ χρησιμοποιείται το `PageContainer`**, και είναι μετρημένη απόφαση: είναι
    // `h-full overflow-hidden` — φτιαγμένο για σελίδες που κυλούν **εσωτερικά**
    // (εικονικοποιημένες λίστες). Εδώ η κύλιση ανήκει στο κέλυφος· ένα δεύτερο δοχείο
    // κύλισης θα έδινε **δύο μπάρες** και θα **έκοβε** τη λίστα όταν οι γραμμές
    // ξεπερνούσαν το ύψος — βλάβη που ένας **άδειος** κατάλογος δεν θα έδειχνε ποτέ.
    // 3. 🔴 **ΤΟ `p-6` ΕΦΥΓΕ (ADR-797).** Μετρήθηκε ζωντανά: με το κέλυφος να δίνει
    //    πλέον ρευστό διάδρομο, αυτή η σελίδα έβγαζε **32px + 24px = 56px** — διπλό
    //    κενό, ορατό στην οθόνη. Το κενό **δεν ανήκει στη σελίδα**: *«outer spacing
    //    is a **layout** concern, not a component one»*. Μια σελίδα που κρατά δικό
    //    της `p-*` είναι **δεύτερη αυθεντία** που αποκλίνει σιωπηλά μόλις αλλάξει η
    //    κλίμακα — και το φυλά πλέον το CHECK 3.63.
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-semibold text-foreground">
          {t(CATALOG_KEYS.title)}
        </h1>
        <p className="m-0 text-sm text-muted-foreground">{t(CATALOG_KEYS.lead)}</p>
      </header>

      {/*
        🔴 **Η ΠΟΡΤΑ ΚΑΤΑΧΩΡΗΣΗΣ ΑΠΟΚΤΑ ΕΠΙΤΕΛΟΥΣ ΣΥΝΔΕΣΜΟ.** Μετρήθηκε στις 2026-08-21:
        το `/listings/mandates/new` υπήρχε από το §8.33 και **καμία γραμμή του δέντρου
        δεν έδειχνε σε αυτό** — το έβρισκες μόνο πληκτρολογώντας τη διεύθυνση. Πόρτα
        χωρίς διάδρομο είναι το ίδιο σχήμα με τον μηχανισμό που «ήταν χτισμένος και δεν
        τον καλούσε κανείς».
      */}
      <nav>
        <Link
          href={NEW_BROKERED_LISTING_ROUTE}
          className="inline-block rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
        >
          {t(CATALOG_KEYS.create)}
        </Link>
      </nav>

      <CatalogBody view={view} reload={reload} act={act} setPresence={setPresence} />
    </section>
  );
}
