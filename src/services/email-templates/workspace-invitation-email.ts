/**
 * @fileoverview **«ΣΕ ΚΑΛΟΥΝ ΣΕ ΓΡΑΦΕΙΟ»** — το email της πρόσκλησης (ADR-853 Φ5).
 * @module services/email-templates/workspace-invitation-email
 * @related ADR-853 §5 (πού ξεπερνάμε) · §7.1 (η οντότητα) · §7.5 (δύο έλεγχοι) · ADR-857
 *
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3.
 * @note Οι ελληνικές/αγγλικές συμβολοσειρές εδώ **ΔΕΝ** είναι παράβαση του N.11: τα
 *       server-side πρότυπα email φέρουν το κείμενό τους **inline by design** — το `t()`
 *       απαιτεί ενεργό στιγμιότυπο i18next, που σε διακομιστή είναι **καθολική κατάσταση**
 *       πάνω από ασύγχρονο κώδικα (δες την κεφαλίδα του `server/comms/email-texts.ts`).
 *       Η γλώσσα είναι **παράμετρος**, ποτέ τρέχουσα κατάσταση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΙΚΟ ΤΟΥ ΣΧΗΜΑ ΛΟΓΩΝ ΚΑΙ ΟΧΙ ΤΟ `AppMessageWording`
 * ────────────────────────────────────────────────────────────────────────────
 * Το κοινό σχήμα δίνει `intro: (addressHtml) => string` — **ένα** όρισμα. Η πρόσκληση
 * όμως λέει **τρία** πράγματα που ο άνθρωπος πρέπει να ξέρει **πριν** πατήσει: *ποιος*
 * τον καλεί, *σε τι θέση*, και *ως πότε*. Στριμωγμένα σε ένα όρισμα θα γίνονταν
 * προ-συναρμολογημένο HTML μέσα στον πίνακα κειμένων — δηλαδή **λόγια και διάταξη
 * μπλεγμένα**, που είναι ακριβώς ό,τι το `app-message-wording.ts` χώρισε.
 *
 * ⚠️ **ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΔΙΔΥΜΟ ΤΟΥ `renderMessageSection`**: η διάταξη εδώ βάζει τα
 * **στοιχεία της θέσης ΠΡΙΝ** από το κουμπί — ο άνθρωπος αποφασίζει **αφού** διαβάσει
 * ποιος και τι, ποτέ πριν (§5 #4 · anti-phishing). Το πλαίσιο, το κουμπί, τα χρώματα
 * και η υπογραφή έρχονται **αυτούσια** από τα κοινά (`wrapInAppFrame` · `renderShareCta`
 * · `BRAND`), άρα η ταυτότητα μένει **μία**.
 */

import 'server-only';

import { HUMAN_LANGUAGES, resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { globalRoleName } from '@/constants/global-role-text';
import { publicUrl } from '@/lib/http/public-origin';
import { workspaceInvitationHref } from '@/lib/workspace/workspace-routes';
import { INVITABLE_ROLES, type InvitableRole } from '@/types/workspace-invitation';

import { escapeHtml } from './base-email-template';
import type { ConfirmationEmailResult } from './confirmation-email-shared';
import {
  composeInvitationEmail,
  invitationDaysRemaining,
  invitationDetailLine,
  type InvitationEmailCoreWording,
} from './invitation-email-shared';

// =============================================================================
// 1. ΤΑ ΛΟΓΙΑ — ΑΝΑ ΓΛΩΣΣΑ
// =============================================================================

/** Τα λόγια μιας πρόσκλησης χώρου, σε **μία** γλώσσα — τα κοινά (κουμπί · δέσμευση · υποσημείωση) από τον σκελετό. */
interface InvitationWording extends InvitationEmailCoreWording {
  /** ⚠️ Παίρνει το όνομα του χώρου: τα εισερχόμενα διαβάζονται **χωρίς** να ανοιχτεί το μήνυμα. */
  readonly subject: (workspace: string) => string;
  readonly heading: string;
  /** Το όρισμα είναι **ήδη ασφαλές HTML** (ίδιο συμβόλαιο με το `AppMessageWording.intro`). */
  readonly intro: (workspaceHtml: string) => string;
  /** «Θέση: Χ» — η ετικέτα, όχι ο ρόλος. */
  readonly roleLabel: string;
  /** ⚠️ Πληθυντικός/ενικός **ρητά**: «1 ημέρα» ≠ «1 ημέρες». */
  readonly expiry: (days: number) => string;
  // `cta` · `boundToAddress` · `onlyWord` · `footnote`: από το `InvitationEmailCoreWording` (κοινός σκελετός).
  /**
   * 🔴 **ΤΟ `roles` ΕΦΥΓΕ ΑΠΟ ΕΔΩ — ΚΑΙ Η ΠΡΟΗΓΟΥΜΕΝΗ ΓΡΑΦΗ ΤΟ ΑΠΑΓΟΡΕΥΕ ΡΗΤΑ** (ADR-853 §17).
   *
   * Έλεγε: *«ΜΗΝ ενοποιήσεις εισάγοντας το JSON εδώ — θα έδενε τον αποστολέα email με τον
   * φορτωτή namespace του φυλλομετρητή (CHECK 3.36), για μηδέν όφελος»*, και ζητούσε από
   * τον άνθρωπο να κρατά τις λέξεις συγχρονισμένες **με το χέρι**. Το τίμημα μετρήθηκε:
   * **τρία ονόματα για τον ίδιο ρόλο** στην ίδια ροή («Εσωτερικός» · «Εσωτερικός
   * συνεργάτης» · «Εσωτερικός χρήστης»). Η υπόσχεση «αλλαγή εκεί ⇒ αλλαγή εδώ» είναι
   * ακριβώς το είδος που κανένας δεν κρατά και καμία πύλη δεν έβλεπε.
   *
   * 🔑 **Και ο φόβος δεν ίσχυε**: το `constants/global-role-text.ts` κάνει **στατικό import
   * του JSON** — build-time, καμία σχέση με τον φορτωτή namespace του φυλλομετρητή. Ίδιο
   * ιδίωμα με το `project-status-text.ts` (ADR-812), που σερβίρει ήδη λεξιλόγιο σε PDF και
   * σε απαντήσεις εκτός React.
   */
  /**
   * **Όταν το γραφείο δεν έχει δηλώσει όνομα.** Ο διακομιστής στέλνει **κενό**
   * (`readWorkspaceName`) και ⛔ **ποτέ** ωμό `comp_*` — η ετικέτα είναι δουλειά της
   * επιφάνειας, και εδώ **η επιφάνεια είναι το email**.
   */
  readonly unnamedWorkspace: string;
}

/**
 * ⚠️ **`Record<HumanLanguage, …>`, ΠΟΤΕ `Partial`** — τρίτη γλώσσα **δεν
 * μεταγλωττίζεται** χωρίς τα λόγια της. Ίδιος φρουρός με τα `EMAIL_TEXTS` /
 * `AUTH_ACTION_TEXTS` / `DECISION_TEXTS`.
 */
const INVITATION_TEXTS: Readonly<Record<HumanLanguage, InvitationWording>> = {
  el: {
    subject: (workspace) => `Πρόσκληση συνεργασίας από ${workspace}`,
    heading: 'Σας προσκαλούν σε χώρο εργασίας',
    intro: (workspaceHtml) =>
      `Το γραφείο ${workspaceHtml} σας προσκαλεί να συνεργαστείτε μαζί του στον χώρο εργασίας του.`,
    roleLabel: 'Θέση',
    expiry: (days) =>
      days === 1
        ? `Η πρόσκληση ισχύει για <strong>${days} ακόμη ημέρα</strong>.`
        : `Η πρόσκληση ισχύει για <strong>${days} ημέρες</strong>.`,
    cta: 'Δείτε την πρόσκληση',
    onlyWord: 'μόνο',
    boundToAddress: (onlyHtml) =>
      `Ο σύνδεσμος λειτουργεί ${onlyHtml} για αυτή τη διεύθυνση email — `
      + 'αν τον προωθήσετε, δεν θα δουλέψει για κανέναν άλλον.',
    footnote:
      'Αν δεν περιμένατε αυτή την πρόσκληση, αγνοήστε το μήνυμα: χωρίς τη δική σας '
      + 'αποδοχή δεν αποκτά κανείς πρόσβαση σε τίποτα δικό σας.',
    unnamedWorkspace: 'ένα γραφείο',
  },
  en: {
    subject: (workspace) => `${workspace} invited you to collaborate`,
    heading: 'You have been invited to a workspace',
    intro: (workspaceHtml) => `${workspaceHtml} invites you to collaborate in their workspace.`,
    roleLabel: 'Role',
    expiry: (days) =>
      days === 1
        ? `This invitation is valid for <strong>${days} more day</strong>.`
        : `This invitation is valid for <strong>${days} days</strong>.`,
    cta: 'View the invitation',
    onlyWord: 'only',
    boundToAddress: (onlyHtml) =>
      `The link works ${onlyHtml} for this email address — forwarding it `
      + 'will not work for anyone else.',
    footnote:
      'If you were not expecting this invitation, ignore this message: without your '
      + 'acceptance nobody gains access to anything of yours.',
    unnamedWorkspace: 'an office',
  },
};

// =============================================================================
// 2. Η ΣΥΝΑΡΜΟΛΟΓΗΣΗ — πάνω στον ΚΟΙΝΟ σκελετό (`invitation-email-shared`)
// =============================================================================

export interface WorkspaceInvitationEmailInput {
  /** Η γλώσσα του παραλήπτη — από **δεδομένα**, άρα `unknown` (άγνωστη ⇒ προεπιλογή). */
  readonly language: unknown;
  /** Από τον **ΕΝΑ** αναγνώστη (`readWorkspaceName`). Κενό = «δεν δηλώθηκε όνομα». */
  readonly workspaceName: string;
  readonly role: InvitableRole;
  /** Απόλυτη στιγμή λήξης, από το έγγραφο της πρόσκλησης. */
  readonly expiresAt: string;
  /** Το **ωμό** token — υπάρχει μόνο στην επιστροφή της έκδοσης και **εδώ** (§7.4). */
  readonly token: string;
  /** Η **περασμένη** στιγμή· κανένα ρολόι μέσα, ώστε τα άκρα να είναι δοκιμάσιμα. */
  readonly nowISOValue: string;
}

/**
 * **Το email της πρόσκλησης, στη γλώσσα του παραλήπτη.** Η σειρά (στοιχεία **πριν** το κουμπί · «μόνο για αυτή
 * τη διεύθυνση» πριν την προώθηση) ζει στον κοινό σκελετό — εδώ μένουν τα λόγια του χώρου.
 *
 * 🔑 **Οι ημέρες από τον ΙΔΙΟ κανόνα με την οθόνη** (ADR-853 §13 ε.γ) — `invitationDaysRemaining`.
 *
 * @returns `null` **χωρίς δημόσια διεύθυνση** — ποτέ email με σύνδεσμο που δεν ξέρουμε πού οδηγεί.
 */
export function buildWorkspaceInvitationEmail(
  input: WorkspaceInvitationEmailInput,
): ConfirmationEmailResult | null {
  const link = publicUrl(workspaceInvitationHref(input.token));
  if (link === null) return null;

  const language = resolveHumanLanguage(input.language);
  const wording = INVITATION_TEXTS[language];
  const workspace = input.workspaceName.trim().length > 0 ? input.workspaceName.trim() : wording.unnamedWorkspace;
  // 🔑 ADR-853 §17 — **ο ίδιος κατάλογος με την οθόνη**. Το `??` είναι η τίμια εφεδρεία (η πληρότητα είναι άγκυρα).
  const roleName = globalRoleName(language, input.role) ?? input.role;
  const expiry = wording.expiry(invitationDaysRemaining(input.expiresAt, input.nowISOValue));

  return composeInvitationEmail({
    language,
    subject: wording.subject(workspace),
    heading: wording.heading,
    intro: { html: wording.intro(`<strong>${escapeHtml(workspace)}</strong>`), text: wording.intro(workspace) },
    details: [
      invitationDetailLine(wording.roleLabel, roleName),
      // Το `expiry` δεν περιέχει τιμή ανθρώπου — μόνο αριθμό — άρα το κείμενο είναι ασφαλές χωρίς ετικέτες.
      { html: expiry, text: expiry.replace(/<[^>]+>/g, '') },
    ],
    link,
    core: wording,
  });
}

// =============================================================================
// 3. Η ΑΓΚΥΡΑ ΠΛΗΡΟΤΗΤΑΣ
// =============================================================================

/**
 * **Έχει κάθε γλώσσα ΟΛΑ τα λόγια της, για ΚΑΘΕ ρόλο;** — άγκυρα που **εκτελείται**
 * (N.17: στη ροή του πράκτορα ο μεταγλωττιστής δεν είναι φρουρός που τρέχει).
 *
 * ⚠️ Ελέγχει **και τις συναρτήσεις**, όχι μόνο τις σταθερές: ένα `expiry` που επιστρέφει
 * κενό θα περνούσε κάθε έλεγχο «υπάρχει το κλειδί;» και θα έφτανε στα εισερχόμενα.
 */
export function everyLanguageHasInvitationWording(): boolean {
  return HUMAN_LANGUAGES.every((language) => {
    const wording = INVITATION_TEXTS[language];
    if (!wording) return false;
    const texts = [
      wording.subject('χ'),
      wording.heading,
      wording.intro('χ'),
      wording.roleLabel,
      wording.expiry(1),
      wording.expiry(7),
      wording.cta,
      wording.onlyWord,
      wording.boundToAddress(wording.onlyWord),
      wording.footnote,
      wording.unnamedWorkspace,
      ...INVITABLE_ROLES.map((role) => globalRoleName(language, role) ?? ''),
    ];
    return texts.every((text) => typeof text === 'string' && text.length > 0);
  });
}
