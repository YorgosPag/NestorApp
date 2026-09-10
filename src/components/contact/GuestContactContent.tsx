'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΣΥΝΔΕΣΜΟΥ** — «το μήνυμά σας έφυγε», και τι μπορείτε τώρα.
 * @related app/(auth)/contact/[token]/page.tsx (ο διακομιστής που ήδη εξαργύρωσε) · ADR-844 Β5
 * @module components/contact/GuestContactContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΟΤΑΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΤΡΕΧΕΙ, **ΟΛΑ ΕΧΟΥΝ ΗΔΗ ΓΙΝΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πράξη γράφτηκε στον **διακομιστή**, πριν βαφτεί ένα εικονοστοιχείο. Αυτή η οθόνη
 * κάνει **ένα** πράγμα δικό της: **υιοθετεί τη συνεδρία**. Και αυτό είναι **άνεση** —
 * αν αποτύχει, ο άνθρωπος έχασε τον εύκολο δρόμο προς τις επαφές του, **όχι** την επαφή.
 *
 * ⛔ **ΜΗΝ βάλεις εδώ retry, ούτε «δοκιμάστε ξανά».** Δεν υπάρχει τίποτα να
 * ξαναπροσπαθήσει: η πρόσκληση είναι **μιας χρήσης** και έχει ήδη σφραγιστεί. Ένα
 * κουμπί επανάληψης θα υποσχόταν κάτι που **ο σχεδιασμός απαγορεύει**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΣΥΝΔΕΣΗΣ, ΚΑΙ Η ΜΕΣΑΙΑ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `signing-in` → `signed-in` **ή** `not-signed-in`. Χωρίς την πρώτη, ο σύνδεσμος
 * *«Δείτε τις επαφές σας»* θα ήταν πατήσιμος **πριν** στηθεί το cookie — δηλαδή θα
 * έστελνε τον άνθρωπο σε **401** αμέσως μετά από επιτυχία.
 */

import React from 'react';

// 🧩 **ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/contact/[token]`.**
//
// Το `property-market` έπαψε να ταξιδεύει **ολόκληρο** (§8.38). Χωρίς αυτή τη γραμμή, η
// οθόνη θα έβαφε **ωμά κλειδιά στο πρώτο καρέ** — και εδώ είναι το χειρότερο δυνατό
// σημείο: ο άνθρωπος φτάνει **από email**, χωρίς λογαριασμό, χωρίς προηγούμενη πλοήγηση,
// και αυτή η σελίδα είναι **η μόνη πληροφορία που έχει** για το αν έφυγε το μήνυμά του.
//
// 🔴 **ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`**: εκείνο είναι Server Component, και τα Server/Client
// δέντρα έχουν **ΞΕΧΩΡΙΣΤΟΥΣ γράφους module** — εγγραφή από εκεί θα έγραφε σε **άλλο**
// στιγμιότυπο i18next: πράσινη κλήση που δεν κάνει τίποτα.
//
// ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE** — με `import()` το ωμό κλειδί απλώς
// μετακομίζει σε «ένα καρέ» και κρύβεται από το CHECK 3.51.
import routeSlice from '@/i18n/generated/routes/contact__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import { adoptCitizenSession } from '@/auth/citizen-session';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { Link } from '@/lib/workspace/navigation';
import { AUTH_ROUTES } from '@/lib/routes/authRoutes';
import { firstContactTargetHref } from '@/lib/contact/first-contact-target-href';
import { searchLandingHref } from '@/lib/listings/listing-routes';
import { MY_FIRST_CONTACTS_ROUTE } from '@/lib/contact/first-contact-routes';

import type { GuestContactLinkView, GuestContactSetback } from './guest-contact-view';
import { ACT_KEYS, FIRST_CONTACT_NS } from './first-contact-labels';
import { GUEST_KEYS, INVITATION_REFUSAL_KEYS, LINK_KEYS } from './first-contact-guest-labels';
import { InvalidBody, RefusedBody } from './FirstContactOutcomeNotice';

registerRouteSlice(routeSlice);

/** Πού βρίσκεται η **υιοθέτηση** — ρητά, ποτέ `isLoading` + `error` μαζί (N.7.2 #3). */
type SignInPhase = 'signing-in' | 'signed-in' | 'not-signed-in';

export function GuestContactContent({
  view,
}: {
  readonly view: GuestContactLinkView;
}): React.ReactElement {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const layout = useLayoutClasses();
  const [phase, setPhase] = React.useState<SignInPhase>('signing-in');

  // ⚠️ **Η εξάρτηση είναι το ΚΛΕΙΔΙ, όχι το `view`.** Το `view` έρχεται από Server
  //    Component και είναι **νέο αντικείμενο σε κάθε απόδοση**: με αυτό στις
  //    εξαρτήσεις, η σύνδεση θα ξανάτρεχε ατέρμονα με **ήδη εξαργυρωμένο** κλειδί.
  //    Ίδιο μάθημα με το `target.kind`/`target.listingId` του `FirstContactAction`.
  const customToken = view.kind === 'done' ? view.customToken : null;

  React.useEffect(() => {
    if (customToken === null) return;

    let ignore = false;
    void adoptCitizenSession(customToken).then((outcome) => {
      if (!ignore) setPhase(outcome.kind === 'signed-in' ? 'signed-in' : 'not-signed-in');
    });

    return () => {
      ignore = true;
    };
  }, [customToken]);

  return (
    // ⚠️ **`<section>` και `<h1>`, όχι `<div>` + `<p class="big">`** (N.4): είναι
    //    **ολόκληρη σελίδα** και ο τίτλος της είναι η πρώτη πληροφορία που ακούει ο
    //    χρήστης αναγνώστη οθόνης όταν προσγειώνεται από το email.
    // 🔑 **ΤΟ ΠΛΑΤΟΣ ΤΟ ΚΑΤΕΧΕΙ Η ΚΑΡΤΑ — ΑΛΛΑ ΜΕ ΟΝΟΜΑ** (ADR-797 / CHECK 3.63).
    //    Το `(auth)/layout.tsx` δηλώνει ρητά «κανένα `measure`: υπάρχει **κάρτα** που
    //    κεντράρεται, και το πλάτος της το κατέχει η κάρτα». Άρα το ταβάνι είναι
    //    **νόμιμο εδώ** — ήταν όμως γραμμένο ως ωμό `mx-auto w-full max-w-md`, δηλαδή
    //    **τέταρτο** αντίγραφο μιας κλίμακας που ζει ήδη ονομασμένη. Το
    //    `layout.cardAuthWidth` είναι **η ίδια ακριβώς συμβολοσειρά** — μηδέν οπτική
    //    αλλαγή, και η επόμενη αλλαγή κλίμακας γίνεται σε **ένα** σημείο.
    <section className={`${layout.cardAuthWidth} flex flex-col gap-4 rounded-lg border border-border bg-card p-6`}>
      {view.kind === 'done' ? (
        <DoneBody created={view.created} phase={phase} />
      ) : (
        <>
          <h1 className="m-0 text-xl font-semibold">{t(LINK_KEYS.refusedTitle)}</h1>
          <SetbackBody view={view} />
          {/*
            🔴 **Η ΔΙΕΞΟΔΟΣ ΕΙΝΑΙ ΑΔΕΛΦΟΣ ΤΟΥ ΛΟΓΟΥ, ΟΧΙ ΠΑΙΔΙ ΤΟΥ** — και είναι το
            μόνο που κάνει τον φρουρό να δουλεύει. Μέσα στο {@link SetbackBody} θα
            έπρεπε να γραφτεί **πέντε** φορές, μία ανά σκέλος του `switch`, και ο
            **έκτος** συγγραφέας θα την ξεχνούσε — ακριβώς όπως ξεχάστηκε την πρώτη
            φορά. Εδώ έξω, **καμία** άρνηση δεν μπορεί να βγει χωρίς αυτήν.
          */}
          <SetbackExit target={view.target} />
        </>
      )}
    </section>
  );
}

/**
 * **Έγινε.**
 *
 * 🔑 **`created: false` ΕΙΝΑΙ ΕΠΙΤΥΧΙΑ** (Κ7): ο άνθρωπος είχε ήδη ανοιχτή την πράξη —
 * ίδια ουδέτερη μορφή, μόνο ο τίτλος αλλάζει. Ένα προειδοποιητικό χρώμα εδώ θα του
 * έλεγε ότι έκανε λάθος, ενώ **δεν έκανε**.
 */
function DoneBody({
  created,
  phase,
}: {
  readonly created: boolean;
  readonly phase: SignInPhase;
}): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  return (
    <>
      <h1 className="m-0 text-xl font-semibold">
        {t(created ? LINK_KEYS.doneTitle : LINK_KEYS.alreadyTitle)}
      </h1>
      <p className="m-0 text-muted-foreground">
        {t(created ? LINK_KEYS.doneLead : LINK_KEYS.alreadyLead)}
      </p>
      <SignInStatus phase={phase} />
    </>
  );
}

/**
 * ⚠️ **Ο σύνδεσμος προς τις επαφές εμφανίζεται ΜΟΝΟ όταν η συνεδρία στέκει.** Πριν από
 * αυτό θα ήταν κουμπί προς **401**· και όταν η σύνδεση αποτύχει, ο άνθρωπος χρειάζεται
 * **άλλη** διέξοδο (τη σελίδα σύνδεσης), όχι την ίδια που δεν θα δουλέψει.
 */
function SignInStatus({ phase }: { readonly phase: SignInPhase }): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  if (phase === 'signing-in') {
    return (
      <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
        {t(LINK_KEYS.signingIn)}
      </p>
    );
  }

  if (phase === 'signed-in') {
    return (
      <Link
        href={MY_FIRST_CONTACTS_ROUTE}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t(ACT_KEYS.seeMine)}
      </Link>
    );
  }

  return (
    <>
      <p className="m-0 text-sm text-muted-foreground">{t(LINK_KEYS.signInFailed)}</p>
      <Link
        href={AUTH_ROUTES.login}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t(LINK_KEYS.signIn)}
      </Link>
    </>
  );
}

/**
 * **Δεν έγινε** — και ο λόγος έχει **όνομα**, πάντα.
 *
 * ⛔ **ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ ΔΕΥΤΕΡΗ ΦΟΡΑ**: οι αρνήσεις της **πράξης** και
 * τα **αμετάβλητα** τα αποδίδουν τα {@link RefusedBody} / {@link InvalidBody}, που
 * ζωγραφίζουν ήδη τους ίδιους κωδικούς μέσα στον διάλογο. Ένα αντίγραφο εδώ θα ξεχνούσε
 * τον επόμενο κωδικό — σε **αυτή** τη σελίδα, όπου ο άνθρωπος δεν έχει άλλη πληροφορία.
 */
function SetbackBody({
  view,
}: {
  readonly view: GuestContactSetback;
}): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  switch (view.kind) {
    case 'link-refused':
      return <p className="m-0">{t(INVITATION_REFUSAL_KEYS[view.reason])}</p>;
    case 'contact-refused':
      return <RefusedBody reason={view.reason} t={t} />;
    case 'invalid':
      return <InvalidBody violations={view.violations} t={t} />;
    case 'identity-refused':
      return <p className="m-0">{t(GUEST_KEYS.identityRefused)}</p>;
    case 'unavailable':
      return <p className="m-0">{t(GUEST_KEYS.writeFailed)}</p>;
  }
}

/**
 * **Η ΕΠΟΜΕΝΗ ΚΙΝΗΣΗ** — και είναι η θεραπεία ολόκληρου του αδιεξόδου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΕΛΕΓΕ Η ΟΘΟΝΗ ΠΡΙΝ, ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ ΑΔΥΝΑΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Ο σύνδεσμος έληξε. **Πατήστε ξανά «Πλησιάστε»** για να πάρετε νέο.»* — ειπωμένο
 * σε άνθρωπο που στέκεται στο `/contact/<token>`, όπου **δεν υπάρχει** κουμπί
 * «Πλησιάστε», **δεν υπάρχει** δρόμος πίσω, και ο ίδιος **δεν θυμάται ποια αγγελία
 * ήταν** *(πέρασαν οκτώ μέρες, και ήρθε από email)*.
 *
 * 🏆 **Καμία πύλη ακινήτων δεν το κάνει αυτό**: Zillow · Idealista · Airbnb δίνουν
 * **πάντα** «επιστροφή στο ακίνητο» ή «ζήτα νέο σύνδεσμο». Το πρότυπο *dead-end
 * recovery* του NN/g το λέει κατηγορηματικά: **κάθε οθόνη σφάλματος οφείλει να
 * προσφέρει την επόμενη κίνηση, όχι να την περιγράφει**.
 *
 * ⚠️ **ΓΙΑΤΙ ΔΕΝ ΞΕΧΩΡΙΖΕΙ ΑΝΑ ΛΟΓΟ ΑΡΝΗΣΗΣ** — και είναι απόφαση, όχι τεμπελιά. Ο
 * λόγος αλλάζει το **κείμενο** *(το λέει το {@link SetbackBody})*· τη **διαδρομή**
 * δεν την αλλάζει: και οι επτά καταλήγουν στο *«γύρνα εκεί που ήσουν και ξαναζήτα»*,
 * γιατί η σελίδα **δεν έχει** τη φόρμα για να ξαναστείλει μόνη της. Ένας πίνακας
 * διεξόδων ανά λόγο θα ήταν επτά γραμμές με **την ίδια** τιμή.
 *
 * ⛔ **Ο `professional` ΠΕΦΤΕΙ ΣΤΗ ΓΕΝΙΚΗ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΑΒΛΕΨΙΑ** *(ADR-844 §7.1)*:
 * κρατά `agencyCompanyId`, η βιτρίνα ζει σε `alias`. Ένα μαντεμένο
 * `/pro/${agencyCompanyId}` θα ήταν **404** — αδιέξοδο με κουμπί, δηλαδή χειρότερο
 * από αδιέξοδο χωρίς.
 */
function SetbackExit({
  target,
}: {
  readonly target: GuestContactSetback['target'];
}): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const href = target === null ? null : firstContactTargetHref(target);

  // ⚠️ **Δύο ξεχωριστά `<Link>`, ΟΧΙ ένα με τερνάριο στο `href`.** Το
  //    `listing-routes.ts` το έχει μετρήσει: το `typedHref` μέσα σε τερνάριο
  //    **φαρδαίνει και τα δύο άκρα** σε σκέτο `string`, και το σύνορο πλοήγησης
  //    (CHECK 3.61) χάνει τον τύπο που υπάρχει για να το φυλάει.
  if (href === null) {
    return (
      <Link
        href={searchLandingHref()}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t(LINK_KEYS.backToSearch)}
      </Link>
    );
  }

  return (
    <Link href={href} className="font-medium text-foreground underline underline-offset-4">
      {t(LINK_KEYS.backToListing)}
    </Link>
  );
}
