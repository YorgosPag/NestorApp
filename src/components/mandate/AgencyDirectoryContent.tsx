'use client';

/**
 * @fileoverview **Ο ΔΗΜΟΣΙΟΣ ΚΑΤΑΛΟΓΟΣ ΓΡΑΦΕΙΩΝ** — η πρώτη ανάγνωση του §9.6.
 * @related ADR-827 §9.4 · §9.6 #1 · §9.9 α · services/realtime/hooks/usePublicAgencies
 * @module components/mandate/AgencyDirectoryContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΔΕΝ ΕΧΕΙ ΑΥΤΗ Η ΟΘΟΝΗ — ΚΑΙ ΚΑΝΕΝΑ ΔΕΝ ΛΕΙΠΕΙ ΑΠΟ ΑΜΕΛΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Τι λείπει | Γιατί |
 * |---|---|
 * | **ταξινόμηση από τον χρήστη** *(«κατά δημοφιλία», «κατά αξιολόγηση»)* | §9.9 α — δεν υπάρχουν τέτοια πεδία, **επίτηδες**. Ένας επιλογέας ταξινόμησης θα ήταν η υποδοχή που περιμένει το εμπορικό κριτήριο |
 * | **προβεβλημένες / «κορυφαίες» κάρτες** | ίδιο· κατάλογος **ΓΡΑΦΕΙΩΝ** κατευθύνει **δουλειά** *(NAR, $418M)* |
 * | **αριθμός αγγελιών ανά γραφείο** | θα ήταν **de facto κατάταξη** *(«το μεγάλο γραφείο πρώτο»)* γραμμένη ως πληροφορία, και θα απαιτούσε σάρωση αγγελιών ανά γραφείο |
 *
 * 🔑 **Η σειρά ΔΕΝ αποφασίζεται εδώ.** Έρχεται ήδη ταξινομημένη από το
 * {@link usePublicAgencies} → {@link orderAgencies}. Μια `sort()` σε αυτό το αρχείο θα
 * ήταν **δεύτερη απάντηση** στο ίδιο ερώτημα, και η επόμενη — εμπορική — θα έμπαινε
 * δίπλα της χωρίς να τη δει κανείς.
 *
 * ⚠️ **Ιδιοκτήτης του `<main>` είναι η σελίδα** (`(light)/layout.tsx`: *«ο ιδιοκτήτης
 * του `<main>` είναι η ΣΕΛΙΔΑ, γιατί μόνο εκείνη ξέρει τι είναι το κύριο περιεχόμενό
 * της»*) — το `(light)` **δεν** αποδίδει `<main>`, σε αντίθεση με το `(app)`.
 *
 * 🔴 **ΤΟ ΠΛΑΤΟΣ ΚΑΙ ΤΟ ΚΕΝΟ ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΕΔΩ** — η πρώτη γραφή είχε
 * `mx-auto max-w-3xl p-6` και **το CHECK 3.63 τη μπλόκαρε, σωστά**. Η κλίμακα ζει στο
 * `design-tokens.json → spacing.layout.measure` και παραδίδεται από το
 * {@link ShellSurface}: ο ρόλος **`wide`** *(80ch)* αναπαράγει το χειρόγραφο
 * `max-w-3xl + p-6` με **719px έναντι 720px** — μηδενική οπτική αλλαγή, και η τιμή
 * κλιμακώνεται όταν ο άνθρωπος μεγεθύνει τη γραμματοσειρά του (WCAG 1.4.4).
 * `wide` και όχι `prose`, γιατί αυτό είναι **λίστα καρτών**, όχι πρόζα.
 *
 *
 * 🔴 **ΜΗΝ ΒΑΛΕΙΣ `flex` ΣΤΗΝ ΙΔΙΑ ΤΗΝ ΕΠΙΦΑΝΕΙΑ — ΤΟ ΜΕΤΡΗΣΑΜΕ ΖΩΝΤΑΝΑ.** Ο
 * κανόνας `[data-shell-measure] { display: grid; grid-template-columns: … min(var(--shell-measure), 100%) … }`
 * φτιάχνει τη **στήλη** του ταβανιού. Η πρώτη γραφή είχε `className="flex flex-col gap-6"`,
 * που **νικά κατά σειρά πηγής** *(το `shell-surface.css` φορτώνεται ΠΡΙΝ τα `@tailwind`,
 * ίδια ειδικότητα)* ⇒ η στήλη **δεν υπήρχε ποτέ** και το `<main>` απλώθηκε σε
 * **2.336px**. ⚠️ Και η **CHECK 3.63 ήταν ΠΡΑΣΙΝΗ**: ρωτά *«έγραψες γεωμετρία με το
 * χέρι;»*, **όχι** *«ισχύει το `measure` που δήλωσες;»* — πράσινο για λάθος λόγο, που
 * το βρήκε **μόνο** το άνοιγμα της σελίδας. Το `gap-*` **μένει**: δουλεύει σε grid.
 * ⚠️ Καμία συμβολοσειρά οθόνης (N.11) — όλα από τον πίνακα κλειδιών.
 */

import React from 'react';

import { Link } from '@/lib/workspace/navigation';
import { ShellSurface } from '@/core/containers/ShellSurface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublicAgencies } from '@/services/realtime/hooks/usePublicAgencies';
import type { AgencyProfile } from '@/types/agency-profile';

import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';

// 🔴 ADR-744 §18 — Η ΔΗΛΩΣΗ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΔΟΣΗ. Το route slice έχει δήλωση,
// artifact και υπογραφή στο manifest — και **δεν φορτώνεται ποτέ** χωρίς αυτές τις
// δύο γραμμές. Πληρώθηκε ζωντανά σε τέσσερις δημόσιες οθόνες: πράσινες πύλες,
// αδρανής θεραπεία, ωμά κλειδιά στην οθόνη. Η εγγραφή ζει στο **client** component
// και όχι στο `page.tsx`, γιατί το slice πρέπει να φτάσει στον **φυλλομετρητή**:
// ένα `page.tsx` που είναι server component θα το εισήγαγε μόνο στον διακομιστή.
import routeSlice from '@/i18n/generated/routes/pro.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// ADR-827 §9.15 — η δημόσια διεύθυνση ζει σε ουδέτερο module: τη ρωτά και ο διακομιστής.
import { agencyProfileRoute } from './agency-directory-route';

registerRouteSlice(routeSlice);



function AgencyCard({ profile }: { readonly profile: AgencyProfile }): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <article className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold text-foreground">{profile.displayName}</h2>
        {/*
          ⚠️ Ο ΓΕΜΗ δεν είναι διακόσμηση: είναι **η απόδειξη ότι ο μεσίτης είναι
          υπαρκτός και αδειοδοτημένος** (§9.9 β) — δηλαδή το μόνο που κάνει τον
          κατάλογο χρήσιμο αντί για επικίνδυνο. Γι' αυτό είναι στην **κάρτα**, όχι
          κρυμμένος μέσα στη σελίδα προφίλ.
        */}
        <p className="m-0 text-sm text-muted-foreground">
          {t(DIRECTORY_KEYS.gemi, { number: profile.gemiNumber })}
        </p>
        <Link
          href={agencyProfileRoute(profile.alias)}
          className="mt-2 self-start text-sm font-medium text-foreground underline underline-offset-4"
        >
          {t(DIRECTORY_KEYS.open)}
        </Link>
      </article>
    </li>
  );
}

export function AgencyDirectoryContent(): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { agencies, loading, error } = usePublicAgencies();

  return (
    <ShellSurface as="main" measure="wide" className="gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{t(DIRECTORY_KEYS.title)}</h1>
        {/*
          🔑 Η ΟΥΔΕΤΕΡΟΤΗΤΑ ΛΕΓΕΤΑΙ, ΔΕΝ ΥΠΟΝΟΕΙΤΑΙ. Ο επισκέπτης κάθε άλλου
          καταλόγου έχει μάθει ότι η πρώτη θέση αγοράζεται· αν δεν του πούμε ότι εδώ
          δεν αγοράζεται, θα το υποθέσει — και η υπόθεση είναι δωρεάν για εκείνον.
        */}
        <p className="m-0 text-muted-foreground">{t(DIRECTORY_KEYS.lead)}</p>
      </header>

      {loading ? (
        <p className="m-0 text-sm text-muted-foreground">{t(DIRECTORY_KEYS.loading)}</p>
      ) : error !== null ? (
        // ⚠️ **Σφάλμα ≠ κενός κατάλογος.** Ένα «δεν υπάρχουν γραφεία» εδώ θα έλεγε
        //    ψέματα για ΟΛΟΥΣ όσοι δημοσίευσαν — «άγνωστο ≠ κενό» (N.12).
        <p role="alert" className="m-0 text-sm text-destructive">
          {t(DIRECTORY_KEYS.failed)}
        </p>
      ) : agencies.length === 0 ? (
        // 🔑 Ο ΚΕΝΟΣ ΚΑΤΑΛΟΓΟΣ ΕΙΝΑΙ Η **ΣΩΣΤΗ** ΑΡΧΙΚΗ ΚΑΤΑΣΤΑΣΗ (§9.12 #12):
        //    κανείς δεν μπαίνει χωρίς να το ζητήσει. Το λέμε έτσι, αντί για κενό.
        <section className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-muted/40 p-4">
          <p className="m-0 text-sm text-foreground">{t(DIRECTORY_KEYS.empty)}</p>
          <p className="m-0 text-sm text-muted-foreground">{t(DIRECTORY_KEYS.emptyHint)}</p>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            {t(DIRECTORY_KEYS.count, { count: agencies.length })}
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {agencies.map((profile) => (
              <AgencyCard key={profile.companyId} profile={profile} />
            ))}
          </ul>
        </section>
      )}
    </ShellSurface>
  );
}
