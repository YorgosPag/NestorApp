'use client';

/**
 * @fileoverview **«ΘΕΛΩ ΝΑ ΜΕ ΒΡΙΣΚΟΥΝ»** — η δεύτερη πράξη του §9.10, το #12.
 * @related ADR-827 §9.8 · §9.10 · §9.13 · hooks/mandate/useAgencyShowcase.ts
 * @module components/mandate/AgencyShowcaseContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΕΔΙΑ, ΚΑΙ ΤΑ ΤΡΙΑ ΕΙΝΑΙ ΑΠΟΦΑΣΗ — ΟΧΙ ΕΛΑΧΙΣΤΟ ΒΙΑΒΛΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η βιτρίνα **δεν** έχει τηλέφωνο, email, διεύθυνση, λογότυπο, περιγραφή ή
 * βαθμολογία — και **κανένα** από αυτά δεν λείπει από αμέλεια:
 *
 * | Τι λείπει | Γιατί |
 * |---|---|
 * | **κανάλι επικοινωνίας** | §9.8 — το **άρθρο 200 §1** θέλει τη σύμβαση **εγγράφως**· κατάλογος με τηλέφωνο παράγει **τηλεφώνημα**, πράξη από την οποία καμία έγκυρη σύμβαση δεν γεννιέται |
 * | **αμοιβή · βαθμολογία · κατάταξη** | §9.9 α — κατάλογος **ΓΡΑΦΕΙΩΝ** είναι μεγαλύτερη επιφάνεια *steering* από κατάλογο ακινήτων *(NAR, $418M)* |
 * | **αυτόματη συμπλήρωση από τα στοιχεία εταιρείας** | §9.9 β — μεσίτης με **ατομική επιχείρηση** είναι **φυσικό** πρόσωπο, και η έδρα του μπορεί να είναι η **κατοικία** του |
 *
 * ⚠️ **Η τελευταία γραμμή είναι ο λόγος που η φόρμα ΔΕΝ προσυμπληρώνεται από το
 * `companies/{id}`.** Θα ήταν «ευγενικό» και θα δημοσίευε δεδομένα που γράφτηκαν για
 * **άλλον** λόγο. Προσυμπληρώνεται **μόνο** από τη **ίδια τη βιτρίνα**, όταν υπάρχει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΚΑΤΑΣΤΑΣΗ ΕΙΝΑΙ Η ΥΠΑΡΞΗ — ΚΑΙ Η ΟΘΟΝΗ ΤΟ ΛΕΕΙ ΕΤΣΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δεν υπάρχει διακόπτης «δημοσιευμένο ναι/όχι», γιατί **δεν υπάρχει τέτοιο πεδίο**:
 * *«η παρουσία ΕΙΝΑΙ η συγκατάθεση»*, και **απόσυρση = διαγραφή**. Ένας διακόπτης θα
 * υπονοούσε σημαία που μπορεί να διαφωνήσει με την ύπαρξη — ADR-749, σε μια οθόνη
 * απόσταση.
 *
 * ⚠️ Καμία συμβολοσειρά οθόνης εδώ (N.11) — όλα από τον πίνακα κλειδιών.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SHOWCASE_KEYS,
  SHOWCASE_NS,
  SHOWCASE_REJECTION_KEYS,
} from '@/components/mandate/agency-showcase-labels';
import { useAgencyShowcase, type ShowcaseFailure } from '@/hooks/mandate/useAgencyShowcase';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useWorkspaceAlias } from '@/lib/workspace/navigation';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE. Χωρίς αυτή τη γραμμή η οθόνη βάφει **ωμά
//    κλειδιά στο πρώτο καρέ** (CHECK 3.51). **ΕΔΩ**, όχι στο `page.tsx`: τα Server και
//    Client δέντρα έχουν **ξεχωριστούς** γράφους module, και εγγραφή από εκεί θα
//    έγραφε σε **άλλο** στιγμιότυπο i18next — πράσινη κλήση που δεν κάνει τίποτα.
import routeSlice from '@/i18n/generated/routes/o__workspace__settings__agency-profile.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/**
 * **Γιατί δεν έγινε** — και **κάθε** `t()` εδώ είναι επιλύσιμο.
 *
 * 🔴 **Η ΠΡΩΤΗ ΓΡΑΦΗ ΗΤΑΝ ``t(failureKey(failure))`` ΚΑΙ Ο ΓΕΝΝΗΤΟΡΑΣ ΤΗΝ ΑΡΝΗΘΗΚΕ**
 * *(«4 unresolved dynamic t() calls … the slice will not guess»)*, σωστά: κλειδί που
 * βγαίνει από **κλήση συνάρτησης** δεν διαβάζεται στατικά από κανέναν — ούτε από τον
 * τεμαχιστή, ούτε από τη **CHECK 3.8**.
 *
 * ⚠️ **Η θεραπεία ΔΕΝ ήταν `dynamicKeyPolicy`.** Μια δηλωμένη εξαίρεση θα έλυνε τον
 * τεμαχιστή και θα **άφηνε** το κλειδί αόρατο στην πύλη i18n. Η ευρετηρίαση **πάνω σε
 * σταθερά module** (`SHOWCASE_REJECTION_KEYS[…]`) επιλύεται από **μόνη της** — ίδιο
 * ιδίωμα με το `t(GROUP_LABEL_KEYS[group])` του καταλόγου, που **δεν** χρειάζεται
 * πολιτική.
 */
function FailureMessage({ failure }: { readonly failure: ShowcaseFailure }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  if (failure.kind === 'rejected') {
    return <>{t(SHOWCASE_REJECTION_KEYS[failure.reason])}</>;
  }
  if (failure.kind === 'not-allowed') {
    return <>{t(SHOWCASE_KEYS.notAllowed)}</>;
  }
  // ⚠️ *«δεν είναι η διεύθυνσή σου»* και *«δεν μπόρεσα να ρωτήσω»* μοιράζονται σήμερα
  //    το γενικό μήνυμα, αλλά παραμένουν **χωριστές τιμές** στον τύπο: την ημέρα που
  //    αποκτήσουν δικό τους κείμενο, η αλλαγή γίνεται εδώ και μόνο εδώ.
  return <>{t(SHOWCASE_KEYS.failed)}</>;
}

/**
 * ⚠️ **Δέχεται ΚΕΙΜΕΝΟ, όχι κλειδιά — και είναι απόφαση, όχι στιλ.** Η πρώτη γραφή
 * περνούσε `labelKey`/`hintKey` και καλούσε `t(labelKey)` εδώ μέσα: **τρία** από τα
 * τέσσερα ανεπίλυτα `t()` που μπλόκαραν τον γεννήτορα. Με το κείμενο να έρχεται
 * έτοιμο, **κάθε** κλήση `t()` ζει στον γονέα με **κυριολεκτικό** κλειδί — ορατή και
 * στον τεμαχιστή και στη CHECK 3.8.
 */
interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly readOnly?: boolean;
  readonly onChange?: (value: string) => void;
}

function Field({
  id,
  label,
  hint,
  placeholder,
  value,
  readOnly,
  onChange,
}: FieldProps): React.ReactElement {
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        readOnly={readOnly}
        aria-describedby={hintId}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <p id={hintId} className="m-0 text-sm text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

export function AgencyShowcaseContent(): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const alias = useWorkspaceAlias() ?? '';
  const { state, busy, failure, publish, withdraw } = useAgencyShowcase();

  const published = state.phase === 'published' ? state.profile : null;
  const [displayName, setDisplayName] = React.useState('');
  const [gemiNumber, setGemiNumber] = React.useState('');

  // ⚠️ **Προσυμπλήρωση ΜΟΝΟ από την ίδια τη βιτρίνα** — ποτέ από το `companies/{id}`
  //    (§9.9 β). Το `publishedAt` είναι το σήμα «ήρθε νέα έκδοση», ώστε μια ανάκληση
  //    που σβήνει το προφίλ να μην ξαναγράφει τα πεδία που πληκτρολογεί ο άνθρωπος.
  const publishedAt = published?.publishedAt ?? null;
  React.useEffect(() => {
    if (published === null) return;
    setDisplayName(published.displayName);
    setGemiNumber(published.gemiNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- κλειδί ταυτότητας έκδοσης
  }, [publishedAt]);

  return (
    // 🔴 **`section`, ΟΧΙ `main` — και ΚΑΜΙΑ γεωμετρία.** Και τα τρία λάθη της πρώτης
    //    γραφής (`mx-auto` · `max-w-2xl` · `p-4`) τα έπιασε το **CHECK 3.63 (ADR-797)**,
    //    όχι η κρίση μου:
    //
    // 1. Το κέλυφος του `(app)` αποδίδει **ήδη** `<main>` (`MainContentBridge`) —
    //    δεύτερο `<main>` είναι **άκυρο HTML** και **δύο** ορόσημα «κύριο περιεχόμενο».
    // 2. Το `mx-auto max-w-*` είναι το ιδίωμα του **`(me)`**, του ιδιώτη· οι σελίδες
    //    του `(app)` είναι **`w-full`**. Χειρόγραφο ταβάνι πλάτους είναι **δεύτερη
    //    αυθεντία** — η κλίμακα ζει στο `spacing.layout.measure`.
    // 3. Το `p-4` έδινε **διπλό κενό** πάνω στον ρευστό διάδρομο του κελύφους:
    //    *«outer spacing is a layout concern, not a component one»*.
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{t(SHOWCASE_KEYS.title)}</h1>
        <p className="m-0 text-muted-foreground">{t(SHOWCASE_KEYS.lead)}</p>
      </header>

      <p
        className="m-0 text-sm font-medium text-foreground"
        // 🔑 Η κατάσταση **είναι** η ύπαρξη του εγγράφου — καμία σημαία.
        data-testid="showcase-status"
      >
        {published === null
          ? t(SHOWCASE_KEYS.statusNotPublished)
          : t(SHOWCASE_KEYS.statusPublished)}
      </p>

      <section className="flex flex-col gap-4">
        <Field
          id="showcase-alias"
          label={t(SHOWCASE_KEYS.aliasLabel)}
          hint={t(SHOWCASE_KEYS.aliasHint)}
          value={alias}
          readOnly
        />
        <Field
          id="showcase-name"
          label={t(SHOWCASE_KEYS.nameLabel)}
          hint={t(SHOWCASE_KEYS.nameHint)}
          placeholder={t(SHOWCASE_KEYS.namePlaceholder)}
          value={displayName}
          onChange={setDisplayName}
        />
        <Field
          id="showcase-gemi"
          label={t(SHOWCASE_KEYS.gemiLabel)}
          hint={t(SHOWCASE_KEYS.gemiHint)}
          placeholder={t(SHOWCASE_KEYS.gemiPlaceholder)}
          value={gemiNumber}
          onChange={setGemiNumber}
        />
      </section>

      {/* 🔑 Η απουσία καναλιού είναι **δηλωμένη**, όχι σιωπηλή: ο μεσίτης οφείλει να
          ξέρει ότι δεν λείπει πεδίο — ότι έτσι γεννιέται γραπτό αίτημα (§9.8). */}
      <p className="m-0 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
        {t(SHOWCASE_KEYS.noChannel)}
      </p>

      {failure !== null && (
        <p role="alert" className="m-0 text-sm text-destructive">
          <FailureMessage failure={failure} />
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            void publish({ alias, displayName, gemiNumber, place: published?.place ?? null });
          }}
        >
          {busy === 'publishing'
            ? t(SHOWCASE_KEYS.publishing)
            : t(published === null ? SHOWCASE_KEYS.publish : SHOWCASE_KEYS.republish)}
        </Button>

        {published !== null && (
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => {
              void withdraw();
            }}
          >
            {busy === 'withdrawing' ? t(SHOWCASE_KEYS.withdrawing) : t(SHOWCASE_KEYS.withdraw)}
          </Button>
        )}

        <span className="text-sm text-muted-foreground">
          {published === null
            ? t(SHOWCASE_KEYS.withdrawHint)
            : t(SHOWCASE_KEYS.publishedAt, { date: published.publishedAt })}
        </span>
      </footer>
    </section>
  );
}
