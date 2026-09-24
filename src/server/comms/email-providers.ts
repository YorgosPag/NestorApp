/**
 * =============================================================================
 * ΟΙ ΚΡΙΚΟΙ ΤΗΣ ΑΛΥΣΙΔΑΣ — Mailgun · Resend (ADR-777 §8.26)
 * =============================================================================
 *
 * ⚠️ **ΚΑΝΕΝΑΣ ΝΕΟΣ ΠΕΛΑΤΗΣ.** Υπάρχουν ήδη **δύο** στο repo και αυτό το αρχείο
 * δεν προσθέτει τρίτο: οι κρίκοι φτάνουν στις **πόρτες εξόδου** (`egress/mailgun-transport` μέσω
 * `EmailAdapter` · `egress/resend-transport`, ADR-876 §5.8 Σ22 — τα ΜΟΝΑ αρχεία που μιλούν με πάροχο). Είναι
 * **προσαρμογείς** — μεταφράζουν ένα {@link EgressResult} σε ένα {@link ProviderAttempt}, τίποτα άλλο.
 *
 * 🔑 **Γιατί εδώ και όχι μέσα στην αλυσίδα**: η αλυσίδα απαντά «τι κάνω όταν πέσει
 * ένας;» και είναι δοκιμάσιμη με πλαστούς κρίκους, **χωρίς δίκτυο**. Αν οι
 * πραγματικοί πάροχοι ζούσαν μέσα της, κάθε άγκυρα θα χρειαζόταν mock του Mailgun.
 *
 * 🔶 **Η σειρά ΕΙΝΑΙ πολιτική**: Resend πρώτος (πλουσιότερη αναφορά παράδοσης),
 * Mailgun δεύτερος. Ζει στο {@link defaultEmailChain} και **πουθενά αλλού**, ώστε
 * να μην μπορούν δύο διαδρομές να έχουν διαφορετική προτίμηση.
 *
 * @module server/comms/email-providers
 * @see ADR-777 §8.26
 * @see ADR-857 §6 Φ9 — ο αποστολέας ρωτιέται, δεν μαντεύεται εδώ
 */

import 'server-only';

import {
  safeHeaderEntries,
  type EmailProvider,
  type OutboundEmail,
  type ProviderAttempt,
} from '@/server/comms/email-provider-chain';
import { EmailAdapter } from '@/server/comms/email-adapter';
import { mailgunAvailable } from '@/server/comms/egress/mailgun-transport';
import { resendAvailable, resendSendMessage } from '@/server/comms/egress/resend-transport';
import type { EgressResult } from '@/server/comms/egress/egress-email';

function asAttempt(result: EgressResult): ProviderAttempt {
  return result.ok ? { kind: 'delivered', messageId: result.messageId } : { kind: 'rejected', error: result.error };
}

/**
 * Ο κρίκος Mailgun — μέσω του `EmailAdapter`, που αναθέτει στην **πόρτα εξόδου** (ADR-876 §5.8 Σ22).
 *
 * ⚠️ Ο έλεγχος έγχυσης κεφαλίδων γίνεται **πριν** την πόρτα — και στους δύο κρίκους.
 * ⚠️ Το `configured` ρωτά την πόρτα: σε emulator **πάντα** διαθέσιμος (outbox, όχι δίκτυο).
 * ⚠️ Ο adapter επιστρέφει `{ success:false }` **χωρίς να πετά** — εδώ γίνεται ρητή `rejected`,
 *    ώστε η αλυσίδα να **προχωρήσει** στον επόμενο αντί να θεωρήσει ότι το email έφυγε.
 */
export function mailgunProvider(): EmailProvider {
  return {
    name: 'mailgun',
    configured: mailgunAvailable(),
    async send(message: OutboundEmail): Promise<ProviderAttempt> {
      const headers = Object.fromEntries(safeHeaderEntries(message.headers));
      const result = await new EmailAdapter().sendEmail({
        id: `chain_${message.to}`,
        to: message.to,
        subject: message.subject,
        content: message.text,
        html: message.html,
        from: message.from,
        headers,
        attempts: 1,
        maxAttempts: 1,
      });
      return result.success
        ? { kind: 'delivered', messageId: result.messageId }
        : { kind: 'rejected', error: result.error ?? 'mailgun: άγνωστο σφάλμα' };
    },
  };
}

/**
 * Ο κρίκος Resend — προσαρμογέας πάνω στην **πόρτα εξόδου**. Εκεί ζουν η δυναμική εισαγωγή του SDK
 * και ο έλεγχος `result.error` (το Resend **δεν πετά** σε απόρριψη).
 */
export function resendProvider(): EmailProvider {
  return {
    name: 'resend',
    configured: resendAvailable(),
    async send(message: OutboundEmail): Promise<ProviderAttempt> {
      const headers = Object.fromEntries(safeHeaderEntries(message.headers));
      return asAttempt(await resendSendMessage({ ...message, headers }));
    },
  };
}

/*
 * 🔴 ΕΔΩ ΖΟΥΣΕ ΤΟ `defaultFrom()` — ΚΑΙ ΗΤΑΝ Η ΜΙΑ ΑΠΟ ΤΙΣ ΕΞΙ (ADR-857 Φ9).
 *
 * Διάβαζε `FROM_EMAIL`/`FROM_NAME` με δική του εφεδρεία, ενώ **τα ίδια δύο** τα
 * διάβαζαν ανεξάρτητα το `services/email.service.ts` και το
 * `subapps/procurement/.../email-channel.ts` — **τρεις** αναγνώσεις, και άλλες **τρεις**
 * οικογένειες αλλού (`MAILGUN_FROM_EMAIL`, η σκληρή γραμμή του `orchestrator.ts`, το
 * νεκρό `NEXT_PUBLIC_DEFAULT_FROM_*`). Σύνολο **6 οικογένειες · 9 αρχεία · 8 εφεδρείες**.
 *
 * Η απάντηση ζει πλέον **μία φορά** στο `services/company/sender-identity.ts`, γιατί
 * «ποιος υπογράφει;» είναι ερώτημα **του ενοίκου**, όχι του κρίκου που τυχαίνει να
 * στέλνει. ⚠️ ΜΗΝ ξαναδιαβάσεις εδώ μεταβλητή περιβάλλοντος αποστολέα.
 */

/**
 * **Η αλυσίδα του συστήματος.**
 *
 * ⚠️ **Κατασκευάζεται σε κάθε κλήση, όχι σε module scope.** Ένα σταθερό αντικείμενο
 * θα διάβαζε το περιβάλλον **μία φορά, τη στιγμή της εισαγωγής** — και η προσθήκη
 * του `RESEND_API_KEY` δεν θα είχε καμία επίδραση μέχρι επανεκκίνηση, χωρίς κανένα
 * σημάδι. Ακριβώς το σχήμα «η ρύθμιση λέει ψέματα» που διόρθωσε το §8.23.
 */
export function defaultEmailChain(): readonly EmailProvider[] {
  return [resendProvider(), mailgunProvider()];
}
