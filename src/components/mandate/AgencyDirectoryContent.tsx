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
import type { PublicShowcase } from '@/types/agency-profile';
import { CredibilityStatement } from './CredibilityStatement';

import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';
import { AgencyDirectoryFilters } from './AgencyDirectoryFilters';
import {
  EMPTY_SHOWCASE_FILTERS,
  applyShowcaseFilters,
  hasActiveFilters,
  occupationOptions,
  parseShowcaseFilters,
  serializeShowcaseFilters,
  type ShowcaseFilters,
} from '@/lib/agency/showcase-filter';
// 🔴 **Ο ROUTER ΑΠΟ ΤΟ ΣΥΝΟΡΟ** (CHECK 3.61) — το `useSearchParams` δεν ζει εκεί
//    και έρχεται ωμό, όπως και στην αδελφή δημόσια οθόνη `ListingDetailContent`.
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/workspace/navigation';

// 🔴 ADR-744 §18 — Η ΔΗΛΩΣΗ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΔΟΣΗ. Το route slice έχει δήλωση,
// artifact και υπογραφή στο manifest — και **δεν φορτώνεται ποτέ** χωρίς αυτές τις
// δύο γραμμές. Πληρώθηκε ζωντανά σε τέσσερις δημόσιες οθόνες: πράσινες πύλες,
// αδρανής θεραπεία, ωμά κλειδιά στην οθόνη. Η εγγραφή ζει στο **client** component
// και όχι στο `page.tsx`, γιατί το slice πρέπει να φτάσει στον **φυλλομετρητή**:
// ένα `page.tsx` που είναι server component θα το εισήγαγε μόνο στον διακομιστή.
import routeSlice from '@/i18n/generated/routes/pro.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// ADR-827 §9.15 — η δημόσια διεύθυνση ζει σε ουδέτερο module: τη ρωτά και ο διακομιστής.
import { agencyDirectoryHref, agencyProfileRoute } from './agency-directory-route';

registerRouteSlice(routeSlice);



function AgencyCard({ profile }: { readonly profile: PublicShowcase }): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <article className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold text-foreground">{profile.displayName}</h2>
        {/*
          ⚠️ Η ΑΠΟΔΕΙΞΗ δεν είναι διακόσμηση: είναι **αυτό που κάνει τον κατάλογο
          χρήσιμο αντί για επικίνδυνο** (§9.9 β). Γι' αυτό είναι στην **κάρτα**,
          όχι κρυμμένη μέσα στη σελίδα προφίλ.

          🔴 ADR-841 Φ6-Β — ΗΤΑΝ ΜΙΑ ΓΡΑΜΜΗ «ΓΕΜΗ {number}», ΚΑΙ ΔΕΝ ΑΡΚΕΙ ΠΙΑ.
          Με **πέντε** επαγγέλματα στον ίδιο πίνακα, ο σκέτος αριθμός δεν λέει
          **ποιος τον εξέδωσε** *(Α9.1)*, και η απουσία του δεν λέει **γιατί
          λείπει** — ο ελαιοχρωματιστής δεν έχει πού να γραφτεί, ο δικηγόρος που
          σιωπά έχει. Δύο γραμμές, δύο ερωτήματα, ποτέ μία πρόταση.

          ⚠️ **ΚΑΘΕ credential αποδίδεται**: το μικτό γραφείο *(μεσιτική άδεια ΚΑΙ
          τεχνική ιδιότητα)* δείχνει **και τα δύο**. Ένα `credentials[0]` θα
          έκρυβε τη μισή του ταυτότητα.
        */}
        {profile.credentials.map((credential) => (
          <CredibilityStatement key={credential.occupation.escoUri} credential={credential} />
        ))}
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
  const { t, i18n } = useTranslation([AGENCY_PUBLIC_NS]);
  const { agencies, loading, error } = usePublicAgencies();

  // 🔴 **`useSearchParams` ΕΔΩ, ΠΟΤΕ ΣΤΟ `page.tsx`** (ADR-744): τα Server και
  //    Client δέντρα έχουν **ξεχωριστούς** γράφους module — μια ανάγνωση από
  //    εκεί θα ζητούσε **άλλο** στιγμιότυπο, και το route slice δεν εγγράφεται.
  //    Το όριο `<Suspense>` που απαιτεί η CHECK 3.55 ζει στο `page.tsx`.
  const params = useSearchParams();
  const router = useRouter();

  const locale: 'el' | 'en' = i18n.language === 'el' ? 'el' : 'en';
  const filters = React.useMemo(
    () => parseShowcaseFilters(new URLSearchParams(params.toString())),
    [params],
  );

  // 🔑 **Η ΔΙΕΥΘΥΝΣΗ ΕΙΝΑΙ Η ΚΑΤΑΣΤΑΣΗ.** Καμία δεύτερη πηγή: ένα `useState`
  //    δίπλα στη διεύθυνση θα ήταν δύο απαντήσεις στο *«τι φιλτράρει τώρα;»*,
  //    και η μία θα επιβίωνε του «πίσω» ενώ η άλλη όχι.
  const apply = React.useCallback(
    (next: ShowcaseFilters): void => {
      // ⚠️ **`replace`, ΟΧΙ `push`**: η αλλαγή φίλτρου δεν είναι πλοήγηση. Με
      //    `push`, το «πίσω» θα ξετύλιγε κάθε πάτημα του επισκέπτη αντί να τον
      //    βγάλει από τον κατάλογο.
      router.replace(agencyDirectoryHref(serializeShowcaseFilters(next).toString()), {
        scroll: false,
      });
    },
    [router],
  );

  // 🔴 **Φ3 — ΤΟ ΦΙΛΤΡΑΡΙΣΜΕΝΟ ΕΙΝΑΙ ΥΠΑΚΟΛΟΥΘΙΑ ΤΟΥ ΤΑΞΙΝΟΜΗΜΕΝΟΥ.** Ο
  //    `usePublicAgencies` έχει **ήδη** ταξινομήσει· εδώ **μόνο** αφαιρούμε.
  //    Καμία «συνάφεια», κανένα «best match» — η σειρά δεν αλλάζει ποτέ επειδή
  //    κάποιος φιλτράρισε.
  const visible = React.useMemo(() => applyShowcaseFilters(agencies, filters), [agencies, filters]);
  const options = React.useMemo(() => occupationOptions(agencies, locale), [agencies, locale]);
  const filtering = hasActiveFilters(filters);

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

      {/* ⚠️ Τα χειριστήρια εμφανίζονται **μόνο όταν υπάρχει πληθυσμός**: επιλογές
          πάνω σε άδειο κατάλογο θα υπόσχονταν κόσμο που δεν υπάρχει. */}
      {!loading && error === null && agencies.length > 0 && (
        <AgencyDirectoryFilters
          filters={filters}
          options={options}
          locale={locale}
          onChange={apply}
          onClear={filtering ? () => apply(EMPTY_SHOWCASE_FILTERS) : null}
        />
      )}

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
      ) : visible.length === 0 ? (
        // 🔴 **«ΚΑΝΕΙΣ ΔΕΝ ΔΗΜΟΣΙΕΥΣΕ» ≠ «ΚΑΝΕΙΣ ΜΕ ΑΥΤΑ ΤΑ ΚΡΙΤΗΡΙΑ»** (N.12).
        //    Ισοπεδωμένα, ο επισκέπτης που φιλτράρισε θα συμπέραινε ότι ο
        //    κατάλογος είναι **άδειος** και θα έφευγε — ενώ φταίει η επιλογή του,
        //    και η θεραπεία είναι **ένα πάτημα** μακριά.
        <section className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-muted/40 p-4">
          <p className="m-0 text-sm text-foreground">{t(DIRECTORY_KEYS.emptyAfterFilter)}</p>
          <p className="m-0 text-sm text-muted-foreground">
            {t(DIRECTORY_KEYS.emptyAfterFilterHint)}
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            {/* 🔑 **Φ4 — «7 από 34», ποτέ σκέτο «7».** Ο αριθμός που λείπει είναι
                ο **παρονομαστής**: χωρίς αυτόν ο επισκέπτης δεν ξέρει ότι
                αφαίρεσε κάτι, και το φίλτρο γίνεται αόρατος περιορισμός. */}
            {filtering
              ? t(DIRECTORY_KEYS.countFiltered, {
                  // ⚠️ **`shown`, ΟΧΙ `count`** — τα ονόματα των παραμέτρων ζουν στο
                  //    locale, και ένα λάθος όνομα ζωγραφίζει **ωμό `{shown}`**.
                  shown: visible.length,
                  total: agencies.length,
                })
              : t(DIRECTORY_KEYS.count, { count: agencies.length })}
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {visible.map((profile) => (
              <AgencyCard key={profile.companyId} profile={profile} />
            ))}
          </ul>
        </section>
      )}
    </ShellSurface>
  );
}
