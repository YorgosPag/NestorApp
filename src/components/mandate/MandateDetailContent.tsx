'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΜΙΑΣ ΕΝΤΟΛΗΣ** — ο προορισμός της ειδοποίησης.
 * @related ADR-841 §7 Α18.12 · hooks/mandate/useMandateDetail.ts · MandateCatalogContent.tsx
 * @module components/mandate/MandateDetailContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: Η ΕΙΔΟΠΟΙΗΣΗ ΕΙΧΕ ΠΡΟΟΡΙΣΜΟ, ΑΛΛΑ ΟΧΙ ΤΟΝ ΔΙΚΟ ΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `mandate-decision-notifier` έστελνε τον **υπάλληλο του γραφείου** στο
 * `(me)/offers/<ownp>` — την καρτέλα του **ιδιώτη**. Και ο κατάλογος δεν ήταν η
 * απάντηση: κόβεται στις **500** γραμμές *(η ανακοινωμένη εντολή μπορεί να λείπει,
 * **σιωπηλά**)*, και ταξινομείται με **επείγον** — μια μόλις εγκεκριμένη εντολή γίνεται
 * `live`, **δέκατη και τελευταία** από τις δέκα καταστάσεις. Δες ADR-841 §7 Α18.12.β.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΓΡΑΜΜΗ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ — **ΕΙΝΑΙ Η ΙΔΙΑ ΚΑΡΤΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ό,τι δείχνει ο κατάλογος για μια εντολή *(κατάσταση, θεραπεία, γεγονότα, κουμπιά)* το
 * δείχνει **το ίδιο** component εδώ. Δεύτερη απόδοση θα ήταν δεύτερη αλήθεια: η καρτέλα
 * θα έλεγε άλλη κατάσταση από τη γραμμή της **ίδιας** εντολής δύο κλικ πιο πίσω.
 *
 * 🏆 **ΚΑΙ ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟ DOCUSIGN**: το «Envelope Details» του είναι **αρχείο
 * κατάστασης** — οι ενέργειες ζουν στη λίστα «Manage». Εδώ ο άνθρωπος που μόλις έμαθε
 * *«ο πελάτης ενέκρινε»* **πράττει επιτόπου**, γιατί ο κριτής των κουμπιών
 * (`allowedActionsFor`) είναι ο ίδιος και ταξιδεύει με την κάρτα.
 *
 * ⚠️ **ΚΑΝΕΝΑΣ ΝΕΟΣ ΦΡΟΥΡΟΣ ΕΠΙΦΑΝΕΙΑΣ ΕΔΩ**: το *«επιτρέπεται σε αυτό το γραφείο
 * μεσιτική δραστηριότητα;»* το κρίνει ο **διακομιστής** (`gateBrokerage` στο `GET`) και
 * απαντά **403**, που φτάνει εδώ ως `failed`. Ένα δεύτερο `useMyOrganizationCapabilities`
 * σαν του καταλόγου θα ήταν **δεύτερος κριτής** για επιφάνεια που έχει ήδη έναν —
 * και ο κατάλογος τον χρειάζεται γιατί ζωγραφίζει **κουμπί δημιουργίας**· εδώ δεν
 * υπάρχει τίποτα να προσφερθεί σε γραφείο χωρίς άδεια.
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { Link } from '@/lib/workspace/navigation';
import { MandateCatalogRow } from '@/components/mandate/catalog/MandateCatalogRow';
import {
  CATALOG_KEYS,
  CATALOG_NS,
  DETAIL_ABSENCE_KEYS,
  DETAIL_KEYS,
} from '@/components/mandate/catalog/mandate-catalog-labels';
import { Button } from '@/components/ui/button';
import { PrivateMarketingAgencySection } from '@/components/mandate/PrivateMarketingAgencySection';
import { useMandateDetail } from '@/hooks/mandate/useMandateDetail';
import { MANDATE_FOUND } from '@/lib/mandate/mandate-detail-outcome';
import { MANDATE_CATALOG_ROUTE } from '@/lib/mandate/mandate-routes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🧩 ADR-744 §15 — PER-ROUTE SLICE ΤΗΣ `/o/[workspace]/listings/mandates/[ownerPropertyId]`.
//
// 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΕΚΛΕΙΣΕ ΕΔΩ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΗΤΑΝ ΤΑΞΗ.** Μέχρι τις 2026-09-06 αυτή η
// διαδρομή **δεν είχε slice**, και το μετρημένο αποτέλεσμα ήταν ωμό κλειδί —
// `offer.mandates.detail.back` — μέσα στο HTML που **έστελνε ο διακομιστής** *(curl στη
// ζωντανή σελίδα, 2026-09-05)*. Ακριβώς η κλάση που απαγορεύει η **CHECK 3.51**.
//
// ⛔ **Η ΠΡΟΣΩΡΙΝΗ ΘΕΡΑΠΕΙΑ ΗΤΑΝ ΑΝΤΑΛΛΑΓΗ, ΟΧΙ ΛΥΣΗ, ΚΑΙ ΕΦΥΓΕ.** Η οθόνη απέδιδε
// **σκελετό χωρίς λέξεις** όσο φόρτωνε το namespace (`if (!isNamespaceReady) return …`).
// Έσβηνε το ωμό κλειδί, αλλά γεννούσε **flash πλοήγησης** — που το module
// `no-navigation-flash` απαγορεύει (**CHECK 3.7**), και σωστά: μια οθόνη που ξεκινά κενή
// είναι το ίδιο ψέμα με μια οθόνη που ξεκινά με κλειδί. Το ADR-744 §8 το λέει ονομαστικά:
// **μία κλάση ελαττώματος ανταλλαγμένη με άλλη δεν είναι πρόοδος.**
//
// ✅ Με το λεξιλόγιο **σύγχρονο στο πρώτο καρέ**, καμία από τις δύο ανταλλαγές δεν
// χρειάζεται — η οθόνη γράφει αληθινό κείμενο αμέσως, όπως οι **τρεις αδελφές** της.
//
// 🔴 **ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`**: εκείνο είναι Server Component, και τα Server/Client
// δέντρα έχουν **ΞΕΧΩΡΙΣΤΟΥΣ γράφους module** — εγγραφή από εκεί θα έγραφε σε **άλλο**
// στιγμιότυπο i18next: πράσινη κλήση που δεν κάνει τίποτα.
//
// ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE** — με `import()` το ωμό κλειδί απλώς
// μετακομίζει σε «ένα καρέ» και κρύβεται από το CHECK 3.51.
//
// ⚠️ **ΜΗΝ γράψεις το JSON στο χέρι**: το CHECK 3.34 υπογράφει κάθε artifact στο
// `manifest.artifacts` — ένα μισο-παραγμένο slice **μπλοκάρει**, και σωστά.
import routeSlice from '@/i18n/generated/routes/o__workspace__listings__mandates__ownerPropertyId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/**
 * 💬 ADR-867 Β7 — **ΟΡΙΟ ΚΛΕΙΣΤΟΤΗΤΑΣ** (CHECK 3.34 Κ2): η συνομιλία είναι νησίδα **μόνο για συνδεδεμένους**
 * (στον διακομιστή δεν υπάρχει χρήστης ⇒ δεν αποδίδει τίποτα), με δικό της namespace που φορτώνεται όταν
 * ανοίξει. Στατικά θα φούσκωνε το route slice κατά ~7 KB για κείμενα που το SSR δεν δείχνει ποτέ.
 * ⚠️ Όχι `ssr: false` — ίδιο ιδίωμα με το `PrivateMarketingAgencySection`.
 */
const NetworkThreadPanel = dynamic(() =>
  import('@/components/network-messaging/NetworkThreadPanel').then((mod) => mod.NetworkThreadPanel),
);

/**
 * **Ο δρόμος πίσω — και είναι ΥΠΟΧΡΕΩΤΙΚΟΣ, όχι ευγένεια.**
 *
 * 🔴 Ο άνθρωπος φτάνει εδώ από **ειδοποίηση** *(κλικ σε κάρτα του συρταριού, ή σύνδεσμο
 * σε email)*, δηλαδή συχνά σε **καινούργια καρτέλα χωρίς ιστορικό**. Ένα «πίσω» του
 * φυλλομετρητή δεν υπάρχει· χωρίς αυτόν τον σύνδεσμο η οθόνη είναι **αδιέξοδο**.
 * Το ίδιο μάθημα με το §8.33: *«πόρτα χωρίς διάδρομο»*.
 */
function BackToCatalog(): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);
  return (
    <nav>
      <Link href={MANDATE_CATALOG_ROUTE} className="text-sm underline">
        {t(DETAIL_KEYS.back)}
      </Link>
    </nav>
  );
}

/**
 * **Η ΕΝΤΟΛΗ ΔΕΝ ΕΙΝΑΙ ΕΔΩ** — και ο άνθρωπος μαθαίνει **ποια** από τις τρεις αιτίες.
 *
 * ⚠️ **Το κουμπί «δοκιμάστε ξανά» δίνεται ΜΟΝΟ στο `failed`**, και είναι απόφαση: μια
 * εντολή που **δεν υπάρχει** δεν θα εμφανιστεί επειδή ξαναρώτησες. Ένα καθολικό
 * «δοκιμάστε ξανά» θα υποσχόταν διέξοδο που δεν υπάρχει — το ακριβώς αντίθετο του
 * λόγου που ο κατάλογος **δίνει** κουμπί στην αποτυχία δικτύου.
 */
function AbsenceNotice({
  kind,
  onRetry,
}: {
  readonly kind: keyof typeof DETAIL_ABSENCE_KEYS;
  readonly onRetry: () => void;
}): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);
  const keys = DETAIL_ABSENCE_KEYS[kind];

  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-border bg-card p-4">
      <p className="m-0 font-medium text-foreground">{t(keys.title)}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(keys.hint)}</p>
      {kind === 'failed' ? (
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
          {t(CATALOG_KEYS.retry)}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * **Η εντολή πάνω σε αυτό το ακίνητο.**
 *
 * @param ownerPropertyId — από το δυναμικό τμήμα της διαδρομής. ⚠️ **Ωμό, χωρίς
 *   επικύρωση σχήματος εδώ**: ο διακομιστής είναι ο μόνος που ξέρει αν υπάρχει, και μια
 *   δεύτερη κρίση *«μοιάζει με `ownp_`;»* στον πελάτη θα ήταν δεύτερος κριτής που
 *   αποκλίνει την ημέρα που αλλάξει το πρόθεμα.
 */
export function MandateDetailContent({
  ownerPropertyId,
}: {
  readonly ownerPropertyId: string;
}): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);
  const { view, reload, act, setPresence } = useMandateDetail(ownerPropertyId);


  // 🔴 **`section`, ΟΧΙ `main`** — το κέλυφος του `(app)` αποδίδει **ήδη** `<main>`
  //    (`MainContentBridge`), και δύο ορόσημα «κύριο περιεχόμενο» στην ίδια σελίδα
  //    σημαίνουν «ποιο από τα δύο;» για αναγνώστη οθόνης.
  // ⚠️ **`w-full` και κανένα `p-*`** — ίδιο ιδίωμα με τον κατάλογο: το κενό ανήκει στο
  //    κέλυφος (ADR-797, CHECK 3.63), και μια σελίδα με δικό της `p-6` έβγαζε μετρημένα
  //    **56px** διπλό περιθώριο.
  return (
    <section className="flex w-full flex-col gap-6">
      <BackToCatalog />

      {view.state === 'loading' ? (
        <p className="text-muted-foreground">{t(CATALOG_KEYS.loading)}</p>
      ) : view.loaded.kind === MANDATE_FOUND ? (
        <MandateCatalogRow
          row={view.loaded.row}
          busy={view.busyId === view.loaded.row.ownerPropertyId}
          // ⚠️ **Το `feedback` φιλτράρεται κατά ταυτότητα, ακόμη κι εδώ που είναι μία.**
          //    Δεν είναι περιττό: ο ίδιος έλεγχος ζει στον κατάλογο, και ένας κλάδος που
          //    «ξέρει» ότι υπάρχει μόνο μία γραμμή θα ήταν **δεύτερος κανόνας** που
          //    αποκλίνει την ημέρα που η οθόνη δείξει και τη δεύτερη εντολή του ακινήτου.
          feedback={
            view.feedback !== null &&
            view.feedback.ownerPropertyId === view.loaded.row.ownerPropertyId
              ? view.feedback
              : null
          }
          onAct={act}
          onSetPresence={setPresence}
          // 🔑 Ο τίτλος της αγγελίας **ΕΙΝΑΙ** η ταυτότητα αυτής της σελίδας — δες
          //    {@link MandateCatalogRowProps.titleAs}.
          titleAs="h1"
        />
      ) : (
        <AbsenceNotice kind={view.loaded.kind} onRetry={reload} />
      )}

      {/*
        🔑 ADR-864 §18 — **κάτω** από την κάρτα, όχι μέσα της: η κάρτα είναι **κοινή** με τον κατάλογο (μία
        απόδοση ανά εντολή), η συναίνεση κλειστής διάθεσης είναι πράξη **αυτής** της σελίδας.
      */}
      {view.state === 'settled' && view.loaded.kind === MANDATE_FOUND && (
        <PrivateMarketingAgencySection ownerPropertyId={ownerPropertyId} />
      )}

      {/*
        💬 ADR-867 Β7 — **η συνομιλία με τον ιδιοκτήτη, κάτω από την εντολή** (Follow Up Boss: «Messages»
        στο προφίλ · Procore: απαντήσεις στη σελίδα του αντικειμένου). Τα id έρχονται από τη διαδρομή,
        με το γραφείο που **έκρινε ο φρουρός** — ποτέ μαντεψιά στον πελάτη.
      */}
      {view.state === 'settled' && view.loaded.kind === MANDATE_FOUND && (
        <NetworkThreadPanel threadId={view.loaded.network.threadId} teamId={view.loaded.network.teamId} variant="office" />
      )}
    </section>
  );
}
