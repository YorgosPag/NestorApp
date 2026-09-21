'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ «ΤΑ ΜΗΝΥΜΑΤΑ ΜΟΥ»** — ο κατάλογος των νημάτων ενός ανθρώπου (ADR-867 Β9β).
 * @related `NetworkThreadDirectoryBody` (ο κορμός, κοινός με την οθόνη συνομιλίας) ·
 *          `app/(me)/messages/page.tsx` · `services/firestore/tenant-config.ts` (`cross-space-thread`)
 * @module components/network-messaging/NetworkThreadDirectoryContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΖΕΙ ΣΤΟΝ **ΙΔΙΩΤΙΚΟ** ΧΩΡΟ ΚΑΙ ΟΧΙ ΣΤΟ ΓΡΑΦΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το νήμα είναι δηλωμένο **δια-χωρικό**: *«ανήκει σε ΔΥΟ πλευρές διαφορετικών χώρων, και το νήμα
 * σχέσης σε πρόσωπο ΧΩΡΙΣ χώρο»* (`tenant-config.ts`, `unscopedCategory: 'cross-space-thread'`).
 * Η εμβέλειά του είναι ο **άνθρωπος** — το `listNetworkThreads` φιλτράρει **μόνο** `uid`.
 *
 * ⇒ Μια σελίδα κάτω από `/o/<χώρος>/` θα **υποσχόταν** εμβέλεια γραφείου που η μηχανή **δεν έχει**,
 * και θα έδειχνε τα **ιδιωτικά** νήματα του ανθρώπου μέσα στον εταιρικό χώρο. Ίδιο επιχείρημα με
 * τη δήλωση `dossiers` του `workspace-scope.ts`, με ένα παραπάνω: εκεί ο κάτοχος είναι `userId`,
 * εδώ **δεν υπάρχει καν** κάτοχος-χώρος.
 *
 * 🔑 **Κάθε γραμμή οδηγεί στη ΣΥΝΟΜΙΛΙΑ** (Β9γ): το `href` το δίνει ο διακομιστής, και είναι το ίδιο
 * σημείο όπου οδηγεί και η **ειδοποίηση**. Μέχρι το Β9β η γραμμή του γραφείου οδηγούσε στη σελίδα
 * της εντολής — που για αγγελία **ιδιώτη** απαντά «δεν βρέθηκε» (δες `network-destination.ts`).
 */

import * as React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';

import { DIRECTORY_KEYS, NETWORK_NS } from './network-messaging-keys';
import { NetworkThreadDirectoryBody } from './NetworkThreadDirectoryBody';

export function NetworkThreadDirectoryContent(): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);

  return (
    // 🔴 **ΟΥΤΕ ΓΕΩΜΕΤΡΙΑ ΟΥΤΕ ΔΕΥΤΕΡΟ `ShellSurface` ΕΔΩ — ΔΥΟ ΛΑΘΗ, ΔΥΟ ΜΑΘΗΜΑΤΑ** (ADR-797).
    //
    // ① Η πρώτη γραφή είχε `mx-auto flex max-w-3xl flex-col gap-6 py-8`. Η **CHECK 3.63** τη μπλόκαρε,
    //    σωστά: διάδρομο, μέτρο και κεντράρισμα τα κατέχει **ένας** — το `ShellSurface` του
    //    `PrivateSpaceShell`, που τυλίγει **ήδη** κάθε σελίδα του `(me)` με `measure="wide"`.
    //
    // ② Η δεύτερη γραφή «διόρθωσε» βάζοντας δικό της `<ShellSurface as="main" measure="wide">` —
    //    δηλαδή **grid μέσα σε grid**, δεύτερο ταβάνι στο ίδιο ερώτημα. Η πύλη έμεινε **ΠΡΑΣΙΝΗ**
    //    (ρωτά «έγραψες γεωμετρία;», όχι «πόσα μέτρα δήλωσες;») και το σπάσιμο φάνηκε **μόνο στην
    //    οθόνη**: το εξωτερικό grid έχει `flex-1`, το δικό μου `<main>` τεντώθηκε σε όλο το ύψος, και
    //    το **εσωτερικό** `align-content: normal` μοίρασε το πλεόνασμα στις σιωπηρές του γραμμές ⇒
    //    **~390px κενό** ανάμεσα στην κεφαλίδα και την πρώτη συνομιλία. Ίδιο σχήμα με τα μετρημένα
    //    504px του `MandateUnavailableNotice`.
    //
    // ⇒ Η σωστή ρίζα για σελίδα του `(me)` είναι **απλό `<main>` με `flex`** — όπως το
    //    `MyOwnerPropertiesContent`. Το `flex` είναι ασφαλές **εδώ** γιατί αυτό το στοιχείο **δεν**
    //    φέρει `data-shell-measure`· πάνω στην επιφάνεια θα νικούσε το grid κατά σειρά πηγής και το
    //    ταβάνι θα εξαφανιζόταν σιωπηλά. **Καμία** κλάση ύψους: το ύψος το δίνει το stretch της
    //    γραμμής του εξωτερικού grid.
    <main className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{t(DIRECTORY_KEYS.title)}</h1>
        <p className="m-0 text-sm text-muted-foreground">{t(DIRECTORY_KEYS.subtitle)}</p>
      </header>

      <NetworkThreadDirectoryBody />
    </main>
  );
}
