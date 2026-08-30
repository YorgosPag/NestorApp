'use client';

/**
 * @fileoverview **ΤΟ ΠΕΔΙΟ ΤΟΥ ΑΦΜ** — ένα πεδίο, δύο ακροατήρια, μία εμφάνιση.
 * @related ADR-827 §9.20 · §9.21 ι #1 · components/account/tax-identity-labels.ts · CLAUDE.md N.18
 * @module components/account/TaxIdentityField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ: Ο ΔΕΥΤΕΡΟΣ ΚΑΤΑΝΑΛΩΤΗΣ ΘΑ ΗΤΑΝ **ΔΟΜΙΚΟ ΔΙΔΥΜΟ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ίδιο πεδίο χρειάζονται **δύο** οθόνες με αντίθετες αφορμές:
 *
 * | Ποιος | Πότε | Γιατί |
 * |---|---|---|
 * | `ProfilePageContent` | όποτε θέλει ο άνθρωπος | *«τα στοιχεία μου»* |
 * | `MandateRequestFormContent` (**Σ1**) | **τη στιγμή της ανάθεσης** | ο νόμος το απαιτεί για τη σύμβαση *(άρ. 200 §2 Ν.4072/2012)* |
 *
 * Γραμμένο δεύτερη φορά με το χέρι, θα ήταν **~30 γραμμές ταυτόσημου JSX** — ο
 * ορισμός του κλώνου που το **CHECK 3.28** μπλοκάρει, και το ακριβές λάθος που
 * προβλέπει ο **N.18**: *«κεντρικοποιείς το Α, γράφεις το Β ως δίδυμο»*.
 *
 * 🔑 **Και το τίμημα δεν θα ήταν οι γραμμές — θα ήταν η ΑΠΟΚΛΙΣΗ.** Η επόμενη
 * βελτίωση προσβασιμότητας *(`aria-describedby`, ο ρόλος του μηνύματος, το
 * αριθμητικό πληκτρολόγιο)* θα έμπαινε **στο ένα** αντίγραφο, και **και τα δύο θα
 * «δούλευαν»**. Είναι κατά λέξη το μάθημα που έγραψε το `FormIssues` όταν εξήχθη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΛΕΓΧΟΜΕΝΟ ΚΑΙ **ΧΩΡΙΣ ΓΡΑΦΕΑ** — Η ΣΤΙΓΜΗ ΤΗΣ ΓΡΑΦΗΣ ΑΝΗΚΕΙ ΣΤΟΝ ΚΑΛΟΥΝΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πειρασμός ήταν να καλεί το ίδιο το πεδίο το `updateVatNumber`. **Απορρίφθηκε**,
 * γιατί οι δύο καταναλωτές γράφουν σε **διαφορετική στιγμή** και η στιγμή είναι
 * **πολιτική τους**, όχι λεπτομέρεια του πεδίου:
 *
 * - Το **προφίλ** γράφει στο πάτημα του ενός «Αποθήκευση», **μαζί** με τα ονόματα
 *   και το επάγγελμα — τρία αποθετήρια, ένα κουμπί.
 * - Ο **Σ1** γράφει στο **blur**, γιατί το ΑΦΜ εκεί δεν είναι «στοιχείο μου» αλλά
 *   **προϋπόθεση της υποβολής**: πρέπει να έχει **σωθεί** πριν ενεργοποιηθεί το
 *   κουμπί, αλλιώς η φόρμα θα υποσχόταν κάτι που δεν ισχύει ακόμη.
 *
 * ⇒ Ένα `when="blur" | "submit"` prop θα ήταν **σημαία που οδηγεί συμπεριφορά** —
 * το κλασικό σχήμα που κρύβει δύο components σε ένα. Εδώ το πεδίο κάνει **ένα**
 * πράγμα *(δείχνει και ζητά εννιά ψηφία)*, και **κανείς δεν του ανέθεσε πολιτική
 * που δεν είναι δική του** — ίδιο δόγμα με το `draft-validation.ts` απέναντι στον
 * `Resolver` του react-hook-form.
 *
 * ⚠️ **Ο ΓΡΑΦΕΑΣ ΠΑΡΑΜΕΝΕΙ ΕΝΑΣ**: `useAuth().updateVatNumber` → `PATCH
 * /api/account/vat-number` → `setOwnVatNumber`. Δύο **καλούντες**, ποτέ δύο γραφείς.
 * ⛔ **ΜΗΝ γράψεις εδώ `setDoc`** — το `vatNumber` είναι `serverOwnedUserFields()`
 * στα `firestore.rules`, **ήδη deployed**, και θα απορριφθεί (σωστά: ο mod-11 δεν
 * εκφράζεται σε κανόνα).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΜΗΝΥΜΑ ΕΙΝΑΙ **ΔΙΠΛΟ**, ΚΑΙ ΕΙΝΑΙ ΤΟ ΠΡΟΤΥΠΟ ΤΟΥ GOV.UK
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η άρνηση εμφανίζεται **δίπλα στο πεδίο** (εδώ, `role="alert"`), ενώ το *«τι
 * λείπει»* εμφανίζεται **συγκεντρωτικά** στο {@link FormIssues} του κελύφους. Δεν
 * είναι πλεονασμός: είναι η τεκμηριωμένη πρακτική *«error summary **και** inline
 * detail»* — η περίληψη λέει **πόσο κοντά είσαι**, το inline λέει **τι να αλλάξεις
 * εδώ**. Ο άνθρωπος που βλέπει μόνο περίληψη ψάχνει το πεδίο· αυτός που βλέπει
 * μόνο inline δεν ξέρει πόσα μένουν.
 *
 * ⚠️ **`useId`, ΠΟΤΕ σταθερό `id="vat-number"`.** Η προηγούμενη γραφή είχε καρφωτό
 * αναγνωριστικό — αβλαβές όσο ο καταναλωτής ήταν **ένας**. Με δύο, μια οθόνη που
 * θα τους έδειχνε μαζί θα παρήγαγε **διπλό `id`**, και το `aria-describedby` θα
 * έδειχνε σε **λάθος** υπόδειξη: σφάλμα προσβασιμότητας που **καμία πύλη δεν
 * πιάνει** και **καμία οθόνη δεν δείχνει**.
 */

import React from 'react';
import { Receipt } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VAT_FIELD_KEYS } from '@/components/account/tax-identity-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/design-system';

/**
 * 🔑 **ΜΟΝΟ ο χώρος ονομάτων που χρειάζεται**, ποτέ το `COMMON_NAMESPACES` (δέκα
 * λεξιλόγια). Ο καταναλωτής του Σ1 φορτώνει **ένα** αρχείο για **έξι** κλειδιά.
 * ⚠️ **Σταθερά module**, όχι κυριολεκτικό μέσα στην κλήση: ο τεμαχιστής διαβάζει
 * σταθερές module από το AST — ίδιο ιδίωμα με το `MANDATE_REQUEST_NS`.
 */
const TAX_IDENTITY_NS = 'common-account';

export interface TaxIdentityFieldProps {
  /** Ό,τι δείχνει το πεδίο **τώρα** — η κατάσταση ανήκει στον καλούντα. */
  readonly value: string;
  /** Κάθε πληκτρολόγηση. Ο καλών αποφασίζει πότε γίνεται γραφή. */
  readonly onChange: (next: string) => void;
  /**
   * Το πεδίο έχασε την εστίαση, **με την τιμή ήδη περικομμένη**.
   *
   * 🔑 Χωριστό από το `onChange` γιατί εδώ ζει η **επικυρωμένη πρόθεση**: η έρευνα
   * προσβασιμότητας συγκλίνει σε *«επικύρωση στο blur, ποτέ σε κάθε πλήκτρο»* —
   * ο αναγνώστης οθόνης που ανακοινώνει σφάλμα στο **τρίτο** από τα εννιά ψηφία
   * λέει ψέματα σε κάποιον που απλώς δεν τελείωσε.
   */
  readonly onCommit?: (trimmed: string) => void;
  /** Κλειδί i18n της τρέχουσας ένστασης — από το {@link vatIssueKey}. */
  readonly issueKey: string | null;
  readonly disabled: boolean;
}

export function TaxIdentityField({
  value,
  onChange,
  onCommit,
  issueKey,
  disabled,
}: TaxIdentityFieldProps): React.JSX.Element {
  const { t } = useTranslation([TAX_IDENTITY_NS]);
  const colors = useSemanticColors();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const fieldId = React.useId();
  const hintId = `${fieldId}-hint`;

  return (
    <fieldset className={layout.flexColGap2}>
      <Label htmlFor={fieldId} className={layout.flexCenterGap2}>
        <Receipt className={iconSizes.xs} aria-hidden="true" />
        {t(VAT_FIELD_KEYS.label)}
      </Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          // ⚠️ **Ο καλών παίρνει την περικομμένη τιμή, και η οθόνη τη δείχνει.** Δύο
          //    μορφές του ίδιου ΑΦΜ είναι δύο αλήθειες — ο γραφέας τις ενοποιεί
          //    (`normalizeVat`), αλλά ο άνθρωπος οφείλει να δει **τι θα σταλεί**,
          //    όχι κάτι που θα αλλάξει σιωπηλά στον διακομιστή.
          const trimmed = value.trim();
          if (trimmed !== value) onChange(trimmed);
          onCommit?.(trimmed);
        }}
        placeholder={t(VAT_FIELD_KEYS.placeholder)}
        // 🔑 Αριθμητικό πληκτρολόγιο στο κινητό **χωρίς** `type="number"`: εκείνο θα
        //    επέτρεπε `e`, `+` και δεκαδικά, και θα έκοβε αρχικά μηδενικά. Το ΑΦΜ
        //    είναι **σειρά ψηφίων**, όχι ποσότητα.
        inputMode="numeric"
        autoComplete="off"
        maxLength={32}
        disabled={disabled}
        aria-invalid={issueKey !== null}
        aria-describedby={hintId}
      />
      {issueKey !== null && (
        <output role="alert" className={cn(typography.body.xs, colors.text.error)}>
          {t(issueKey)}
        </output>
      )}
      <p id={hintId} className={cn(typography.body.xs, colors.text.muted)}>
        {t(VAT_FIELD_KEYS.hint)}
      </p>
    </fieldset>
  );
}
