'use client';

/**
 * @fileoverview **Η ΦΟΡΜΑ ΤΟΥ Σ1** — ο ιδιώτης προτείνει όρους σε ένα γραφείο.
 * @related ADR-827 §9.17 · app/api/mandate-requests/route.ts · lib/mandate/mandate-request-form-values.ts
 * @module components/mandate/MandateRequestFormContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΛΑΤΟΣ ΚΑΙ ΤΟ ΚΕΝΟ ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΕΔΩ — ΚΑΙ ΚΑΝΕΝΑ `flex` ΣΤΗΝ ΕΠΙΦΑΝΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας `[data-shell-measure] { display: grid; … }` φτιάχνει τη **στήλη** του
 * ταβανιού. Ένα `className="flex flex-col"` στην ίδια την επιφάνεια **νικά κατά σειρά
 * πηγής** *(το `shell-surface.css` φορτώνεται ΠΡΙΝ τα `@tailwind`, ίδια ειδικότητα)*
 * ⇒ η στήλη **δεν υπάρχει ποτέ**. ⚠️ Και η **CHECK 3.63 μένει ΠΡΑΣΙΝΗ**: ρωτά *«έγραψες
 * γεωμετρία με το χέρι;»*, όχι *«ισχύει το `measure` που δήλωσες;»*. Μετρήθηκε ζωντανά
 * στο §9.15. Το `gap-*` **μένει**: δουλεύει σε grid.
 *
 * ⛔ **ΚΑΝΕΝΑ `<SelectItem value="">`** (CHECK 3.48): το Radix **δεσμεύει** το `''` και
 * ένα κενό `value` πετά σε χρόνο εκτέλεσης, ρίχνοντας **ΟΛΗ** την επιφάνεια. Το
 * «δεν διάλεξα ακόμη» εκφράζεται με `placeholder`, ποτέ με κενή επιλογή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΕΧΕΙ ΑΥΤΗ Η ΦΟΡΜΑ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΟΛΟ ΝΟΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Κανένα «προαιρετικό μήνυμα προς το γραφείο».** Όσο δελεαστικό κι αν φαίνεται,
 * είναι **ελεύθερο κείμενο** — δηλαδή η πόρτα από την οποία περνά *«τηλ. 69…»*. Θα
 * ακύρωνε **και** το §8.2 **και** την τυφλή κρίση του §9.17 θ, με **μηδενική** αλλαγή
 * σχήματος και χωρίς καμία πύλη να το δει.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShellSurface } from '@/core/containers/ShellSurface';
import { DraftFormShell, type DraftSubmitState } from '@/components/shared/forms/DraftFormShell';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
// 🔴 **ΤΟ ΣΥΝΟΡΟ, ΟΧΙ ΤΟ ΩΜΟ `next/navigation`** (ADR-787, CHECK 3.61): και τα δύο
// —σύνδεσμος και δρομολογητής— ρωτούν τον ΙΔΙΟ κριτή για το αν η διεύθυνση ανήκει σε
// χώρο. Το `/pro/<ψευδώνυμο>` είναι δηλωμένο `OUTSIDE_WORKSPACE`, άρα βγαίνει άθικτο —
// αλλά με ωμό `useRouter` η ορθότητα θα ζούσε στην **τύχη**: η ίδια γραμμή θα έστελνε
// τον άνθρωπο εκτός χώρου τη μέρα που η δήλωση άλλαζε, χωρίς κανένα κόκκινο.
import { Link, useRouter } from '@/lib/workspace/navigation';
// ⛔ ΤΟ ΡΟΛΟΪ ΕΧΕΙ ΜΙΑ ΠΗΓΗ (module `date-local`, CHECK 3.7): ωμό
// `new Date().toISOString()` εδώ θα ήταν η Ν-οστή γραφή του ίδιου στιγμιότυπου, και εδώ
// η στιγμή **κρίνεται** — από αυτήν ξεκινά ο νόμιμος ορίζοντας λήξης (ΑΚ 243).
import { nowISO } from '@/lib/date-local';
import { endOfDay, startOfDay } from '@/lib/mandate/mandate-term-window';
import {
  emptyMandateRequestForm,
  mandateRequestFormBlockers,
  proposedTermsFrom,
  type MandateRequestFormValues,
} from '@/lib/mandate/mandate-request-form-values';
import { useMyOwnerProperties } from '@/services/realtime/hooks/useMyOwnerProperties';
import { LISTING_AGREEMENTS } from '@/types/listing-agreement';
import { LISTING_AGREEMENT_I18N_KEYS } from '@/components/mandate/listing-agreement-labels';
import { OFFER_KIND_I18N_KEYS } from '@/components/mandate/offer-kind-labels';
import { OFFER_KINDS, type OfferKind } from '@/types/property-offers';
import { FormOptionsField } from '@/components/shared/forms/form-field-primitives';
// 🏆 ADR-832 §4 — ο ιδιοκτήτης βλέπει ΠΡΙΝ προσπαθήσει. Ο **κανόνας** ζει στο
//    `mandate-occupancy-notice` και καλεί τον ΙΔΙΟ κριτή με τον διακομιστή· εδώ
//    γίνεται μόνο η σύνδεση με τα πληκτρολογημένα.
import { occupancyNotice } from '@/lib/mandate/mandate-occupancy-notice';
import { mandatesOf } from '@/types/owner-property-mandate';
const MandateOccupancyPanel = dynamic(
  () => import('@/components/mandate/MandateOccupancyPanel').then((m) => m.MandateOccupancyPanel),
  { ssr: false },
);
import type { MandateRequestRejection } from '@/services/mandate/mandate-request.service';
import type { OwnerProperty } from '@/types/owner-property';
import type { ProposedMandateTerms } from '@/types/mandate-request';
// 🔴 **Ο ΦΡΟΥΡΟΣ ΤΟΥ ΑΦΜ ΜΕΤΑΚΟΜΙΣΕ ΕΔΩ** (ADR-827 §9.21 ι #1 · §9.20 β).
//    Ο κριτής, ο γραφέας και η συγχώνευση ζουν στα SSoT τους — αυτή η φόρμα **ρωτά**,
//    δεν κρίνει και δεν γράφει.
import { withExtraBlockers, type DraftFormValidation } from '@/lib/forms/draft-validation';
import { TaxIdentityField } from '@/components/account/TaxIdentityField';
import { useInFlowTaxIdentity } from '@/hooks/account/useInFlowTaxIdentity';

import { CompensationField, Field } from './mandate-request-form-fields';
import {
  MANDATE_REQUEST_NS,
  REJECTION_KEYS,
  SCREEN_KEYS,
  useMandateRequestFormText,
  type MandateRequestBlocker,
} from './mandate-request-form-labels';

// 🔴 ADR-744 §18 — Η ΔΗΛΩΣΗ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΔΟΣΗ. Η εγγραφή ζει στο **client**
// component και όχι στο `page.tsx`: ένα `page.tsx` που είναι server component θα το
// εισήγαγε μόνο στον διακομιστή ⇒ ωμά κλειδιά στον πελάτη (Π6).
import routeSlice from '@/i18n/generated/routes/offers__mandate__new.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/** Ό,τι έμαθε η οθόνη μετά την υποβολή — ποτέ `boolean` + μήνυμα. */
type SubmitOutcome =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sent'; readonly created: boolean }
  | { readonly kind: 'refused'; readonly reason: MandateRequestRejection }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με άρνηση (N.12). */
  | { readonly kind: 'unverified' };

export interface MandateRequestFormContentProps {
  /** Ο οργανισμός του γραφείου, λυμένος από το ψευδώνυμο στον **διακομιστή**. */
  readonly agencyCompanyId: string;
  /** Το όνομα που βλέπει ο άνθρωπος — ποτέ ταυτότητα στην οθόνη. */
  readonly agencyDisplayName: string;
  /** Η διεύθυνση επιστροφής στη βιτρίνα. */
  readonly agencyHref: string;
}

/** Ο επιλογέας ακινήτου — **μόνο** ό,τι μπορεί πράγματι να ανατεθεί (Δ3). */
function assignable(properties: readonly OwnerProperty[]): readonly OwnerProperty[] {
  // ⚠️ Το `isPersonalCustody` το εφαρμόζει **ήδη** ο hook, σε δύο σημεία. Εδώ μένουν
  //    τα δύο που ο hook δεν ξέρει: **ζωντανή** και **χωρίς εντολή**. Ο διακομιστής
  //    τα ξαναρωτά — αυτό εδώ είναι για να μη δει ο άνθρωπος επιλογή που θα του
  //    απορριφθεί (N.7.2 #4: κύριος δρόμος + δίχτυ).
  return properties.filter(
    // 🔴 **ΠΑΥΕΙ ΝΑ ΑΠΑΙΤΕΙ «ΚΑΜΙΑ ΕΝΤΟΛΗ»** (ADR-832). Έγραφε `mandate.kind === 'self'`
    //    ⇒ ακίνητο με **απλή** εντολή σε ένα γραφείο εξαφανιζόταν από τον επιλογέα, και
    //    ο ιδιοκτήτης δεν μάθαινε ποτέ γιατί λείπει το δικό του σπίτι. Ο πραγματικός
    //    κριτής (σύγκρουση) χρειάζεται τους **όρους**, που εδώ δεν είναι γνωστοί: ο
    //    διακομιστής τους κρίνει, και η άρνηση επιστρέφει **με όνομα**.
    (property) => property.lifecycle === 'listed',
  );
}

export function MandateRequestFormContent({
  agencyCompanyId,
  agencyDisplayName,
  agencyHref,
}: MandateRequestFormContentProps): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation([MANDATE_REQUEST_NS]);
  const formText = useMandateRequestFormText();

  const [submitState, setSubmitState] = React.useState<DraftSubmitState>('idle');
  const [outcome, setOutcome] = React.useState<SubmitOutcome>({ kind: 'idle' });

  // ⚠️ Το ρολόι διαβάζεται **μία φορά**, στην προσάρτηση: μια φόρμα που ξαναϋπολογίζει
  //    το «σήμερα» σε κάθε πληκτρολόγηση θα μετακινούσε το νόμιμο ανώτατο κάτω από τα
  //    δάχτυλα του ανθρώπου.
  const [todayISO] = React.useState(() => nowISO());

  const listings = useMyOwnerProperties(user?.uid ?? null);
  const choices = listings.state === 'ready' ? assignable(listings.properties) : [];

  const form = useForm<MandateRequestFormValues>({
    defaultValues: emptyMandateRequestForm(todayISO),
  });
  const values = form.watch();

  // ════════════════════════════════════════════════════════════════════════════
  // ΤΟ ΑΦΜ — Η ΤΑΥΤΟΤΗΤΑ ΠΟΥ ΘΑ ΜΠΕΙ ΣΤΗ ΣΥΜΒΑΣΗ (ADR-827 §9.21 ι #1)
  // ════════════════════════════════════════════════════════════════════════════
  //
  // 🔴 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ Σ3.** Πριν, ο ιδιώτης **χωρίς ΑΦΜ** υπέβαλλε
  //    κανονικά και το πρόβλημα το ανακάλυπτε **το γραφείο**, πατώντας «Αποδοχή»:
  //    άρνηση `identity-incomplete`, σε αδιέξοδο που **μόνο ο ιδιώτης** μπορούσε να
  //    λύσει και **δεν το έβλεπε**. Το §9.20 β το είχε ήδη γράψει — *just-in-time,
  //    ποτέ στην εγγραφή*: ζητιέται τη στιγμή που **η συναλλαγή** το χρειάζεται.
  //
  // ⚠️ **Ο ΕΛΕΓΧΟΣ ΤΟΥ Σ3 ΜΕΝΕΙ ΚΑΙ ΔΕΝ ΑΦΑΙΡΕΙΤΑΙ** — γίνεται **δίχτυ**
  //    (N.7.2 #4), παύει να είναι ο μόνος δρόμος. Παράγει **νομικό** κείμενο, και
  //    κανένας πελάτης δεν είναι φρουρός: αίτημα που παρακάμπτει αυτή τη φόρμα
  //    οφείλει να συναντήσει την ίδια άρνηση.
  //
  // 🔑 **Η ΠΟΛΙΤΙΚΗ ΖΕΙ ΣΤΟΝ HOOK** ({@link useInFlowTaxIdentity}): πότε γράφεται,
  //    τι σημαίνει το κενό, πότε δεν φεύγει αίτημα. Αυτή η φόρμα **ρωτά**, δεν κρίνει.
  const taxIdentity = useInFlowTaxIdentity();

  // ════════════════════════════════════════════════════════════════════════════
  // 🏆 Η ΚΑΤΑΛΗΨΗ, ΠΡΙΝ ΤΟ ΠΑΤΗΜΑ (ADR-832 §4 #2)
  // ════════════════════════════════════════════════════════════════════════════
  //
  // ⚠️ **ΔΕΝ είναι φρουρός και ΔΕΝ απενεργοποιεί το κουμπί.** Βλέπει ό,τι έχει ο
  //    πελάτης· ο διακομιστής κρίνει με τα **φρέσκα**, μέσα σε συναλλαγή. Ένα κουμπί
  //    κλειδωμένο από πρόβλεψη θα έκλεινε τον δρόμο σε άνθρωπο που έχει δίκιο.
  const selected = choices.find((property) => property.id === values.ownerPropertyId) ?? null;
  const notice = React.useMemo(() => {
    if (selected === null) return { kind: 'free' } as const;
    return occupancyNotice(
      // ⚠️ **`mandatesOf`, ΠΟΤΕ ωμό `.mandates`**: τα έγγραφα ιδιώτη της ζωντανής
      //    βάσης δεν έχουν τον πληθυντικό, και σκέτο `.length` πάνω τους ρίχνει τη
      //    σελίδα κάθε ιδιοκτήτη.
      mandatesOf(selected),
      // 🔑 **`null` όσο δεν έχει διαλέξει πράξεις** — χωρίς `scope` δεν υπάρχει
      //    ερώτημα σύγκρουσης, και η οθόνη δεν απαντά σε ερώτημα που δεν τέθηκε.
      values.scope.length === 0
        ? null
        : {
            agencyCompanyId,
            agreement: values.agreement,
            scope: values.scope,
            // 🔴 **ΤΗΝ ΙΔΙΑ ΣΤΙΓΜΗ ΠΟΥ ΥΠΟΒΑΛΛΕΙ, ΠΟΤΕ ΩΜΟ `yyyy-mm-dd`.** Το
            //    `proposedTermsFrom` στέλνει `startOfDay`/`endOfDay`· μια πρόβλεψη
            //    που κρίνει **μεσάνυχτα** και υποβάλλει **23:59** διαφωνεί με τον
            //    εαυτό της ακριβώς στο άκρο που έχει σημασία: τη **διαδοχή**.
            startsAt: startOfDay(values.startsOn),
            expiresAt: endOfDay(values.expiresOn),
          },
      todayISO,
    );
  }, [selected, values.scope, values.agreement, values.startsOn, values.expiresOn, agencyCompanyId, todayISO]);

  const baseValidation = React.useMemo<
    DraftFormValidation<ProposedMandateTerms, MandateRequestBlocker, never>
  >(() => {
    const blockers = mandateRequestFormBlockers(values, todayISO);
    return blockers.length === 0
      ? { kind: 'ready', draft: proposedTermsFrom(values) }
      : { kind: 'incomplete', malformed: [], blockers, violations: [] };
  }, [values, todayISO]);

  /**
   * 🔑 **Η ΣΥΓΧΩΝΕΥΣΗ ΖΕΙ ΣΤΟ SSoT, ΟΧΙ ΕΔΩ** — δεύτερος καταναλωτής του
   * {@link withExtraBlockers}, μετά τη φόρμα προσφοράς.
   *
   * Η τεκμηρίωσή του **προέβλεψε ονομαστικά αυτή τη στιγμή**: *«Μέχρι σήμερα η
   * συγχώνευση ήταν γραμμένη μέσα στο `OwnerPropertyFormContent`, για έναν
   * καταναλωτή (την εντολή). Με τον δεύτερο (**την ταυτότητα**) θα γινόταν δίδυμο —
   * και το δίδυμο δεν θα ήταν στον κώδικα αλλά στη **σειρά**»*.
   *
   * ⚠️ **ΜΙΑ λίστα, ποτέ δύο**: το εμπόδιο του ΑΦΜ εμφανίζεται στο **ίδιο**
   * `FormIssues` με τα υπόλοιπα, ώστε ο άνθρωπος να βλέπει **πόσο κοντά είναι**.
   * Δεύτερη λίστα «τι λείπει» θα τον άφηνε να διορθώσει τη μία και να μη μάθει ποτέ
   * γιατί το κουμπί μένει ανενεργό.
   */
  const validation = React.useMemo(
    () =>
      withExtraBlockers<ProposedMandateTerms, MandateRequestBlocker, never>(
        baseValidation,
        taxIdentity.blockers,
      ),
    [baseValidation, taxIdentity.blockers],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (validation.kind !== 'ready') return;

    setSubmitState('saving');
    setOutcome({ kind: 'idle' });

    const response = await fetch('/api/mandate-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ownerPropertyId: values.ownerPropertyId,
        agencyCompanyId,
        terms: validation.draft,
      }),
    }).catch(() => null);

    if (response === null) {
      setSubmitState('failed');
      return;
    }

    const body: unknown = await response.json().catch(() => null);
    setSubmitState('idle');
    setOutcome(readOutcome(response.status, body));
  }

  if (outcome.kind === 'sent') {
    return (
      <Outcome
        title={t(outcome.created ? SCREEN_KEYS.sentTitle : SCREEN_KEYS.alreadySentTitle)}
        body={t(outcome.created ? SCREEN_KEYS.sentLead : SCREEN_KEYS.alreadySentLead)}
      />
    );
  }

  return (
    <DraftFormShell
      text={formText}
      /*
        🔴 `company`, ΚΑΙ ΤΟ ΒΡΗΚΕ ΤΟ ΑΝΟΙΓΜΑ ΤΗΣ ΣΕΛΙΔΑΣ — ΟΧΙ ΠΥΛΗ (§9.19).

        Η πρώτη γραφή έλεγε `personal` και ήταν **λάθος ερώτηση**. Το `custody` ρωτά,
        κατά τη **δική του** τεκμηρίωση, *«ο χώρος που θα γράψει **η πόρτα αυτής της
        φόρμας**»* — και αυτή η πόρτα γράφει `mreq_*`, έγγραφο του οποίου η εμβέλεια
        μισθωτή είναι το **`agencyCompanyId`** (`firestore/tenant-config.ts`), όχι ο
        προσωπικός χώρος. Η **αγγελία** μένει προσωπική· το **έγγραφο που γεννιέται
        εδώ** δεν είναι αγγελία.

        🔑 **Η συνέπεια στην οθόνη ήταν πραγματική, όχι θεωρητική**: με `personal` το
        `PersonalCustodyNotice` (ADR-820 §5.2) ανακοίνωνε στον **ιδιοκτήτη**
        *«Για καταχώρηση με εντολή πελάτη, χρησιμοποίησε τις Εντολές μέσα στον χώρο
        του γραφείου»* — δηλαδή τον έστελνε στην **οθόνη του μεσίτη**, το ακριβώς
        αντίθετο από τον σκοπό αυτής της σελίδας. ⚠️ **Καμία πύλη δεν το πιάνει**: το
        κείμενο έρχεται από `t()`, τα κλειδιά υπάρχουν, η γεωμετρία είναι νόμιμη.
        Το βρήκε **μόνο** το άνοιγμα της σελίδας (Π1).
      */
      custody="company"
      form={form}
      editing={false}
      validation={validation}
      submitState={submitState}
      onSubmit={handleSubmit}
      onCancel={() => router.push(agencyHref)}
    >
      <Field label={t(SCREEN_KEYS.agencyLabel)}>
        <p className="m-0 text-sm font-medium text-foreground">{agencyDisplayName}</p>
      </Field>

      <Field label={t(SCREEN_KEYS.listingLabel)} hint={t(SCREEN_KEYS.listingHint)}>
        {choices.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">
            {t(SCREEN_KEYS.listingsEmpty)}{' '}
            <Link href="/offers/new" className="font-medium text-foreground underline underline-offset-4">
              {t(SCREEN_KEYS.listingsEmptyAction)}
            </Link>
          </p>
        ) : (
          <Select
            value={values.ownerPropertyId === '' ? undefined : values.ownerPropertyId}
            onValueChange={(next) => form.setValue('ownerPropertyId', next)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t(SCREEN_KEYS.listingPlaceholder)} />
            </SelectTrigger>
            <SelectContent>
              {/* ⛔ Κανένα `value=""` — δες την κεφαλίδα (CHECK 3.48). */}
              {choices.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <Field label={t(SCREEN_KEYS.agreementLabel)} hint={t(SCREEN_KEYS.agreementHint)}>
        <Select
          value={values.agreement}
          onValueChange={(next) => form.setValue('agreement', next as MandateRequestFormValues['agreement'])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LISTING_AGREEMENTS.map((agreement) => (
              <SelectItem key={agreement} value={agreement}>
                {/* 🔑 Ευρετηρίαση **σταθεράς module**, ποτέ `t(fn(x))` — αλλιώς ο
                    τεμαχιστής βγάζει «unresolved dynamic t()» (Π3). */}
                {t(LISTING_AGREEMENT_I18N_KEYS[agreement])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <CompensationField form={form} values={values} />

      {/*
        🏆 **ΑΜΕΣΩΣ ΜΕΤΑ ΤΟΝ ΕΠΙΛΟΓΕΑ, ΚΑΙ ΕΙΝΑΙ ΣΕΙΡΑ-ΣΥΜΒΟΛΑΙΟ**: η κατάληψη είναι
        ιδιότητα **του ακινήτου**, όχι των όρων. Ο άνθρωπος πρέπει να τη δει τη
        στιγμή που διαλέγει σπίτι — όχι αφού συμπληρώσει αμοιβή και ημερομηνίες για
        κάτι που δεν μπορεί να πάρει.
      */}
      <MandateOccupancyPanel
        notice={notice}
        // ⚠️ **Το ΜΟΝΟ όνομα που ξέρει με βεβαιότητα αυτή η οθόνη.** Δες το `nameOf`
        //    στο πάνελ για το γιατί δεν ψάχνουμε τα υπόλοιπα από τον πελάτη.
        nameOf={(companyId) => (companyId === agencyCompanyId ? agencyDisplayName : null)}
        onScheduleFrom={(yyyyMmDd) => form.setValue('startsOn', yyyyMmDd)}
      />

      <Field label={t(SCREEN_KEYS.scopeLabel)} hint={t(SCREEN_KEYS.scopeHint)}>
        {/* 🔑 **Ο ΥΠΑΡΧΩΝ** πολλαπλός επιλογέας (Α9), ποτέ δεύτερος: το CHECK 3.28
            μπλόκαρε ήδη μια φορά το δίδυμο `single`/`multiple`. */}
        <FormOptionsField<MandateRequestFormValues, OfferKind>
          control={form.control}
          name="scope"
          mode="multiple"
          options={OFFER_KINDS}
          labelOf={(kind) => t(OFFER_KIND_I18N_KEYS[kind])}
        />
      </Field>

      <Field label={t(SCREEN_KEYS.startsLabel)} hint={t(SCREEN_KEYS.startsHint)}>
        <Input
          type="date"
          value={values.startsOn}
          // ⚠️ `min` είναι **βοήθεια**, όχι φρουρός — ίδιο δόγμα με τη λήξη παρακάτω.
          min={todayISO.slice(0, 10)}
          onChange={(event) => form.setValue('startsOn', event.target.value)}
        />
      </Field>

      <Field label={t(SCREEN_KEYS.expiresLabel)} hint={t(SCREEN_KEYS.expiresHint)}>
        <Input
          type="date"
          value={values.expiresOn}
          // ⚠️ `min` είναι **βοήθεια**, όχι φρουρός: ο κριτής είναι τα εμπόδια, και ο
          //    διακομιστής τα ξαναρωτά. Ένα `min` που θα το εμπιστευόμασταν θα ήταν
          //    φρουρός στον φυλλομετρητή.
          min={todayISO.slice(0, 10)}
          onChange={(event) => form.setValue('expiresOn', event.target.value)}
        />
      </Field>

      {/*
        🔴 **ΤΕΛΕΥΤΑΙΟ, ΚΑΙ ΕΙΝΑΙ ΣΕΙΡΑ-ΣΥΜΒΟΛΑΙΟ** — το ίδιο που έχει ήδη γράψει η
        φόρμα προσφοράς για τον λογαριασμό: όλα τα προηγούμενα πεδία λένε
        *«συμπλήρωσε κάτι»*, ενώ η ταυτότητα λέει *«υπόγραψε ό,τι συμπλήρωσες»* — το
        βήμα που έρχεται **αφού** δοθεί η αξία, ποτέ πριν (ADR-660 §5.2, «useful
        screen»). Ο άνθρωπος που θα συναντούσε το ΑΦΜ **πρώτο** θα το διάβαζε ως
        φραγμό εισόδου σε μια φόρμα που δεν έχει ακόμη δει.

        🔑 **ΠΑΝΤΑ ΟΡΑΤΟ, ΠΟΤΕ «ΕΜΦΑΝΙΖΕΤΑΙ ΟΤΑΝ ΛΕΙΠΕΙ».** Δύο λόγοι, και οι δύο
        μετρημένοι:
        1. Το ΑΦΜ είναι **όρος της σύμβασης** που προτείνεται εδώ — ο άνθρωπος
           οφείλει να δει **ποιος αριθμός** θα ταξιδέψει, όπως βλέπει το ακίνητο,
           τη λήξη και την αμοιβή.
        2. Πεδίο που **εξαφανίζεται** μόλις συμπληρωθεί μετακινεί την εστίαση χωρίς
           να το ζητήσει κανείς — τεκμηριωμένη αστοχία προσβασιμότητας της
           προοδευτικής αποκάλυψης (WCAG 3.3.1 / 4.1.3).
      */}
      <TaxIdentityField
        value={taxIdentity.value}
        onChange={taxIdentity.onChange}
        onCommit={taxIdentity.onCommit}
        issueKey={taxIdentity.issueKey}
        disabled={submitState === 'saving'}
      />

      {outcome.kind !== 'idle' && (
        <p role="alert" className="m-0 rounded-md border border-border bg-card p-3 text-sm text-foreground">
          {outcome.kind === 'refused'
            ? t(REJECTION_KEYS[outcome.reason])
            : t(SCREEN_KEYS.unverified)}
        </p>
      )}
    </DraftFormShell>
  );
}

/**
 * **Η απάντηση του διακομιστή → τι ξέρει η οθόνη.**
 *
 * ⚠️ **Το 503 ΔΕΝ ισοπεδώνεται με το 422** (N.12): *«δεν μπόρεσα να ρωτήσω»* στέλνει
 * τον άνθρωπο να **ξαναδοκιμάσει χωρίς να αλλάξει τίποτα*, ενώ *«δεν επιτρέπεται»*
 * τον στέλνει να **αλλάξει** κάτι. Ένα κοινό μήνυμα θα τον έβαζε να πειράζει όρους
 * που ήταν μια χαρά.
 */
function readOutcome(status: number, body: unknown): SubmitOutcome {
  if (status === 503) return { kind: 'unverified' };

  const payload = body as { readonly created?: boolean; readonly reason?: MandateRequestRejection } | null;

  if (status === 200 || status === 201) {
    return { kind: 'sent', created: payload?.created === true };
  }
  if (payload?.reason !== undefined && payload.reason in REJECTION_KEYS) {
    return { kind: 'refused', reason: payload.reason };
  }
  // ⚠️ Κάθε άλλη κατάσταση είναι **αποτυχία που δεν κατονομάζεται** — και το λέμε ως
  //    «δεν μάθαμε», όχι ως άρνηση που ο άνθρωπος θα προσπαθούσε να διορθώσει.
  return { kind: 'unverified' };
}

/** Η έκβαση, σε δική της οθόνη — ο άνθρωπος τελείωσε, δεν του ξαναδείχνουμε φόρμα. */
function Outcome({ title, body }: { title: string; body: string }): React.JSX.Element {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);
  return (
    <ShellSurface as="main" measure="prose" className="gap-4">
      <h1 className="m-0 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="m-0 text-sm text-muted-foreground">{body}</p>
      <nav>
        <Link href="/offers" className="text-sm font-medium text-foreground underline underline-offset-4">
          {t(SCREEN_KEYS.backToListings)}
        </Link>
      </nav>
    </ShellSurface>
  );
}
