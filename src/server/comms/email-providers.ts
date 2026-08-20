/**
 * =============================================================================
 * ΟΙ ΚΡΙΚΟΙ ΤΗΣ ΑΛΥΣΙΔΑΣ — Mailgun · Resend (ADR-777 §8.26)
 * =============================================================================
 *
 * ⚠️ **ΚΑΝΕΝΑΣ ΝΕΟΣ ΠΕΛΑΤΗΣ.** Υπάρχουν ήδη **δύο** στο repo και αυτό το αρχείο
 * δεν προσθέτει τρίτο: ο κρίκος Mailgun καλεί τον υπάρχοντα `EmailAdapter`, ο
 * κρίκος Resend το υπάρχον `resend` SDK. Είναι **προσαρμογείς** — μεταφράζουν δύο
 * διαφορετικά σχήματα απάντησης σε ένα {@link ProviderAttempt}, τίποτα άλλο.
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
 */

import 'server-only';

import { EmailAdapter } from '@/server/comms/email-adapter';
import type { EmailProvider, OutboundEmail, ProviderAttempt } from '@/server/comms/email-provider-chain';

/** Το SDK του Resend, φορτωμένο **τεμπέλικα**. */
type ResendSendResult = {
  data?: { id?: string } | null;
  error?: { message?: string } | null;
};

/**
 * Ο κρίκος Mailgun.
 *
 * ⚠️ Ο `EmailAdapter` επιστρέφει `{ success:false }` **χωρίς να πετά** όταν λείπει
 * ρύθμιση — το ίδιο σχήμα σιωπηλής αποτυχίας που γέννησε ολόκληρο το §8.23. Εδώ
 * μεταφράζεται σε ρητή `rejected`, ώστε η αλυσίδα να **προχωρήσει** στον επόμενο
 * αντί να θεωρήσει ότι το email έφυγε.
 */
export function mailgunProvider(): EmailProvider {
  const configured = Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
  const adapter = configured ? new EmailAdapter() : null;

  return {
    name: 'mailgun',
    configured,
    async send(message: OutboundEmail): Promise<ProviderAttempt> {
      if (!adapter) return { kind: 'rejected', error: 'mailgun: δεν είναι ρυθμισμένος' };

      const result = await adapter.sendEmail({
        id: `chain_${message.to}`,
        to: message.to,
        subject: message.subject,
        content: message.text,
        html: message.html,
        from: message.from,
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
 * Ο κρίκος Resend.
 *
 * ⚠️ **Το SDK εισάγεται δυναμικά**, ώστε ένα περιβάλλον χωρίς `RESEND_API_KEY` να
 * μη φορτώνει καθόλου τη βιβλιοθήκη — και, το σημαντικότερο, ώστε οι άγκυρες της
 * αλυσίδας να τρέχουν χωρίς αυτήν.
 *
 * ⚠️ **Το Resend ΔΕΝ πετά σε σφάλμα API**: επιστρέφει `{ data:null, error:{...} }`.
 * Ένας έλεγχος μόνο με `try/catch` θα διάβαζε κάθε απόρριψη ως **επιτυχία** — και η
 * αλυσίδα δεν θα μετέπιπτε ποτέ, ακριβώς στην περίπτωση που υπάρχει γι' αυτήν.
 */
export function resendProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;

  return {
    name: 'resend',
    configured: Boolean(apiKey),
    async send(message: OutboundEmail): Promise<ProviderAttempt> {
      if (!apiKey) return { kind: 'rejected', error: 'resend: δεν είναι ρυθμισμένος' };

      const { Resend } = await import('resend');
      const client = new Resend(apiKey);

      const result = (await client.emails.send({
        from: message.from ?? defaultFrom(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      })) as ResendSendResult;

      if (result.error) {
        return { kind: 'rejected', error: result.error.message ?? 'resend: άγνωστο σφάλμα' };
      }
      return { kind: 'delivered', messageId: result.data?.id };
    },
  };
}

/** Η διεύθυνση αποστολέα όταν ο καλών δεν ορίζει δική του. */
function defaultFrom(): string {
  const email = process.env.FROM_EMAIL ?? 'info@nestorconstruct.gr';
  const name = process.env.FROM_NAME ?? 'Nestor Construct';
  return `${name} <${email}>`;
}

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
