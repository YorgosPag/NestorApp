'use client';

/**
 * @fileoverview **ΤΑ ΚΕΙΜΕΝΑ ΤΗΣ ΦΙΛΟΞΕΝΟΥΜΕΝΗΣ ΕΠΑΦΗΣ** — ό,τι λέει ο δρόμος της απόδειξης.
 * @related components/contact/first-contact-labels.ts (τα κείμενα της ΠΡΑΞΗΣ) · ADR-844
 * @module components/contact/first-contact-guest-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΟ `first-contact-labels.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Δύο ακροατήρια που δεν συναντιούνται ποτέ στην ίδια οθόνη**:
 *
 * | Ακροατήριο | Πού στέκεται | Τι διαβάζει |
 * |---|---|---|
 * | Ο **αποδεδειγμένος** | διάλογος πάνω στην αγγελία | `contact.first.*` |
 * | Ο **φιλοξενούμενος** | σελίδα από **email**, χωρίς ταυτότητα | `contact.guest/link/invitation.*` |
 *
 * Ένα κοινό αρχείο θα έβαζε **και τα δύο** λεξιλόγια στη στατική κλειστότητα **και των
 * δύο** επιφανειών — ακριβώς το κόστος που το `first-contact-labels.ts` περιγράφει στην
 * κεφαλίδα του *(«η `dynamicKeyPolicy` του τεμαχιστή ζει ανά ΑΡΧΕΙΟ»)*. Η σελίδα του
 * συνδέσμου είναι **ψυχρή είσοδος**: ο άνθρωπος έρχεται από email, χωρίς προηγούμενη
 * πλοήγηση, και **κάθε** byte της είναι byte που περιμένει.
 *
 * ⚠️ **ΚΥΡΙΟΛΕΚΤΙΚΟΙ ΠΙΝΑΚΕΣ, ΟΧΙ SPREAD** — ο εξαγωγέας διαβάζει **τιμές σταθεράς
 * module**· ένα `{...A, ...B}` βγαίνει *«unresolved dynamic t()»* (CHECK 3.8).
 */

import {
  FIRST_CONTACT_INVITATION_REFUSALS,
  type FirstContactInvitationRefusal,
} from '@/types/first-contact-invitation';

/**
 * Ίδιο namespace με την πράξη — **μία** βάση για όλο το `contact.*`.
 *
 * ⚠️ **Re-export από ΤΡΙΤΟ αρχείο, ΟΧΙ δεύτερη δήλωση και ΟΧΙ από το
 * `first-contact-labels.ts`** — και οι δύο εναλλακτικές χάνουν:
 *
 * | Εναλλακτική | Τι κοστίζει |
 * |---|---|
 * | `const FIRST_CONTACT_NS = 'property-market'` **και εδώ** | **δύο αλήθειες**· η απόκλιση είναι **αόρατη** *(το `useTranslation(['λάθος-ns'])` δεν πετά — απλώς δεν φορτώνει, και η οθόνη βάφει ωμά κλειδιά)* |
 * | `export { FIRST_CONTACT_NS } from './first-contact-labels'` | σέρνει **ολόκληρο** το `ACT_KEYS` στη στατική κλειστότητα **κάθε** καταναλωτή αυτού του αρχείου — ακριβώς το κόστος που ο διαχωρισμός υπάρχει για να αποφύγει |
 */
export { FIRST_CONTACT_NS } from './first-contact-namespace';

/**
 * **ΟΙ ΕΠΤΑ ΑΡΝΗΣΕΙΣ ΤΟΥ ΣΥΝΔΕΣΜΟΥ** — και καθεμία στέλνει αλλού.
 *
 * 🔴 **ΠΛΗΡΗΣ `Record` ΠΑΝΩ ΣΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ**: όγδοος λόγος άρνησης **δεν
 * μεταγλωττίζεται** χωρίς κείμενο. Είναι ο ίδιος φρουρός που έπιασε το
 * `listing-conflicting-mandate` στο γειτονικό υποσύστημα — **αφού** είχε ήδη σταλεί
 * ζωντανά.
 *
 * ⛔ **ΚΑΝΕΝΑ ΚΟΙΝΟ «άκυρος σύνδεσμος».** Το `already-used` είναι **επιτυχία στο
 * παρελθόν** *(«έγινε, μην ξαναπροσπαθήσεις»)*, το `superseded` λέει *«ψάξε το νεότερο
 * email»*, και το `expired` *«ζήτα νέο»*. Ένα κοινό μήνυμα θα έλεγε σε αθώο άνθρωπο ότι
 * κάποιος τον εξαπατά, ενώ απλώς άργησε τρεις μέρες.
 */
export const INVITATION_REFUSAL_KEYS: Record<FirstContactInvitationRefusal, string> = {
  'link-invalid': 'property-market:contact.invitation.link-invalid',
  'invitation-unknown': 'property-market:contact.invitation.invitation-unknown',
  expired: 'property-market:contact.invitation.expired',
  'already-used': 'property-market:contact.invitation.already-used',
  superseded: 'property-market:contact.invitation.superseded',
  'code-wrong': 'property-market:contact.invitation.code-wrong',
  'code-exhausted': 'property-market:contact.invitation.code-exhausted',
};

/**
 * **«ΚΟΙΤΑΞΤΕ ΤΟ EMAIL ΣΑΣ»** — η κατάσταση του διαλόγου ανάμεσα στην υποβολή και την
 * απόδειξη, **και** οι εκβάσεις που μοιράζονται οι δύο πόρτες.
 *
 * 🔑 **Το `why` δεν είναι διακόσμηση.** Χωρίς αυτό, ο άνθρωπος που δεν πατά τον
 * σύνδεσμο φεύγει νομίζοντας ότι το μήνυμα **στάλθηκε** — και περιμένει απάντηση που
 * δεν θα έρθει ποτέ, από ιδιοκτήτη που **δεν έμαθε ποτέ** ότι υπήρξε.
 *
 * ⚠️ Τα `identityRefused` / `writeFailed` / `failed` τα διαβάζουν **και οι δύο** πόρτες
 * *(ο διάλογος με τον κωδικό, η σελίδα με τον σύνδεσμο)*: είναι εκβάσεις της
 * **ακολουθίας**, όχι της οθόνης. Δεύτερο αντίγραφο θα απέκλινε στην πρώτη διόρθωση.
 */
export const GUEST_KEYS = {
  title: 'property-market:contact.guest.title',
  lead: 'property-market:contact.guest.lead',
  why: 'property-market:contact.guest.why',
  codeLabel: 'property-market:contact.guest.codeLabel',
  codeHint: 'property-market:contact.guest.codeHint',
  submit: 'property-market:contact.guest.submit',
  submitting: 'property-market:contact.guest.submitting',
  /** Η πρόσκληση **γράφτηκε**, το email **δεν έφυγε** — και το λέμε (N.12). */
  notSent: 'property-market:contact.guest.notSent',
  identityRefused: 'property-market:contact.guest.identityRefused',
  /**
   * 🔴 **ΤΟ ΔΗΛΩΜΕΝΟ ΟΡΙΟ #2 ΤΟΥ ADR-844, ΜΕ ΦΩΝΗ.** Έγκυρη απόδειξη + αποτυχία γραφής
   * ⇒ η πρόσκληση **έχει ήδη σφραγιστεί**, άρα ο ίδιος σύνδεσμος **δεν ξαναδουλεύει**.
   * Το κείμενο στέλνει στη **μία** διέξοδο που υπάρχει: νέα υποβολή, νέα πρόσκληση.
   */
  writeFailed: 'property-market:contact.guest.writeFailed',
  failed: 'property-market:contact.guest.failed',
} as const;

/**
 * **Η ΣΕΛΙΔΑ ΤΟΥ ΣΥΝΔΕΣΜΟΥ** (`/contact/[token]`) — το χρώμιο που δεν υπάρχει αλλού.
 *
 * ⚠️ **Το `signInFailed` λέει ΠΡΩΤΑ ότι το μήνυμα έφυγε.** Η σύνδεση είναι **δώρο, όχι
 * προϋπόθεση** *(δες `first-contact-guest.service.ts`)*: η πράξη γράφτηκε στον
 * διακομιστή **πριν** φύγει το εφήμερο κλειδί. Ένα μήνυμα που ξεκινά με «κάτι πήγε
 * στραβά» θα έκανε τον άνθρωπο να ξαναπροσπαθήσει για κάτι που **ήδη πέτυχε**.
 */
export const LINK_KEYS = {
  doneTitle: 'property-market:contact.link.doneTitle',
  doneLead: 'property-market:contact.link.doneLead',
  alreadyTitle: 'property-market:contact.link.alreadyTitle',
  alreadyLead: 'property-market:contact.link.alreadyLead',
  refusedTitle: 'property-market:contact.link.refusedTitle',
  signingIn: 'property-market:contact.link.signingIn',
  signInFailed: 'property-market:contact.link.signInFailed',
  signIn: 'property-market:contact.link.signIn',
} as const;

/** Ο κωδικός σε σειρά — για την άγκυρα πληρότητας, ώστε **λείπον κλειδί να κοκκινίζει**. */
export const FIRST_CONTACT_GUEST_LABEL_SOURCES = {
  invitationRefusals: FIRST_CONTACT_INVITATION_REFUSALS,
} as const;
