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

import { ShellSurface } from '@/core/containers/ShellSurface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublicAgencies } from '@/services/realtime/hooks/usePublicAgencies';
import { AgencyCard } from './AgencyCard';

import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';
import { AgencyDirectoryFilters } from './AgencyDirectoryFilters';
import {
  EMPTY_SHOWCASE_FILTERS,
  applyShowcaseFilters,
  hasActiveFilters,
  isAdministrativeWhere,
  occupationOptions,
  parseShowcaseFilters,
  serializeShowcaseFilters,
  showcaseLocale,
  whereCenter,
  type ShowcaseFilters,
} from '@/lib/agency/showcase-filter';
import { useAdministrativeHierarchy } from '@/hooks/useAdministrativeHierarchy';
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
import { agencyDirectoryHref } from './agency-directory-route';
import { useCoverageResolvers } from '@/hooks/useCoverageResolvers';
import { useCircleAnchorName } from '@/hooks/useCircleAnchorName';
import { showcaseWhereVoice } from '@/lib/agency/showcase-where-voice';
import { DirectoryQueryState } from './DirectoryQueryState';
import { LandingHero } from '@/components/shared/landing-hero/LandingHero';
import { LANDING_HERO_IMAGES } from '@/components/shared/landing-hero/landing-hero-images';

registerRouteSlice(routeSlice);




export function AgencyDirectoryContent(): React.JSX.Element {
  const { t, i18n } = useTranslation([AGENCY_PUBLIC_NS]);

  // 🔴 **`useSearchParams` ΕΔΩ, ΠΟΤΕ ΣΤΟ `page.tsx`** (ADR-744): τα Server και
  //    Client δέντρα έχουν **ξεχωριστούς** γράφους module — μια ανάγνωση από
  //    εκεί θα ζητούσε **άλλο** στιγμιότυπο, και το route slice δεν εγγράφεται.
  //    Το όριο `<Suspense>` που απαιτεί η CHECK 3.55 ζει στο `page.tsx`.
  const params = useSearchParams();
  const router = useRouter();

  // ⚠️ **ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΕΔΩ ΣΤΟ ΧΕΡΙ** (`i18n.language === 'el' ? 'el' : 'en'`). Η **ρίζα**
  //    το χρειάστηκε ως δεύτερος αναγνώστης *(Α4.5)*, και δύο αντίγραφα ενός `?:` δεν
  //    κοστίζουν σήμερα — κοστίζουν όταν προστεθεί τρίτη γλώσσα και οι δύο οθόνες
  //    ταξινομήσουν αλλιώς, **χωρίς κανένα σφάλμα** (N.0.2).
  const locale = showcaseLocale(i18n.language);
  const filters = React.useMemo(
    () => parseShowcaseFilters(new URLSearchParams(params.toString())),
    [params],
  );

  // 🔴 **ΤΟ ΙΔΙΟ ΚΕΝΤΡΟ ΤΑΞΙΝΟΜΕΙ ΚΑΙ ΦΙΛΤΡΑΡΕΙ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΟ ΚΡΙΤΗΡΙΟ**
  //    (ADR-843 ΠΕ7 · Κ12). Ο άξονας είναι **ΕΝΑΣ**: η απόσταση από τον άνθρωπο. Το
  //    φίλτρο απαντά *«ποιοι χωράνε στην ακτίνα;»*, η σειρά *«ποιος είναι πιο
  //    κοντά;»* — δύο ερωτήσεις, **μία** είσοδος. Δύο **διαφορετικά** κέντρα εδώ θα
  //    ήταν δύο αλήθειες για το «πού είσαι».
  //
  // ⚠️ **`null` = «δεν ξέρουμε πού είσαι» ⇒ όλοι ισότιμοι**, με τα λόγια της οθόνης.
  //    ⛔ ΜΗΝ βάλεις προεπιλεγμένο κέντρο *(«Αθήνα, γιατί εκεί είναι οι περισσότεροι»)*:
  //    θα ήταν **σιωπηλή γεωγραφική κατάταξη** που κανείς δεν ζήτησε και κανείς δεν
  //    βλέπει — ακριβώς το σχήμα του «μοιάζει με αρχή» που ο Κ13 κυνηγά.
  //
  // 🔴 **Ο ΔΙΟΙΚΗΤΙΚΟΣ ΑΞΟΝΑΣ ΔΕΝ ΠΑΡΑΓΕΙ ΚΕΝΤΡΟ — ΚΑΙ ΠΛΕΟΝ ΕΙΝΑΙ ΕΠΙΛΟΓΗ, ΟΧΙ ΑΝΑΓΚΗ.**
  //    ⚠️ **Ήταν «δομικά αδύνατο» μέχρι τη Φ2.5** *(και το σχόλιο εδώ το έλεγε)*: δεν
  //    υπήρχε γεωμετρία ορίων, άρα το *«πού είναι το κέντρο του Δήμου Θέρμης;»* **δεν
  //    είχε απάντηση**. Τώρα έχει — το `GeoFootprint.center` είναι ακριβώς αυτό.
  //
  //    ⛔ **ΚΑΙ ΠΑΡ' ΟΛΑ ΑΥΤΑ ΔΕΝ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ ΓΙΑ ΣΕΙΡΑ**, σκόπιμα: το να ταξινομεί
  //    ο κατάλογος «κατά απόσταση από το κέντρο του δήμου που ρώτησες» είναι **αλλαγή
  //    προϊόντος** — και σε δήμο-αρχιπέλαγος το κεντροειδές μπορεί να πέφτει **στη
  //    θάλασσα**, δηλαδή η κατάταξη θα ήταν αυθαίρετη ενώ θα **έμοιαζε** με αρχή (Κ13).
  //    Όσο δεν το ζητά ο Giorgio, η σειρά για διοικητικό ερώτημα μένει **ισότιμη**:
  //    φίλτρο χωρίς καμία κατάταξη.
  const near = whereCenter(filters.where);
  const { agencies, loading, error } = usePublicAgencies(near);

  // 🔑 **Η ΙΕΡΑΡΧΙΑ ΜΠΑΙΝΕΙ ΜΕ ΕΝΕΣΗ** (ADR-846): το `showcase-filter` είναι **καθαρό
  //    φύλλο** και δεν επιτρέπεται να εισάγει hook. Ο {@link useCoverageResolvers}
  //    παρακάτω δίνει τους δύο αναγνώστες· εδώ ρωτιέται **μόνο** η αναμονή, γιατί το
  //    `lineageIdsOf` είναι module-level και η ταυτότητά του δεν αλλάζει όταν φτάσει.
  const { isLoading: hierarchyLoading } = useAdministrativeHierarchy();

  // 🏆 **Φ2.5 — ΤΑ ΑΠΟΤΥΠΩΜΑΤΑ ΚΛΕΙΝΟΥΝ ΤΑ ΔΥΟ ΜΕΙΚΤΑ ΚΕΛΙΑ** *(ADR-846)*: δηλωμένη
  //    **ακτίνα** εναντίον **διοικητικού** ερωτήματος, και διοικητική δήλωση εναντίον
  //    **κυκλικού** ερωτήματος. Μέχρι τη Φ2 και τα δύο απαντούσαν πάντα `unknown`.
  //
  // 🔑 **Η ταυτότητα του αντικειμένου δεν χτίζεται πια εδώ** — το μάθημα της §6.2 *(η
  //    ταυτότητα αλλάζει ακριβώς όταν φτάνουν τα δεδομένα, αλλιώς το `useMemo` παρακάτω
  //    παγώνει στο «δεν ξέρω» για όλη τη ζωή της σελίδας)* ζει πλέον **μία φορά**, στον
  //    {@link useCoverageResolvers}. Ήταν γραμμένο **κατά λέξη σε τρία σημεία**.
  const { isLoading: footprintsLoading, resolvers: coverageResolvers } = useCoverageResolvers();

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
  //
  // ⚠️ **ΟΣΟ Η ΙΕΡΑΡΧΙΑ ΔΕΝ ΕΧΕΙ ΦΟΡΤΩΣΕΙ, Ο ΔΙΟΙΚΗΤΙΚΟΣ ΑΞΟΝΑΣ ΔΕΝ ΕΦΑΡΜΟΖΕΤΑΙ.**
  //    Η εναλλακτική είναι χειρότερη από αργή: με κενή γενεαλογία **κάθε** βιτρίνα
  //    απαντά `disjoint`, δηλαδή η οθόνη θα έλεγε *«κανείς δεν ταιριάζει»* — ψέμα, για
  //    τα πρώτα ms κάθε επίσκεψης. «Άγνωστο ≠ κενό» (N.12): δείχνουμε **όλους** και το
  //    **λέμε** (`areaLoading`), αντί να δείξουμε **κανέναν** σιωπηλά.
  //
  // ⚠️ **ΚΑΙ ΤΑ ΑΠΟΤΥΠΩΜΑΤΑ ΜΠΑΙΝΟΥΝ ΣΤΗΝ ΙΔΙΑ ΑΝΑΜΟΝΗ, ΓΙΑ ΑΛΛΟΝ ΛΟΓΟ** *(Φ2.5)*. Η
  //    απουσία τους **δεν** κόβει κανέναν — δίνει `unknown`, που ο κατάλογος κρατά. Θα
  //    ήταν λοιπόν *σωστό* να μην περιμένουμε. Θα ήταν όμως και **ανήσυχο**: ο
  //    επισκέπτης θα έβλεπε μια λίστα να **στενεύει μόνη της** ένα δευτερόλεπτο αφότου
  //    σταμάτησε να φορτώνει, χωρίς να έχει αγγίξει τίποτα. Προτιμάμε να το **πούμε**
  //    (`areaLoading`) και μετά να δείξουμε **ένα** αποτέλεσμα — ίδιο ήθος με τον
  //    διοικητικό άξονα, χωρίς να δανειστούμε τη δικαιολόγησή του.
  const areaPending =
    filters.where !== null &&
    ((hierarchyLoading && isAdministrativeWhere(filters.where)) || footprintsLoading);
  const visible = React.useMemo(
    () =>
      areaPending
        ? agencies
        : applyShowcaseFilters(agencies, filters, coverageResolvers),
    [agencies, filters, areaPending, coverageResolvers],
  );
  const options = React.useMemo(() => occupationOptions(agencies, locale), [agencies, locale]);
  const filtering = hasActiveFilters(filters);

  // 🏆 **ΤΟ ΣΗΜΕΙΟ ΑΠΟΚΤΑ ΟΝΟΜΑ — ΚΑΙ ΜΕΤΡΙΕΤΑΙ ΕΔΩ, ΜΙΑ ΦΟΡΑ** *(ADR-846 §9 #12)*.
  //
  // 🔑 **Δύο οθόνες ρωτούν το ίδιο**: ο υπαινιγμός κάτω από τον επιλογέα περιοχής και το
  //    αφαιρούμενο σημάδι πάνω από τα αποτελέσματα. Δύο κλήσεις του hook θα ήταν **δύο
  //    απαντήσεις στο ίδιο ερώτημα** — δουλεύουν σήμερα, αποκλίνουν αύριο. Η φωνή
  //    υπολογίζεται **εδώ** και ταξιδεύει ως δεδομένο, ίδιο ιδίωμα με το `coverageResolvers`.
  //
  // ⚠️ **Καμία αναμονή γι' αυτό, επίτηδες**: όσο τα αποτυπώματα ή η ιεραρχία δεν έχουν
  //    φτάσει, το αγκυροβόλιο είναι `null` ⇒ η φωνή λέει *«το σημείο που ορίσατε»*, που
  //    είναι **αληθές σε κάθε στιγμή**. Το `areaPending` υπάρχει για το **φιλτράρισμα**,
  //    όπου η αγνωσία θα άλλαζε το **αποτέλεσμα**· εδώ αλλάζει μόνο πόσο **ειδικά** το
  //    λέμε. Μια δεύτερη αναμονή θα καθυστερούσε την οθόνη για **καλλωπισμό**.
  const anchorName = useCircleAnchorName(filters.where);
  const whereVoice = React.useMemo(
    () => showcaseWhereVoice(filters.where, anchorName),
    [filters.where, anchorName],
  );

  return (
    <ShellSurface as="main" measure="wide" className="gap-y-6">
      {/*
        🖼️ **Η ΑΚΤΙΝΑ ΤΩΝ ΕΠΑΓΓΕΛΜΑΤΙΩΝ (ADR-777 §8.82)** — ο **κοινός** ήρωας του κόμβου,
        με **τη δική του** εικόνα και **τη δική του** ερώτηση: ειδικότητα + περιοχή, όπως
        Houzz / Zillow `/professionals`. **Άμεσο τέκνο** του μέτρου, αλλιώς το breakout
        μένει σιωπηλά στη στήλη.

        🔑 **ΤΑ ΦΙΛΤΡΑ ΜΠΗΚΑΝ ΜΕΣΑ ΣΤΟΝ ΗΡΩΑ — ΔΕΝ ΓΡΑΦΤΗΚΕ ΔΕΥΤΕΡΟ ΠΕΔΙΟ.** Το
        `PlaceSearchBox` της αρχικής **πλοηγεί** προς εδώ· εδώ ζει ήδη το χειριστήριο που
        **είναι** η κατάσταση της διεύθυνσης. Δύο χειριστήρια για τα ίδια `?occupation` και
        `?where` στην ίδια σελίδα θα διαφωνούσαν στην πρώτη αλλαγή.

        🔑 Η ΟΥΔΕΤΕΡΟΤΗΤΑ ΛΕΓΕΤΑΙ, ΔΕΝ ΥΠΟΝΟΕΙΤΑΙ — ο υπότιτλος είναι το `lead`: ο επισκέπτης
        κάθε άλλου καταλόγου έχει μάθει ότι η πρώτη θέση αγοράζεται· αν δεν του πούμε ότι εδώ
        δεν αγοράζεται, θα το υποθέσει.

        ⚠️ Τα χειριστήρια εμφανίζονται **μόνο όταν υπάρχει πληθυσμός**: επιλογές πάνω σε άδειο
        κατάλογο θα υπόσχονταν κόσμο που δεν υπάρχει — τότε ο ήρωας δείχνει **μόνο** τίτλο.
      */}
      <LandingHero
        image={LANDING_HERO_IMAGES.pros}
        title={t(DIRECTORY_KEYS.title)}
        subtitle={t(DIRECTORY_KEYS.lead)}
      >
        {!loading && error === null && agencies.length > 0 && (
          <AgencyDirectoryFilters
            filters={filters}
            options={options}
            locale={locale}
            onChange={apply}
            onClear={filtering ? () => apply(EMPTY_SHOWCASE_FILTERS) : null}
            whereVoice={whereVoice}
          />
        )}
      </LandingHero>

      {/*
        🔴 **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΕΡΩΤΗΜΑΤΟΣ ΑΝΕΒΗΚΕ ΠΑΝΩ ΑΠΟ ΤΟΥΣ ΚΛΑΔΟΥΣ** *(§9 #12)*, και
        δεν είναι αναδιοργάνωση: ο μετρητής ζούσε **μέσα** στον κλάδο των αποτελεσμάτων,
        άρα ο επισκέπτης που φιλτράρισε σε **μηδέν** έβλεπε *«Κανείς δεν ταιριάζει»*
        **χωρίς παρονομαστή** — δηλαδή χωρίς το «από 22» που εξηγεί ότι φταίει η επιλογή
        του, όχι ο κατάλογος. Το «7 από 34» της **Φ4** ίσχυε παντού **εκτός** από την
        περίπτωση που το χρειαζόταν περισσότερο.

        🔑 **Και είναι η προϋπόθεση της εστίασης**: η περιοχή **επιβιώνει** της αφαίρεσης
        του σημαδιού, άρα υπάρχει γείτονας να δεχτεί την εστίαση. Δες `DirectoryQueryState`.
      */}
      {!loading && error === null && agencies.length > 0 && (
        <DirectoryQueryState
          voice={whereVoice}
          shown={visible.length}
          total={agencies.length}
          filtering={filtering}
          onClearWhere={() => apply({ ...filters, where: null })}
        />
      )}

      {/*
        🔴 **ΤΟ «ΔΕΝ ΞΕΡΩ» ΛΕΓΕΤΑΙ** (ADR-846). Όσο η ιεραρχία των 4,1 MB δεν έχει
        φορτώσει, ο διοικητικός άξονας **δεν εφαρμόζεται** — και ο επισκέπτης βλέπει
        **όλους**, ενώ έχει ζητήσει περιοχή. Σιωπή εδώ θα ήταν χειρότερη από αργή
        οθόνη: ο άνθρωπος θα συμπέραινε ότι *«όλοι αυτοί δουλεύουν εκεί»*.
      */}
      {areaPending && (
        <p role="status" className="m-0 text-sm text-muted-foreground">
          {t(DIRECTORY_KEYS.areaLoading)}
        </p>
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
          {/* 🔑 **Ο ΜΕΤΡΗΤΗΣ ΕΦΥΓΕ ΣΤΟ {@link DirectoryQueryState}** *(§9 #12)* — μαζί με
              το αφαιρούμενο σημάδι, γιατί λένε **τα δύο μισά της ίδιας πρότασης**. Εκεί
              απέκτησε και `role="status"`: η αλλαγή πλήθους **ανακοινώνεται** πλέον, αντί
              να τυπώνεται σιωπηλά για όποιον τη βλέπει. */}
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {visible.map((profile) => (
              <AgencyCard
                key={profile.companyId}
                profile={profile}
                where={filters.where}
              />
            ))}
          </ul>
        </section>
      )}
    </ShellSurface>
  );
}
