'use client';

/**
 * @fileoverview 🏆 **«ΠΟΙΟΣ ΕΙΣΑΙ;» — ΤΟ ΠΕΔΙΟ ΤΟΥ ΣΗΜΑΤΟΣ** (ADR-841 §7 Α21, Φάση 2).
 * @related hooks/mandate/useShowcaseMark · lib/agency/showcase-mark-frame ·
 *   components/mandate/AgencyShowcaseContent
 * @module components/mandate/ShowcaseMarkField
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 Ο ΤΡΙΤΟΣ ΑΔΕΛΦΟΣ — ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ Ο N.7.1, ΟΧΙ Η ΑΙΣΘΗΤΙΚΗ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Το `AgencyShowcaseContent` μετρούσε **466 γραμμές** πριν από τη Φάση 2. Το σχήμα
 * υπήρχε ήδη δίπλα: `ShowcaseCredentialField` και `PlaceIdentityField` είναι χωριστά
 * πεδία που ο ορχηστρωτής **συνθέτει**. **Εξαγωγή, ποτέ τρίμμα.**
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΟΙ ΠΕΝΤΕ ΑΠΟΦΑΣΕΙΣ ΤΗΣ ΟΘΟΝΗΣ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **1 · `RadioGroup`, ΟΧΙ Radix `Select`.** Το ADR-001 κάνει κανονικό το `Select` για
 * **dropdown**· εδώ οι επιλογές είναι **δύο** και **οπτικές**. Το ίδιο σκεπτικό γράφεται
 * ήδη δίπλα, στο `OwnerPropertyMediaItem`: *«μια λίστα θα ζητούσε **δύο** κλικ για ένα
 * ναι/όχι»*. Και οι δύο επιλογές πρέπει να είναι **ορατές μαζί**, γιατί η υπόδειξη κάθε
 * μιας *(«εμφανίζεται σε κύκλο»)* είναι η πληροφορία που κάνει την επιλογή.
 *
 * **2 · ΤΟ ΕΙΔΟΣ ΔΙΑΛΕΓΕΤΑΙ ΠΡΙΝ ΤΟ ΑΡΧΕΙΟ.** Έτσι η προεπισκόπηση εμφανίζεται
 * **αμέσως στο σωστό σχήμα**. Η αντίστροφη σειρά θα έδειχνε την εικόνα σε ένα σχήμα και
 * μετά θα την **άλλαζε** — που διαβάζεται ως δυσλειτουργία.
 *
 * **3 · ΚΑΜΙΑ ΕΠΙΒΕΒΑΙΩΣΗ ΣΤΗΝ ΑΦΑΙΡΕΣΗ.** *«Αποφύγετε διαλόγους επιβεβαίωσης για
 * αναστρέψιμες πράξεις»* (NN/g). Το **ιδιωτικό** αρχείο δεν σβήνεται — μόνο τα δημόσια
 * παράγωγα — και ο άνθρωπος ξαναδηλώνει με ένα κλικ. Ένας διάλογος εδώ θα ήταν το
 * *«κλάμα του λύκου»* που κάνει τους ανθρώπους να πατούν «Ναι» χωρίς να διαβάζουν, και
 * να το κάνουν και εκεί που **έπρεπε** να διαβάσουν.
 *
 * **4 · ΤΟ ΚΛΕΙΣΤΟ ΠΕΔΙΟ ΛΕΕΙ ΓΙΑΤΙ.** Χωρίς δημοσιευμένη βιτρίνα δεν υπάρχει έγγραφο
 * να γραφτεί το σήμα. Ένα σιωπηλά γκρι κουμπί θα άφηνε τον άνθρωπο να ψάχνει τι έκανε
 * λάθος· η πρόταση *«δημοσίευσε πρώτα»* του δίνει **την επόμενη κίνηση**.
 *
 * **5 · ΚΑΜΙΑ ΣΥΜΒΟΛΟΣΕΙΡΑ ΟΘΟΝΗΣ ΕΔΩ** (N.11) — όλα από τον πίνακα κλειδιών, με
 * **κυριολεκτικά** ορίσματα στο `t()`.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  SHOWCASE_MARK_KEYS,
  // 🔑 **Οι δύο πίνακες ζουν ΕΚΕΙ, όχι εδώ** — και τη θέση τους την όρισε ο γεννήτορας
  //    του route slice, όχι το γούστο. Δες το σκεπτικό δίπλα τους.
  SHOWCASE_MARK_KIND_HINT_KEYS,
  SHOWCASE_MARK_KIND_LABEL_KEYS,
  SHOWCASE_NS,
  SHOWCASE_REJECTION_KEYS,
} from '@/components/mandate/agency-showcase-labels';
import { ShowcaseMarkPreview } from '@/components/mandate/ShowcaseMarkPreview';
import { useShowcaseMark, type ShowcaseMarkState } from '@/hooks/mandate/useShowcaseMark';
import { maskCrops } from '@/lib/agency/showcase-mark-frame';
import { MARK_IDEAL_EDGE } from '@/lib/agency/showcase-mark-input';
import {
  SHOWCASE_MARK_ALT_KEYS,
  SHOWCASE_MARK_KINDS,
  type ShowcaseMarkKind,
} from '@/lib/agency/showcase-mark-kind';
import type { DeclaredShowcaseMark } from '@/types/agency-profile';

/**
 * **Ό,τι χρειάζεται ο επιλογέας αρχείου** — δηλωμένο **μία** φορά.
 *
 * 🔴 **ΤΟ ΕΠΙΑΣΕ Η ΠΥΛΗ, ΟΧΙ Η ΚΡΙΣΗ ΜΟΥ** (N.18 / CHECK 3.28): οι πέντε γραμμές ζούσαν
 * **αυτούσιες** και στον {@link MarkEditor} και στον {@link MarkChooser} — *«8 lines / 55
 * tokens»*. Και δεν ήταν καλλωπισμός: ο ενδιάμεσος **δεν χρειάζεται να ξέρει** τι θέλει ο
 * επιλογέας· τα προωθεί. Δύο δηλώσεις του ίδιου σχήματος είναι δύο πράγματα που μπορούν
 * να **αποκλίνουν**, και η απόκλιση θα φαινόταν ως «λείπει ένα prop» τρία αρχεία μακριά.
 *
 * 🔑 **Ταξιδεύει ως ΕΝΑ αντικείμενο** (`chooser`), όχι ως πέντε ξεχωριστά props: ένα
 * `extends` θα ένωνε τα δύο σύνολα και θα άφηνε τον ενδιάμεσο να τα ξεδιαλέξει με το
 * χέρι — δηλαδή θα ξαναέγραφε τα ονόματα, που είναι ακριβώς το διπλότυπο.
 */
interface MarkChooserProps {
  /** Το **δημοσιευμένο** σήμα, ή `null`. */
  readonly published: DeclaredShowcaseMark | null;
  readonly inputId: string;
  readonly busy: boolean;
  readonly onFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly onRemove: () => Promise<void>;
}

interface ShowcaseMarkFieldProps {
  /** Το **δημοσιευμένο** σήμα, ή `null`. Η αυθεντία είναι η βιτρίνα, ποτέ αυτό το πεδίο. */
  readonly published: DeclaredShowcaseMark | null;
  /** ⚠️ `false` όσο δεν υπάρχει βιτρίνα — δες την απόφαση **4**. */
  readonly enabled: boolean;
}

/**
 * **Ποιο είδος δείχνει το πεδίο τώρα.**
 *
 * 🔑 Αρχική τιμή από το **δημοσιευμένο** σήμα όταν υπάρχει: ο άνθρωπος που ανοίγει την
 * οθόνη με πορτρέτο βλέπει επιλεγμένο «Φωτογραφία προσώπου». Η εναλλακτική *(πάντα
 * `logo`)* θα του έλεγε ότι δήλωσε κάτι που δεν δήλωσε.
 *
 * ⚠️ **Το `published.kind` είναι `ShowcaseMarkKind` από τον αναγνώστη** — πέρασε ήδη τον
 * φρουρό στο `showcase-read`, οπότε δεν χρειάζεται δεύτερος εδώ.
 */
function initialKind(published: DeclaredShowcaseMark | null): ShowcaseMarkKind {
  return published?.kind ?? 'logo';
}

export function ShowcaseMarkField({
  published,
  enabled,
}: ShowcaseMarkFieldProps): React.JSX.Element {
  const inputId = React.useId();
  const { state, tooSmall, declare, retract } = useShowcaseMark();

  const [kind, setKind] = React.useState<ShowcaseMarkKind>(() => initialKind(published));

  // ⚠️ **Κλειδί ταυτότητας το URL**, όχι το αντικείμενο: το `published` γεννιέται εκ νέου
  //    σε κάθε στιγμιότυπο του Firestore, οπότε μια εξάρτηση από αυτό θα ξανάγραφε την
  //    επιλογή του ανθρώπου **σε κάθε καρέ** — και θα του έκλεβε το ραδιοπλήκτρο από τα
  //    δάχτυλα ενώ διαλέγει.
  const publishedUrl = published?.image.url ?? null;
  React.useEffect(() => {
    if (published !== null) setKind(published.kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- κλειδί ταυτότητας έκδοσης
  }, [publishedUrl]);

  const busy = state.state === 'uploading' || state.state === 'publishing' || state.state === 'removing';

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // ⚠️ Το πεδίο αδειάζει **αμέσως**, ώστε το ίδιο αρχείο να ξαναεπιλέγεται μετά από
    //    αποτυχία: ένα `<input type="file">` δεν πυροδοτεί `change` για ίδια τιμή.
    event.target.value = '';
    if (file !== undefined) await declare(file, kind);
  }

  return (
    <section className="flex flex-col gap-3">
      <MarkHeading />

      {/* 🔑 Απόφαση **4**: το κλειστό πεδίο λέει **γιατί**, και δίνει την επόμενη κίνηση. */}
      {!enabled ? (
        <MarkClosedNote />
      ) : (
        <MarkEditor
          chooser={{ published, inputId, busy, onFile: handleFile, onRemove: retract }}
          kind={kind}
          onKind={setKind}
          state={state}
          tooSmall={tooSmall}
        />
      )}
    </section>
  );
}

/**
 * **Το κλειστό πεδίο** — *«δημοσίευσε πρώτα τη βιτρίνα σου»*.
 *
 * ⛔ **Ποτέ σιωπηλά γκρι κουμπί**: χωρίς βιτρίνα δεν υπάρχει έγγραφο να γραφτεί το σήμα,
 * και ο άνθρωπος οφείλει να μάθει **την επόμενη κίνηση**, όχι ότι κάτι δεν δουλεύει.
 */
function MarkClosedNote(): React.JSX.Element {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <p className="m-0 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
      {t(SHOWCASE_MARK_KEYS.needsShowcase)}
    </p>
  );
}

/**
 * **Το ανοιχτό πεδίο** — ό,τι βλέπει ο άνθρωπος όταν υπάρχει βιτρίνα να δεχτεί σήμα.
 *
 * 🔑 **Εξαγωγή για τον N.7.1**, και το σπάσιμο είναι στη σωστή άρθρωση: ο ορχηστρωτής
 * κρατά **την απόφαση** *(«είναι ανοιχτό;»)*, αυτό κρατά **το περιεχόμενο**. Το «τρίμμα»
 * θα ήταν να σβηστούν σχόλια μέχρι να χωρέσει ο αριθμός.
 */
function MarkEditor({
  chooser,
  kind,
  onKind,
  state,
  tooSmall,
}: {
  /** 🔑 **Αδιαφανώς προωθούμενο** — δες {@link MarkChooserProps}. */
  readonly chooser: MarkChooserProps;
  readonly kind: ShowcaseMarkKind;
  readonly onKind: (next: ShowcaseMarkKind) => void;
  readonly state: ShowcaseMarkState;
  readonly tooSmall: { readonly shortest: number; readonly required: number } | null;
}): React.JSX.Element {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <>
      <KindChoice kind={kind} onKind={onKind} disabled={chooser.busy} />

      <MarkChooser {...chooser} />

      {/*
        🔴 **Η ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΠΕΡΙΚΟΠΗΣ ΕΙΝΑΙ ΠΡΙΝ, ΟΧΙ ΜΕΤΑ.** Το κατηγόρημα ρωτά **το
        σχήμα** (`maskCrops`), όχι το όνομα του είδους — ώστε ένα τρίτο κυκλικό είδος να
        την πάρει **δωρεάν**, και ένα τετράγωνο να μην την πάρει ποτέ κατά λάθος.
      */}
      {maskCrops(kind) && (
        <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_MARK_KEYS.cropNote)}</p>
      )}

      <MarkStatus state={state} tooSmall={tooSmall} />
    </>
  );
}

/**
 * **Η επικεφαλίδα του πεδίου** — τίτλος και το «γιατί δεν σου λείπει τίποτα».
 *
 * 🔑 Χωριστή για τον N.7.1, και **δεν κοστίζει τίποτα σε νόημα**: δύο γραμμές κειμένου
 * που δεν εξαρτώνται από καμία κατάσταση.
 */
function MarkHeading(): React.JSX.Element {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <header className="flex flex-col gap-1">
      <h2 className="m-0 text-sm font-medium text-foreground">{t(SHOWCASE_MARK_KEYS.label)}</h2>
      <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_MARK_KEYS.hint)}</p>
    </header>
  );
}

/**
 * **Το κρυφό χειριστήριο αρχείου.**
 *
 * ⚠️ **Ρητοί τύποι, όχι `image/*`**: ο καθαριστής δέχεται ό,τι αποκωδικοποιεί το `sharp`,
 * αλλά ένα `image/svg+xml` είναι **εκτελέσιμο έγγραφο**, όχι εικόνα.
 *
 * 🔑 **Το `accept` ΔΕΝ είναι φρουρός** — είναι **ευγένεια** προς τον επιλογέα αρχείων του
 * λειτουργικού. Ο φρουρός ζει στον διακομιστή, και ο άνθρωπος μπορεί πάντα να διαλέξει
 * «όλα τα αρχεία».
 */
function MarkFileInput({
  id,
  disabled,
  onFile,
}: {
  readonly id: string;
  readonly disabled: boolean;
  readonly onFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}): React.JSX.Element {
  return (
    <input
      id={id}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      disabled={disabled}
      onChange={onFile}
      className="sr-only"
    />
  );
}

/**
 * **Η προεπισκόπηση και οι δύο πράξεις** — επιλογή/αλλαγή και αφαίρεση.
 *
 * 🔑 **Εξαγωγή, όχι τρίμμα** (N.7.1): ο ορχηστρωτής είχε ξεπεράσει τις 40 γραμμές κώδικα,
 * και το κομμάτι που έφυγε είναι **ολόκληρο ένα ερώτημα** — *«τι κάνει ο άνθρωπος με το
 * αρχείο;»* — απέναντι στο *«τι είδους σήμα είναι;»* του {@link KindChoice}. Δύο
 * ερωτήματα, δύο συναρτήσεις.
 */
function MarkChooser({
  published,
  inputId,
  busy,
  onFile,
  onRemove,
}: MarkChooserProps): React.JSX.Element {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <div className="flex items-center gap-4">
      {published !== null && (
        <ShowcaseMarkPreview
          src={published.image.url}
          kind={published.kind}
          alt={t(SHOWCASE_MARK_ALT_KEYS[published.kind])}
        />
      )}

      <div className="flex flex-col gap-2">
        {/*
          🔑 **`label` + κρυφό `input`**, το ίδιο ιδίωμα με το `OwnerPropertyMediaField`:
          ένα `<input type="file">` δεν στυλίζεται, και ένα κουμπί που καλεί
          `input.click()` χάνει τη σύνδεση ετικέτας-χειριστηρίου που χρειάζεται ο
          αναγνώστης οθόνης.

          ⚠️ **Δύο ξεχωριστά `t()`, όχι τριαδικός μέσα στην κλήση**: ο τεμαχιστής του
          ADR-744 διαβάζει **κυριολεκτικά** ορίσματα, και ένα `t(a ? X : Y)` είναι
          έκφραση χρόνου εκτέλεσης — δηλαδή θα αρνιόταν τη διαδρομή.
        */}
        <Label
          htmlFor={inputId}
          className="inline-block cursor-pointer rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
        >
          {published === null ? t(SHOWCASE_MARK_KEYS.choose) : t(SHOWCASE_MARK_KEYS.replace)}
        </Label>
        <MarkFileInput id={inputId} disabled={busy} onFile={onFile} />

        {published !== null && (
          // 🔑 Απόφαση **3**: καμία επιβεβαίωση. Το ιδιωτικό αρχείο μένει.
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void onRemove()}>
            {t(SHOWCASE_MARK_KEYS.remove)}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * **«Τι δείχνει η εικόνα;»** — δύο επιλογές, και η **υπόδειξη κάθε μιας** είναι η
 * πληροφορία που κάνει την επιλογή.
 *
 * 🔴 **Ο πίνακας παράγει τις γραμμές, ΔΕΝ γράφονται δύο φορές**: τρίτο είδος στο
 * {@link SHOWCASE_MARK_KINDS} εμφανίζεται εδώ **μόνο του** — και το `Record` των
 * κλειδιών από κάτω **σπάει τη μεταγλώττιση** μέχρι να αποκτήσει κείμενο.
 */
function KindChoice({
  kind,
  onKind,
  disabled,
}: {
  readonly kind: ShowcaseMarkKind;
  readonly onKind: (next: ShowcaseMarkKind) => void;
  readonly disabled: boolean;
}): React.JSX.Element {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-xs font-medium text-muted-foreground">
        {t(SHOWCASE_MARK_KEYS.kindLegend)}
      </legend>
      <RadioGroup
        value={kind}
        disabled={disabled}
        onValueChange={(next) => onKind(next as ShowcaseMarkKind)}
        className="gap-3"
      >
        {SHOWCASE_MARK_KINDS.map((option) => (
          <span key={option} className="flex items-start gap-2">
            <RadioGroupItem value={option} id={`mark-kind-${option}`} className="mt-0.5" />
            <span className="flex flex-col">
              <Label htmlFor={`mark-kind-${option}`} className="text-sm font-medium text-foreground">
                {t(SHOWCASE_MARK_KIND_LABEL_KEYS[option])}
              </Label>
              <span className="text-xs text-muted-foreground">{t(SHOWCASE_MARK_KIND_HINT_KEYS[option])}</span>
            </span>
          </span>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/**
 * **Τι συμβαίνει τώρα** — μία πρόταση, ποτέ δύο για το ίδιο γεγονός.
 *
 * 🔑 **`aria-live="polite"` σε ΕΝΑ σημείο**: ο αναγνώστης οθόνης ανακοινώνει τη μετάβαση
 * *«ανεβαίνει → δημοσιεύεται → έτοιμο»* χωρίς να διακόπτει τον άνθρωπο. Δύο ζωντανές
 * περιοχές θα διάβαζαν η μία πάνω στην άλλη.
 *
 * ⚠️ **`role="alert"` ΜΟΝΟ στο σφάλμα**: το `alert` **διακόπτει**, και μια διακοπή για
 * *«ανεβαίνει…»* είναι θόρυβος. Η κατάσταση και η αστοχία δεν έχουν την ίδια επείγουσα.
 */
function MarkStatus({
  state,
  tooSmall,
}: {
  readonly state: ShowcaseMarkState;
  readonly tooSmall: { readonly shortest: number; readonly required: number } | null;
}): React.JSX.Element | null {
  const { t } = useTranslation([SHOWCASE_NS]);

  if (state.state === 'idle') return null;

  if (state.state === 'uploading' || state.state === 'publishing' || state.state === 'removing') {
    const key =
      state.state === 'uploading'
        ? SHOWCASE_MARK_KEYS.uploading
        : state.state === 'publishing'
          ? SHOWCASE_MARK_KEYS.publishing
          : SHOWCASE_MARK_KEYS.removing;
    return (
      <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
        {t(key)}
      </p>
    );
  }

  // 🔴 **ΤΟ «warned» ΔΕΝ ΕΙΝΑΙ ΣΦΑΛΜΑ**: η εικόνα **μπήκε**. Γι' αυτό `muted`, όχι
  //    `destructive`, και `polite`, όχι `alert` — μια πράξη που πέτυχε δεν κοκκινίζει.
  if (state.state === 'warned') {
    return (
      <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
        {state.reach.coversCard
          ? t(SHOWCASE_MARK_KEYS.blurryPage, { shortest: state.reach.shortest })
          : t(SHOWCASE_MARK_KEYS.blurryEverywhere, {
              shortest: state.reach.shortest,
              ideal: MARK_IDEAL_EDGE,
            })}
      </p>
    );
  }

  return (
    <p role="alert" className="m-0 text-sm text-destructive">
      <MarkFailure state={state} tooSmall={tooSmall} />
    </p>
  );
}

/**
 * **Γιατί δεν έγινε** — και κάθε `t()` εδώ είναι **επιλύσιμο στατικά**.
 *
 * 🔴 **Οι τοπικές αρνήσεις και του διακομιστή δεν ισοπεδώνονται.** Οι πρώτες γεννιούνται
 * πριν από κάθε δίκτυο και έχουν δικά τους κείμενα· οι δεύτερες περνούν από τον
 * `SHOWCASE_REJECTION_KEYS`, που είναι ο **ίδιος** πίνακας με τη δήλωση της βιτρίνας —
 * ένα αντίγραφο εδώ θα απέκλινε στην πρώτη διόρθωση διατύπωσης.
 */
function MarkFailure({
  state,
  tooSmall,
}: {
  readonly state: Extract<ShowcaseMarkState, { state: 'rejected' | 'failed' }>;
  readonly tooSmall: { readonly shortest: number; readonly required: number } | null;
}): React.JSX.Element {
  const { t } = useTranslation([SHOWCASE_NS]);

  if (state.state === 'failed') {
    // ⚠️ **Ένα κείμενο για τα τρία στάδια, και είναι σωστό**: η θεραπεία είναι η ίδια
    //    *(«ξαναδοκίμασε»)*. Το `at` μένει στον τύπο για την ημέρα που θα διαφέρουν.
    return <>{t(SHOWCASE_MARK_KEYS.uploadFailed)}</>;
  }

  if (state.verdict === 'mark-unreadable') {
    return <>{t(SHOWCASE_MARK_KEYS.unreadable)}</>;
  }

  if (state.verdict === 'mark-too-small') {
    // 🔑 **Δύο νούμερα, όχι ένα**: *«έχεις 40, χρειάζονται 64»* λέει στον άνθρωπο **πόσο**
    //    λείπει. Ένα σκέτο «πολύ μικρή» τον αφήνει να μαντεύει.
    return (
      <>
        {t(SHOWCASE_MARK_KEYS.tooSmall, {
          shortest: tooSmall?.shortest ?? 0,
          required: tooSmall?.required ?? 0,
        })}
      </>
    );
  }

  return <>{t(SHOWCASE_REJECTION_KEYS[state.verdict])}</>;
}
