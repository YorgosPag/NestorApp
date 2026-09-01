'use client';

/**
 * @fileoverview **Η ΣΕΛΙΔΑ ΤΟΥ ΓΡΑΦΕΙΟΥ** — η δεύτερη ανάγνωση του §9.6, και η πραγματική.
 * @related ADR-827 §9.6 #2 · §9.8 · §9.9 β · services/realtime/hooks/usePublicAgencies
 * @module components/mandate/AgencyProfileContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΑΥΤΗ ΕΙΝΑΙ Η ΠΡΑΓΜΑΤΙΚΗ ΑΝΑΓΝΩΣΗ, ΚΑΙ ΟΧΙ Ο ΚΑΤΑΛΟΓΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Έτσι βρίσκει κανείς μεσίτη στην Ελλάδα: **κάρτα, πινακίδα «ΠΩΛΕΙΤΑΙ», σύσταση
 * γείτονα**. Ο άνθρωπος έρχεται με **όνομα**, όχι με διάθεση να περιηγηθεί — και η
 * διανομή του συνδέσμου είναι πράξη **ΤΟΥ ΓΡΑΦΕΙΟΥ**, ένας σύνδεσμος τη φορά: το
 * **αντίστροφο** της απαρίθμησης που το Ε-5 §4 #1 απαγορεύει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 «ΔΕΝ ΥΠΑΡΧΕΙ» ΚΑΙ «ΔΕΝ ΔΗΜΟΣΙΕΥΕΤΑΙ» ΑΠΑΝΤΟΥΝ **ΤΑΥΤΟΣΗΜΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `absent` σκεπάζει **επίτηδες** δύο διαφορετικές αλήθειες *(ψευδώνυμο που δεν
 * λύθηκε · οργανισμός που δεν δημοσίευσε)*. Αν τις ξεχώριζε, η σελίδα θα γινόταν
 * **μαντείο**: *«υπάρχει γραφείο με αυτό το όνομα;»* — δηλαδή απαρίθμηση, ένα ερώτημα
 * τη φορά, ακριβώς αυτό που ο κατάλογος επιτρέπεται να κάνει **μόνο** για τον opt-in
 * πληθυσμό.
 *
 * ⚠️ **Το `error` ΔΕΝ σκεπάζεται μαζί τους** (N.12): *«δεν μπόρεσα να ρωτήσω»* δεν
 * φοράει τη στολή του *«δεν υπάρχει»*, γιατί ο άνθρωπος θα εγκατέλειπε γραφείο που
 * **υπάρχει**.
 *
 * 🔴 **ΤΟ ΠΛΑΤΟΣ ΚΑΙ ΤΟ ΚΕΝΟ ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΕΔΩ** — η πρώτη γραφή είχε
 * `mx-auto max-w-2xl p-6` και **το CHECK 3.63 τη μπλόκαρε, σωστά**. Παραδίδονται από
 * το {@link ShellSurface}, ρόλος **`prose`** *(59ch)*: αυτή η σελίδα είναι
 * **ΑΝΑΓΝΩΣΗ** — δύο επεξηγηματικές παράγραφοι για το γιατί δεν υπάρχει τηλέφωνο και
 * τι θα γίνει αν πατήσεις το κουμπί. Ο ρόλος `prose` μετρήθηκε ώστε **και οι δύο**
 * γλώσσες να πέφτουν στο εύρος 45-75 χαρακτήρων του Bringhurst *(67,1 ελληνικοί /
 * 74,8 αγγλικοί)* — ο αδελφός κατάλογος παίρνει `wide`, γιατί εκεί είναι κάρτες.
 *
 * 🔶 **Β4 — Η ΡΑΦΗ**: το κουμπί του §9.8 αποδίδεται **απενεργοποιημένο** μέχρι να
 * υπάρξει η διαδρομή `mreq_*`. Αποδίδεται *παρόν* και όχι *απόν* επίτηδες: το §9.8
 * λέει ότι *«το προφίλ ΕΙΝΑΙ ΚΟΥΜΠΙ»*, και μια σελίδα χωρίς την πράξη της θα ήταν
 * κατάλογος τηλεφώνων **χωρίς τηλέφωνα** — ο επισκέπτης δεν θα μάθαινε ποτέ ότι
 * υπάρχει τρόπος να μιλήσει. Το επεξηγηματικό κείμενο από κάτω **είναι ήδη αληθές**.
 *
 * 🔴 **ΜΗΝ ΒΑΛΕΙΣ `flex` ΣΤΗΝ ΙΔΙΑ ΤΗΝ ΕΠΙΦΑΝΕΙΑ — ΤΟ ΜΕΤΡΗΣΑΜΕ ΖΩΝΤΑΝΑ.** Ο
 * κανόνας `[data-shell-measure] { display: grid; grid-template-columns: … min(var(--shell-measure), 100%) … }`
 * φτιάχνει τη **στήλη** του ταβανιού. Η πρώτη γραφή είχε `className="flex flex-col gap-6"`,
 * που **νικά κατά σειρά πηγής** *(το `shell-surface.css` φορτώνεται ΠΡΙΝ τα `@tailwind`,
 * ίδια ειδικότητα)* ⇒ η στήλη **δεν υπήρχε ποτέ** και το `<main>` απλώθηκε σε
 * **2.336px**. ⚠️ Και η **CHECK 3.63 ήταν ΠΡΑΣΙΝΗ**: ρωτά *«έγραψες γεωμετρία με το
 * χέρι;»*, **όχι** *«ισχύει το `measure` που δήλωσες;»* — πράσινο για λάθος λόγο, που
 * το βρήκε **μόνο** το άνοιγμα της σελίδας. Το `gap-*` **μένει**: δουλεύει σε grid.
 */

import React from 'react';

import { Link } from '@/lib/workspace/navigation';
import { Button } from '@/components/ui/button';
import { ShellSurface } from '@/core/containers/ShellSurface';
import { formatLongDate } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ListingCard } from '@/components/search-results/ListingCard';
import { usePublicAgency } from '@/services/realtime/hooks/usePublicAgencies';
import { usePublicAgencyListings } from '@/services/realtime/hooks/usePublicListings';
import { usePublicPlace } from '@/services/realtime/hooks/usePublicPlace';
import type { AgencyProfile } from '@/types/agency-profile';

import { AGENCY_PUBLIC_NS, PROFILE_KEYS } from './agency-directory-labels';
import { AGENCY_DIRECTORY_ROUTE } from './agency-directory-route';

/**
 * **Η διεύθυνση της φόρμας του Σ1** — γραμμένη **εδώ**, όπου ζει το κουμπί.
 *
 * ⚠️ `encodeURIComponent` και όχι ωμή παρεμβολή: το ψευδώνυμο έρχεται από τη διεύθυνση
 * που πάτησε ο επισκέπτης, δηλαδή είναι **είσοδος**. Το `alias-rules.ts` περιορίζει τη
 * μορφή, αλλά ο περιορισμός ζει στην **εγγραφή** — εδώ φτάνει ό,τι κι αν πληκτρολόγησε.
 */
function mandateRequestHref(alias: string): string {
  return `/offers/mandate/new?agency=${encodeURIComponent(alias)}`;
}

// 🔴 ADR-744 §18 — Η ΔΗΛΩΣΗ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΔΟΣΗ. Το route slice έχει δήλωση,
// artifact και υπογραφή στο manifest — και **δεν φορτώνεται ποτέ** χωρίς αυτές τις
// δύο γραμμές. Πληρώθηκε ζωντανά σε τέσσερις δημόσιες οθόνες: πράσινες πύλες,
// αδρανής θεραπεία, ωμά κλειδιά στην οθόνη. Η εγγραφή ζει στο **client** component
// και όχι στο `page.tsx`, γιατί το slice πρέπει να φτάσει στον **φυλλομετρητή**:
// ένα `page.tsx` που είναι server component θα το εισήγαγε μόνο στον διακομιστή.
import routeSlice from '@/i18n/generated/routes/pro__alias.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);


interface AgencyProfileContentProps {
  /**
   * Η ταυτότητα του οργανισμού, **λυμένη στον διακομιστή** από το ψευδώνυμο.
   * `null` σημαίνει *«το ψευδώνυμο δεν λύθηκε»* — και δες την κεφαλίδα για το γιατί
   * απαντά **ίδια** με «δεν δημοσίευσε».
   */
  readonly companyId: string | null;
  /**
   * **Το ψευδώνυμο, όπως το είδε ο άνθρωπος** — η διεύθυνση που πάτησε.
   *
   * 🔑 **Ταξιδεύει ως prop και ΔΕΝ παράγεται ξανά**: η αντίστροφη αναζήτηση
   * `companyId → ψευδώνυμο` θα ήταν **σάρωση**, δηλαδή απαρίθμηση γραφείων — και το
   * `alias-registry.ts` το δηλώνει ρητά (γι' αυτό το `canonicalAlias` επιστρέφει
   * `null`). Ίδιο ιδίωμα με την πόρτα δημοσίευσης: **ο πελάτης το δηλώνει**.
   */
  readonly alias: string;
}

/** Μία μικρή, ονομασμένη γραμμή «ετικέτα → τιμή» — τρεις καταναλωτές στη σελίδα. */
function Fact({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="m-0 text-sm font-medium text-foreground">{label}</dt>
      <dd className="m-0 text-sm text-muted-foreground">{value}</dd>
      {hint !== undefined ? <p className="m-0 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Το «δεν υπάρχει βιτρίνα εδώ» **και** το «δεν μπόρεσα να ρωτήσω» — δύο τίτλοι, μία μορφή. */
function Notice({
  title,
  body,
  action,
}: {
  readonly title: string;
  readonly body: string;
  readonly action: string;
}): React.JSX.Element {
  return (
    <ShellSurface as="main" measure="prose" className="gap-3">
      <h1 className="m-0 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="m-0 text-muted-foreground">{body}</p>
      <nav className="mt-2">
        <Link
          href={AGENCY_DIRECTORY_ROUTE}
          className="inline-block rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
        >
          {action}
        </Link>
      </nav>
    </ShellSurface>
  );
}

/** Πού δραστηριοποιείται — **μία** επιπλέον ανάγνωση, μόνο για τη μία βιτρίνα. */
function PlaceFact({ profile }: { readonly profile: AgencyProfile }): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  // ⚠️ `idle` όταν `place === null` — **δεν είναι φόρτωση**, δεν υπάρχει ερώτηση.
  const place = usePublicPlace(profile.place);

  // ⚠️ Ό,τι δεν είναι `found` γίνεται «δεν δηλώθηκε» — ΚΑΙ το `error`. Εδώ αυτό είναι
  //    σωστό και όχι χαλάρωση του N.12: η περιοχή είναι **διακοσμητική** πληροφορία
  //    της κάρτας, όχι η απάντηση της σελίδας. Η σελίδα απαντά «υπάρχει αυτό το
  //    γραφείο;» — και αυτό το ξέρουμε ήδη. Ένα «σφάλμα» εδώ θα φώναζε για κάτι που
  //    δεν εμποδίζει τίποτα.
  const value =
    place.state === 'found' && place.land.displayAddress !== null
      ? place.land.displayAddress
      : t(PROFILE_KEYS.placeUnknown);

  return <Fact label={t(PROFILE_KEYS.placeLabel)} value={value} />;
}

/**
 * **ΤΙ ΕΧΕΙ ΣΤΗΝ ΑΓΟΡΑ** — η δεύτερη μισή της βιτρίνας (ADR-841 §7 Α6).
 *
 * Μέχρι τις 2026-09-01 η σελίδα έλεγε **ποιος** είναι το γραφείο και **τίποτα** για το
 * τι πουλά. Το εμπόδιο δεν ήταν σχεδιαστικό: το `PublicListing` είχε **επωνυμία** και
 * **καμία ταυτότητα**, άρα το φίλτρο θα ήταν πάνω σε συμβολοσειρά οθόνης — δύο γραφεία
 * με ίδιο όνομα θα έδειχναν το ένα τις αγγελίες του άλλου, και μια **μετονομασία** θα
 * άδειαζε τη βιτρίνα χωρίς να αλλάξει τίποτα στην πραγματικότητα. Η Α1 έδωσε το
 * `agencyId`· αυτή η ενότητα το ξοδεύει.
 *
 * 🔑 **Η ΚΑΡΤΑ ΕΙΝΑΙ Η ΙΔΙΑ ΜΕ ΤΗΣ ΟΘΟΝΗΣ 2** ({@link ListingCard}) — δεύτερη κάρτα
 * αγγελίας θα ήταν το διπλότυπο του N.0.2, και θα απέκλινε στην πρώτη αλλαγή του
 * σχήματος *(η οθόνη 2 έμαθε ήδη τρία νέα πεδία μέσα σε δύο εβδομάδες)*. Και **δεν
 * κοστίζει i18n**: το `search-results` είναι **εγγυημένο namespace του κελύφους**
 * (`.i18n-shell-slice.json`), άρα τα κλειδιά της κάρτας ταξιδεύουν ήδη σε κάθε
 * διαδρομή — το route slice αυτής της σελίδας δεν μεγαλώνει καθόλου γι' αυτές.
 *
 * ⚠️ **`showAuthorship={false}` — και είναι το ΜΟΝΟ σημείο που επιτρέπεται.** Η
 * υπογραφή απαντά *«με ποιον μιλάω;»*· εδώ την απαντά ο **τίτλος** της σελίδας, δύο
 * ενότητες πιο πάνω. Επαναλαμβανόμενη σε κάθε κάρτα θα ήταν θόρυβος, όχι διαφάνεια.
 *
 * 🔴 **ΤΕΣΣΕΡΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΣΥΓΧΩΝΕΥΕΤΑΙ** — ίδιος κανόνας με την
 * υπόλοιπη σελίδα: *«δεν έχει αγγελίες»* λέει στον επισκέπτη **ρώτα τον απευθείας**,
 * ενώ *«δεν μπόρεσα να ρωτήσω»* λέει **ξαναδοκίμασε**. Ένα κοινό «τίποτα εδώ» θα τον
 * έστελνε μακριά από γραφείο που **έχει** ακίνητα (N.12).
 *
 * 🔶 **Η ΘΕΣΗ ΤΗΣ ΕΝΟΤΗΤΑΣ ΕΙΝΑΙ ΑΝΑΣΤΡΕΨΙΜΗ, ΚΑΙ ΜΠΑΙΝΕΙ ΤΕΛΕΥΤΑΙΑ ΕΠΙΤΗΔΕΣ.** Το
 * ADR-827 §9.8 αποφάσισε ότι *«το προφίλ ΕΙΝΑΙ ΚΟΥΜΠΙ»* — το αίτημα ανάθεσης είναι η
 * μία πράξη της σελίδας. Μια λίστα **πάνω** από εκείνο θα το έσπρωχνε κάτω από το
 * ταβάνι της οθόνης, δηλαδή θα **ανέτρεπε σιωπηλά** μετρημένη απόφαση άλλου εγγράφου.
 * Αν ο Giorgio τη θέλει ψηλότερα, είναι **μετακίνηση ενός μπλοκ** — αλλά τότε το §9.8
 * ενημερώνεται μαζί.
 */
function AgencyListings({ companyId }: { readonly companyId: string }): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { listings, loading, error } = usePublicAgencyListings(companyId);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <h2 className="m-0 text-lg font-semibold text-foreground">
          {t(PROFILE_KEYS.listingsTitle)}
        </h2>
        {!loading && error === null && listings.length > 0 ? (
          <p className="m-0 text-sm text-muted-foreground">
            {t(PROFILE_KEYS.listingsCount, { count: listings.length })}
          </p>
        ) : null}
      </header>

      {loading ? (
        <p className="m-0 text-sm text-muted-foreground">{t(PROFILE_KEYS.listingsLoading)}</p>
      ) : error !== null ? (
        <p className="m-0 text-sm text-muted-foreground">{t(PROFILE_KEYS.listingsFailed)}</p>
      ) : listings.length === 0 ? (
        <>
          <p className="m-0 text-sm text-muted-foreground">{t(PROFILE_KEYS.listingsEmpty)}</p>
          <p className="m-0 text-sm text-muted-foreground">{t(PROFILE_KEYS.listingsEmptyHint)}</p>
        </>
      ) : (
        // ⚠️ Οι αγγελίες φτάνουν **ήδη ταξινομημένες** από το hook
        //    (`orderShowcaseListings`) — καμία `sort()` σε αυτό το αρχείο, ίδιος
        //    κανόνας με τον αδελφό κατάλογο: η σειρά είναι **απόφαση με διεύθυνση**.
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} showAuthorship={false} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function AgencyProfileContent({
  companyId,
  alias,
}: AgencyProfileContentProps): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const lookup = usePublicAgency(companyId);

  if (lookup.state === 'loading') {
    return (
      <ShellSurface as="main" measure="prose">
        <p className="m-0 text-sm text-muted-foreground">{t(PROFILE_KEYS.loading)}</p>
      </ShellSurface>
    );
  }

  if (lookup.state === 'absent') {
    return (
      <Notice
        title={t(PROFILE_KEYS.absentTitle)}
        body={t(PROFILE_KEYS.absentLead)}
        action={t(PROFILE_KEYS.absentAction)}
      />
    );
  }

  if (lookup.state === 'error') {
    return (
      <Notice
        title={t(PROFILE_KEYS.failedTitle)}
        body={t(PROFILE_KEYS.failedLead)}
        action={t(PROFILE_KEYS.backToDirectory)}
      />
    );
  }

  const { profile } = lookup;

  return (
    <ShellSurface as="main" measure="prose" className="gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{profile.displayName}</h1>
        <p className="m-0 text-sm text-muted-foreground">
          {t(PROFILE_KEYS.publishedAt, { date: formatLongDate(profile.publishedAt) })}
        </p>
      </header>

      <dl className="m-0 flex flex-col gap-4">
        <Fact
          label={t(PROFILE_KEYS.gemiLabel)}
          value={profile.gemiNumber}
          hint={t(PROFILE_KEYS.gemiHint)}
        />
        <PlaceFact profile={profile} />
      </dl>

      <section className="flex flex-col gap-2">
        {/*
          ✅ Β4 (2026-08-29 ζ) — Η ΡΑΦΗ ΕΚΛΕΙΣΕ. Το κουμπί δεν είναι πια απενεργοποιημένο.

          🔑 **ΣΥΝΔΕΣΜΟΣ ΚΑΙ ΟΧΙ `onClick`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ** (§9.17 α): η φόρμα ζει
          σε **δική της διεύθυνση** μέσα στο `(me)`, γιατί απαιτεί ταυτότητα και
          `noindex` — δύο πράγματα που το `(light)` δηλώνει ρητά ότι **δεν** έχει. Ένας
          διάλογος εδώ θα κρατούσε την κατάσταση **εκτός διεύθυνσης**: ο ανώνυμος που
          πατά, συνδέεται και γυρίζει, θα τον έβρισκε **κλειστό**.

          ⚠️ Το ψευδώνυμο ταξιδεύει στη διεύθυνση επειδή η σελίδα το **έχει ήδη** — το
          είδε ο άνθρωπος στη γραμμή διευθύνσεων. Η αντίστροφη αναζήτηση
          `companyId → ψευδώνυμο` θα ήταν **σάρωση**, δηλαδή απαρίθμηση γραφείων
          (`alias-registry.ts`, ADR-787 Ε-5 §4 #1).
        */}
        <Button asChild aria-describedby="agency-request-hint">
          <Link href={mandateRequestHref(alias)}>{t(PROFILE_KEYS.requestCta)}</Link>
        </Button>
        <p id="agency-request-hint" className="m-0 text-sm text-muted-foreground">
          {t(PROFILE_KEYS.requestHint)}
        </p>
      </section>

      {/*
        🔑 ΤΟ «ΓΙΑΤΙ ΔΕΝ ΕΧΕΙ ΤΗΛΕΦΩΝΟ» ΛΕΓΕΤΑΙ ΣΤΟΝ ΕΠΙΣΚΕΠΤΗ, ΟΧΙ ΜΟΝΟ ΣΤΟ ADR.
        Χωρίς αυτό, η απουσία καναλιού διαβάζεται ως **ελάττωμα** της πλατφόρμας —
        και ο άνθρωπος φεύγει να ψάξει το τηλέφωνο αλλού, δηλαδή ακριβώς η πράξη που
        το άρθρο 200 §1 αφήνει χωρίς ίχνος.
      */}
      <p className="m-0 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
        {t(PROFILE_KEYS.noChannel)}
      </p>

      {/*
        🔴 **ADR-841 §7 (Α6) — Η ΒΙΤΡΙΝΑ ΔΕΙΧΝΕΙ ΤΑ ΑΚΙΝΗΤΑ ΤΗΣ.** Το `companyId` είναι
        εδώ **μη-null εξ ορισμού**: αν ήταν `null`, η αναζήτηση θα είχε ήδη βγει
        `absent` και η σελίδα δεν θα έφτανε ποτέ σε αυτό το σημείο. Ο τύπος το λέει
        μέσω του `profile.companyId`, που είναι η **ταυτότητα του ίδιου εγγράφου** που
        μόλις διαβάστηκε — όχι το prop, που μπορεί να είναι `null`.
      */}
      <AgencyListings companyId={profile.companyId} />

      <nav>
        <Link
          href={AGENCY_DIRECTORY_ROUTE}
          className="text-sm font-medium text-foreground underline underline-offset-4"
        >
          {t(PROFILE_KEYS.backToDirectory)}
        </Link>
      </nav>
    </ShellSurface>
  );
}
