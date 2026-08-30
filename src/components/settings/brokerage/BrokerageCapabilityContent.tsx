'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΙΔΡΥΤΗ** — δηλώνει μεσιτεία, και μαθαίνει **γιατί** όχι.
 * @related ADR-824 §5.2 · §5.3 · §12.14 · §8 Κ13 · hooks/company/useBrokerageDeclaration
 * @module components/settings/brokerage/BrokerageCapabilityContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΕΝ ΕΙΝΑΙ ΝΕΑ ΟΘΟΝΗ — ΕΙΝΑΙ ΥΠΟΣΧΕΣΗ ΠΟΥ Η ΕΦΑΡΜΟΓΗ ΕΔΙΝΕ ΗΔΗ, ΧΩΡΙΣ ΤΟΠΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `auth:brokerage.denyReason.revoked` λέει σε ζωντανούς ανθρώπους, σήμερα:
 *
 * > *«Η μεσιτική δυνατότητα του γραφείου σου έχει ανακληθεί. **Δες τον λόγο στις
 * > ρυθμίσεις του οργανισμού**.»*
 *
 * …και οι ρυθμίσεις του οργανισμού **δεν είχαν τέτοια σελίδα**. Το `unrequested`
 * έλεγε *«δεν έχεις δηλώσει»* χωρίς να υπάρχει **πουθενά** τρόπος να δηλώσει: η πόρτα
 * `POST /api/companies/capabilities/brokerage` υπήρχε ολόκληρη και **καμία οθόνη δεν
 * την καλούσε** *(μετρημένο: μηδέν αναφορές σε όλο το `src/`)*. Ίδια κλάση με τα
 * τέσσερα ζωντανά 404 που έχει ήδη πληρώσει αυτό το έργο — **υπόσχεση χωρίς τόπο**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚖️ ΚΑΙ Η ΑΝΑΚΛΗΣΗ ΔΕΝ ΕΙΝΑΙ ΕΥΓΕΝΕΙΑ — ΚΑΝΟΝΙΣΜΟΣ (ΕΕ) 2019/1150, ΑΡΘΡΟ 4
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο P2B υποχρεώνει την πλατφόρμα που **περιορίζει ή αναστέλλει** την υπηρεσία σε
 * **επαγγελματία χρήστη** να του δώσει *«a **statement of reasons** for that decision
 * on a **durable medium**»*, **πριν ή την ώρα** που ο περιορισμός ισχύει, και *«the
 * opportunity to clarify the facts and circumstances»*.
 *
 * ⇒ Τρία πράγματα σε αυτή τη σελίδα **δεν είναι σχεδιαστικές επιλογές**:
 *
 * | Τι | Γιατί |
 * |---|---|
 * | ο **λόγος** της ανάκλησης, γραπτός | *statement of reasons* |
 * | η **ημερομηνία** της απόφασης | *«prior to or at the time»* — χωρίς πότε, δεν ελέγχεται |
 * | η **νέα δήλωση** από `revoked` | *opportunity to clarify* — αλλιώς η ανάκληση είναι ισόβια |
 *
 * 🔑 **Και το «durable medium» είναι ο λόγος που ζει σε ΣΕΛΙΔΑ και όχι σε ειδοποίηση**:
 * ένα toast είναι εφήμερο· ο άνθρωπος πρέπει να μπορεί να **ξαναδεί** την αιτιολογία
 * όποτε θέλει, όχι μόνο τη στιγμή που του συνέβη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΚΑΝΕΙ ΑΥΤΗ Η ΟΘΟΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - **Δεν ενεργοποιεί.** Η δήλωση δίνει `pending`, **ποτέ** `active` (ADR-824 §5.3): ο
 *   Ν. 4072/2012 κάνει τη μεσιτεία χωρίς εγγραφή **παράνομη**, και πλατφόρμα που
 *   ενεργοποιεί ρυθμιζόμενη δραστηριότητα με **αυτοδήλωση** αναλαμβάνει το ρίσκο η ίδια.
 * - **Δεν διαβάζει δεύτερη φορά.** Ο αναγνώστης ικανότητας είναι **ΕΝΑΣ**
 *   ({@link useMyOrganizationCapabilities})· εδώ γίνεται **μία** κλήση του.
 * - **Δεν μπαίνει στο πλαϊνό μενού** — δες το `page.tsx` για τον λόγο, που είναι
 *   νομικός και όχι αισθητικός.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { HintedField } from '@/components/ui/hinted-field';
import {
  BROKERAGE_CAPABILITY_KEYS,
  BROKERAGE_CAPABILITY_NS,
  BROKERAGE_REQUIREMENT_KEYS,
  BROKERAGE_REQUIREMENT_FALLBACK,
  BROKERAGE_STATUS_HEADLINE_KEYS,
  BROKERAGE_STATUS_NAME_KEYS,
  isRecognizedRequirement,
} from '@/components/settings/brokerage/brokerage-capability-labels';
import {
  useBrokerageDeclaration,
  type BrokerageDeclarationFailure,
} from '@/hooks/company/useBrokerageDeclaration';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatLongDate } from '@/lib/intl-formatting';
import { useMyOrganizationCapabilities } from '@/services/realtime/hooks/useOrganizationCapability';
import {
  canDeclareCapability,
  type CapabilityDisclosure,
  type CapabilityStatus,
} from '@/types/organization-capability';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE. Χωρίς αυτή τη γραμμή η οθόνη βάφει **ωμά
//    κλειδιά στο πρώτο καρέ** (CHECK 3.51). **ΕΔΩ**, όχι στο `page.tsx`: τα Server και
//    Client δέντρα έχουν **ξεχωριστούς** γράφους module, και εγγραφή από εκεί θα
//    έγραφε σε **άλλο** στιγμιότυπο i18next — πράσινη κλήση που δεν κάνει τίποτα.
import routeSlice from '@/i18n/generated/routes/o__workspace__settings__brokerage.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/**
 * **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ, στατικός `Record` πάνω σε κλειστό σύνολο.**
 *
 * 🔴 Ποτέ ``t(`…failure.${reason}`)`` — το δυναμικό κλειδί είναι **αόρατο στη CHECK
 * 3.8** και θα έβγαινε ωμό στην οθόνη. Και ο τύπος κάνει έναν **έκτο** λόγο αποτυχίας
 * να μη μεταγλωττίζεται μέχρι να πάρει κείμενο.
 */
const FAILURE_KEYS: Record<BrokerageDeclarationFailure, string> = {
  invalid: 'auth:brokerage.capability.failure.invalid',
  forbidden: 'auth:brokerage.capability.failure.forbidden',
  conflict: 'auth:brokerage.capability.failure.conflict',
  notFound: 'auth:brokerage.capability.failure.notFound',
  failed: 'auth:brokerage.capability.failure.failed',
};

/**
 * **ΤΙ ΕΚΚΡΕΜΕΙ, ΟΝΟΜΑΣΤΙΚΑ** — το `currently_due` της Stripe, με τη διαφορά που μετρά.
 *
 * 🔑 Ο διακομιστής **ονομάζει** τι λείπει, ο πελάτης δεν μαντεύει· και ό,τι ο πελάτης
 * **δεν αναγνωρίζει** γίνεται μεταφρασμένη πρόταση, **ποτέ ωμό κλειδί** — δες το
 * σκεπτικό στο {@link recognizedRequirementKey}.
 *
 * ⚠️ Επιστρέφει `null` σε κενή λίστα: τίτλος «Τι εκκρεμεί» πάνω από **τίποτα** είναι
 * χειρότερος από την απουσία του.
 */
function Requirements({
  requirements,
}: {
  readonly requirements: CapabilityDisclosure['requirements'];
}): React.ReactElement | null {
  const { t } = useTranslation([BROKERAGE_CAPABILITY_NS]);

  if (requirements.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-testid="brokerage-requirements">
      <h2 className="m-0 text-base font-semibold text-foreground">
        {t(BROKERAGE_CAPABILITY_KEYS.requirementsTitle)}
      </h2>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        {requirements.map((requirement) => (
          <li key={requirement.key}>
            {/* ⚠️ **Δύο κλήσεις `t()`, και οι δύο στατικά επιλύσιμες** — ευρετηρίαση σε
                σταθερά module ή κυριολεξία. Μία κλήση με κλειδί από **συνάρτηση** θα
                ήταν αόρατη στη CHECK 3.8 και θα την αρνιόταν ο γεννήτορας slice. */}
            {isRecognizedRequirement(requirement.key)
              ? t(BROKERAGE_REQUIREMENT_KEYS[requirement.key])
              : t(BROKERAGE_REQUIREMENT_FALLBACK.unknown)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 🔴 **Η ΑΙΤΙΟΛΟΓΙΑ ΤΗΣ ΑΝΑΚΛΗΣΗΣ — ΤΟ *STATEMENT OF REASONS* ΤΟΥ P2B ΑΡΘΡΟΥ 4.**
 *
 * ⚠️ **Το κενό `revocationReason` ΔΕΝ σιωπά.** Μια ανάκληση χωρίς γραπτό λόγο είναι
 * ακριβώς η κατάσταση που ο κανονισμός απαγορεύει· η οθόνη οφείλει να το **δηλώσει**
 * και να δώσει δρόμο, όχι να δείξει κενό πλαίσιο. *(Ο γραφέας απαιτεί λόγο — αυτό εδώ
 * καλύπτει παλιές εγγραφές και μελλοντικές διαδρομές που θα τον ξεχνούσαν.)*
 *
 * 🔑 **Ο λόγος είναι ΕΛΕΥΘΕΡΟ ΚΕΙΜΕΝΟ ΔΙΑΧΕΙΡΙΣΤΗ, όχι κλειδί i18n** *(το λέει ο ίδιος
 * ο τύπος: «κλειδί i18n **ή** ελεύθερο κείμενο»)*. Γι' αυτό ζωγραφίζεται **ως κείμενο**
 * και δεν περνά ποτέ από `t()`: μια απόπειρα μετάφρασης θα ζωγράφιζε το ίδιο το κείμενο
 * όταν δεν είναι κλειδί — και **ωμό κλειδί** όταν είναι.
 */
function Revocation({
  disclosure,
}: {
  readonly disclosure: CapabilityDisclosure;
}): React.ReactElement {
  const { t } = useTranslation([BROKERAGE_CAPABILITY_NS]);
  const reason = disclosure.revocationReason?.trim() ?? '';

  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-card p-3"
      data-testid="brokerage-revocation"
    >
      <h2 className="m-0 text-base font-semibold text-foreground">
        {t(BROKERAGE_CAPABILITY_KEYS.revocationTitle)}
      </h2>
      <p className="m-0 text-sm text-foreground">
        {reason === '' ? t(BROKERAGE_CAPABILITY_KEYS.revocationMissing) : reason}
      </p>
      {disclosure.decidedAt !== null && (
        <p className="m-0 text-sm text-muted-foreground">
          {t(BROKERAGE_CAPABILITY_KEYS.decidedAt, {
            date: formatLongDate(disclosure.decidedAt),
          })}
        </p>
      )}
    </section>
  );
}

/** **Η δήλωση που κατατέθηκε** — ό,τι είπε ο ίδιος, για να το αναγνωρίζει. */
function FiledDeclaration({
  disclosure,
}: {
  readonly disclosure: CapabilityDisclosure;
}): React.ReactElement | null {
  const { t } = useTranslation([BROKERAGE_CAPABILITY_NS]);
  const declaration = disclosure.declaration;

  if (declaration === null) return null;

  return (
    <section className="flex flex-col gap-1" data-testid="brokerage-filed-declaration">
      <h2 className="m-0 text-base font-semibold text-foreground">
        {t(BROKERAGE_CAPABILITY_KEYS.declarationTitle)}
      </h2>
      <p className="m-0 text-sm text-muted-foreground">
        {t(BROKERAGE_CAPABILITY_KEYS.gemiLabel)}: {declaration.gemiNumber}
      </p>
      <p className="m-0 text-sm text-muted-foreground">
        {t(BROKERAGE_CAPABILITY_KEYS.chamberLabel)}: {declaration.chamberRegistryNumber}
      </p>
      <p className="m-0 text-sm text-muted-foreground">
        {t(BROKERAGE_CAPABILITY_KEYS.representativeLabel)}: {declaration.legalRepresentativeName}
      </p>
      <p className="m-0 text-sm text-muted-foreground">
        {t(BROKERAGE_CAPABILITY_KEYS.declaredAt, {
          date: formatLongDate(declaration.declaredAt),
        })}
      </p>
    </section>
  );
}

/**
 * **Η ΦΟΡΜΑ — και τα ΤΡΙΑ στοιχεία που απαιτεί ο νόμος, μαζί.**
 *
 * ⚠️ **Ζωγραφίζεται ΜΟΝΟ όταν η μετάβαση επιτρέπεται** ({@link canDeclareCapability}).
 * Σε `pending` μια δεύτερη δήλωση θα **έσβηνε** την πρώτη μαζί με τη στιγμή της· σε
 * `active` δεν υπάρχει τι να ζητηθεί. Ο γραφέας απαντά **409** και στις δύο — η οθόνη
 * απλώς δεν οδηγεί εκεί τον άνθρωπο.
 *
 * 🔑 **Ο τοπικός έλεγχος πληρότητας δεν είναι διπλότυπο του zod**: το σχήμα της πόρτας
 * είναι ο **κριτής**, αυτό εδώ είναι **ευγένεια** — να μην ταξιδέψει αίτημα που ξέρουμε
 * ότι απορρίπτεται. Η άρνηση παραμένει του διακομιστή.
 */
function DeclarationForm({ status }: { readonly status: CapabilityStatus }): React.ReactElement {
  const { t } = useTranslation([BROKERAGE_CAPABILITY_NS]);
  const { submitting, failure, submit } = useBrokerageDeclaration();

  const [gemiNumber, setGemiNumber] = React.useState('');
  const [chamberRegistryNumber, setChamberRegistryNumber] = React.useState('');
  const [legalRepresentativeName, setLegalRepresentativeName] = React.useState('');

  const complete =
    gemiNumber.trim() !== '' &&
    chamberRegistryNumber.trim() !== '' &&
    legalRepresentativeName.trim() !== '';

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="brokerage-declaration-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!complete) return;
        void submit({ gemiNumber, chamberRegistryNumber, legalRepresentativeName });
      }}
    >
      <HintedField
        id="brokerage-gemi"
        label={t(BROKERAGE_CAPABILITY_KEYS.gemiLabel)}
        hint={t(BROKERAGE_CAPABILITY_KEYS.gemiHint)}
        placeholder={t(BROKERAGE_CAPABILITY_KEYS.gemiPlaceholder)}
        value={gemiNumber}
        disabled={submitting}
        onChange={setGemiNumber}
      />
      <HintedField
        id="brokerage-chamber"
        label={t(BROKERAGE_CAPABILITY_KEYS.chamberLabel)}
        hint={t(BROKERAGE_CAPABILITY_KEYS.chamberHint)}
        placeholder={t(BROKERAGE_CAPABILITY_KEYS.chamberPlaceholder)}
        value={chamberRegistryNumber}
        disabled={submitting}
        onChange={setChamberRegistryNumber}
      />
      <HintedField
        id="brokerage-representative"
        label={t(BROKERAGE_CAPABILITY_KEYS.representativeLabel)}
        hint={t(BROKERAGE_CAPABILITY_KEYS.representativeHint)}
        placeholder={t(BROKERAGE_CAPABILITY_KEYS.representativePlaceholder)}
        value={legalRepresentativeName}
        disabled={submitting}
        onChange={setLegalRepresentativeName}
      />

      <p className="m-0 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
        {t(BROKERAGE_CAPABILITY_KEYS.legalNote)}
      </p>

      {failure !== null && (
        <p role="alert" className="m-0 text-sm text-destructive" data-testid="brokerage-failure">
          {t(FAILURE_KEYS[failure])}
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-3">
        {/* 🔑 **Η δεύτερη φορά λέγεται αλλιώς.** Ο άνθρωπος που ξαναδηλώνει μετά από
            ανάκληση δεν κάνει την ίδια πράξη με εκείνον που δηλώνει πρώτη φορά — και
            ένα κοινό «Κατάθεση δήλωσης» θα του έκρυβε ότι η προηγούμενη **υπήρξε**.
            Ευρετηρίαση σε **σταθερά module**, ποτέ παρεμβολή. */}
        <Button type="submit" disabled={submitting || !complete}>
          {submitting
            ? t(BROKERAGE_CAPABILITY_KEYS.submitting)
            : t(
                status === 'revoked'
                  ? BROKERAGE_CAPABILITY_KEYS.redeclare
                  : BROKERAGE_CAPABILITY_KEYS.submit,
              )}
        </Button>
        {!complete && (
          <span className="text-sm text-muted-foreground">
            {t(BROKERAGE_CAPABILITY_KEYS.incomplete)}
          </span>
        )}
      </footer>
    </form>
  );
}

/**
 * **Η κατάσταση, όπως τη διαβάζει άνθρωπος** — μία λέξη, μετά μία πράξη.
 *
 * ⚠️ `role="status"` και όχι σκέτη παράγραφος: η κατάσταση αλλάζει **ζωντανά** (μια
 * έγκριση μπορεί να φτάσει την ώρα που η σελίδα είναι ανοιχτή), και μια αλλαγή που
 * κανείς δεν ανακοινώνει είναι αόρατη σε όποιον δεν κοιτά την οθόνη.
 */
function StatusBanner({ status }: { readonly status: CapabilityStatus }): React.ReactElement {
  const { t } = useTranslation([BROKERAGE_CAPABILITY_NS]);

  return (
    <section className="flex flex-col gap-1" role="status" data-testid="brokerage-status">
      <p className="m-0 text-sm text-muted-foreground">
        {t(BROKERAGE_CAPABILITY_KEYS.statusLabel)}
      </p>
      <p className="m-0 text-lg font-semibold text-foreground" data-testid="brokerage-status-name">
        {t(BROKERAGE_STATUS_NAME_KEYS[status])}
      </p>
      <p className="m-0 text-muted-foreground" data-testid="brokerage-status-headline">
        {t(BROKERAGE_STATUS_HEADLINE_KEYS[status])}
      </p>
    </section>
  );
}

export function BrokerageCapabilityContent(): React.ReactElement {
  const { t } = useTranslation([BROKERAGE_CAPABILITY_NS]);
  const { disclosures, settled } = useMyOrganizationCapabilities();

  // 🔴 **ΟΣΟ ΔΕΝ ΞΕΡΩ, ΔΕΝ ΜΙΛΩ** (άγκυρα Κ7β). Χωρίς αυτό, ένα **εγκεκριμένο** γραφείο
  //    διάβαζε «δεν έχεις δηλώσει μεσιτική δραστηριότητα» για **~1,5 δευτερόλεπτο σε
  //    κάθε φόρτωση** — μετρημένο ζωντανά 2026-08-28. Το `settled` είναι το **μόνο**
  //    σήμα που ξεχωρίζει «δεν ζήτησε» από «δεν διάβασα ακόμη».
  if (!settled) {
    return <p className="text-muted-foreground">{t(BROKERAGE_CAPABILITY_KEYS.loading)}</p>;
  }

  const disclosure = disclosures.brokerage_listings;
  // ⚠️ **`null` σημαίνει «δεν υπάρχει εγγραφή», δηλαδή `unrequested`** — ποτέ «δεν
  //    ξέρω». Το «δεν ξέρω» πέρασε ήδη από πάνω, στο `settled`.
  const status: CapabilityStatus = disclosure?.status ?? 'unrequested';

  return (
    // 🔴 **`section`, ΟΧΙ `main`, και ΚΑΜΙΑ γεωμετρία** (CHECK 3.63): το κέλυφος του
    //    `(app)` αποδίδει ήδη `<main>`, οι σελίδες του είναι `w-full`, και το κενό
    //    ανήκει στον ρευστό διάδρομο — όχι στο component.
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">
          {t(BROKERAGE_CAPABILITY_KEYS.title)}
        </h1>
        <p className="m-0 text-muted-foreground">{t(BROKERAGE_CAPABILITY_KEYS.lead)}</p>
      </header>

      <StatusBanner status={status} />

      {disclosure !== null && <Requirements requirements={disclosure.requirements} />}

      {/* ⚖️ P2B άρθρο 4 — ο λόγος φτάνει **μόνο** όταν υπάρχει ανάκληση να αιτιολογηθεί. */}
      {disclosure !== null && status === 'revoked' && <Revocation disclosure={disclosure} />}

      {disclosure !== null && <FiledDeclaration disclosure={disclosure} />}

      {/* 🔑 Η **μία** πηγή της απόφασης «ζωγραφίζω φόρμα;» — ποτέ κυριολεξία εδώ. */}
      {canDeclareCapability(status) && <DeclarationForm status={status} />}
    </section>
  );
}
