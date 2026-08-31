/**
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ ΠΡΟΣ ΤΟΝ ΙΔΙΟΚΤΗΤΗ** — μία μηχανή αποστολής, δύο καλούντες.
 * @related ADR-777 §8.33 · §8.34 · services/mandate/mandate-email-texts.ts · N.18
 * @module services/mandate/mandate-invitation.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ — ΚΑΙ ΓΙΑΤΙ ΤΩΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι το §8.34 αυτός ο κώδικας ήταν **ιδιωτικός** μέσα στο
 * `brokered-listing.service.ts`, και σωστά: είχε **έναν** καλούντα. Το «ξαναστείλε τον
 * σύνδεσμο» του καταλόγου είναι ο **δεύτερος** — και μια δεύτερη γραφή του θα ήταν
 * ακριβώς ο **αδελφός κλώνος** που κυνηγά ο κανόνας **N.18** (CHECK 3.28): ίδια ουσία,
 * άλλο όνομα, αόρατος στο `ssot:discover` που ψάχνει ονόματα.
 *
 * 🔑 **Και θα απέκλινε αμέσως, με συνέπεια.** Η δεύτερη γραφή θα ξεχνούσε το
 * `idempotencyKey` ή θα το έφτιαχνε αλλιώς — και τότε ένα διπλό κλικ στο «ξαναστείλε»
 * θα έστελνε **δύο μηνύματα** στον ίδιο άνθρωπο για το ίδιο ακίνητο. Ο αντι-spam
 * φρουρός δεν είναι λεπτομέρεια υλοποίησης· είναι **ό,τι κρατά το γραφείο ευγενικό**.
 *
 * ⚠️ **Δεν γράφει ΤΙΠΟΤΑ στη βάση.** Στέλνει και λέει τι έγινε. Η σφραγίδα
 * `notifiedAt` μπαίνει από τον καλούντα, **μόνο** μετά από `sent` — γιατί «τον
 * ειδοποιήσαμε» πρέπει να σημαίνει ότι όντως φύγε μήνυμα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
// 🔴 ADR-834 §6.5.γ — **ΤΟ ΤΕΤΑΡΤΟ ΜΕΛΟΣ ΤΗΣ ΙΔΙΑΣ ΚΛΑΣΗΣ, ΚΑΙ ΤΟ ΜΟΝΟ ΠΟΥ ΕΙΝΑΙ
//    ΤΟ ΙΔΙΟ ΤΟ ΕΓΓΡΑΦΟ.** Ήταν `formatDate` — δηλαδή η ζώνη του **διακομιστή** πάνω σε
//    `…T23:59:59.999Z` ⇒ το μήνυμα έγραφε *«θα ισχύει μέχρι 01/05/2027»* ενώ ο μεσίτης
//    δήλωσε **30/04/2027** (μετρημένο ζωντανά στην ουρά, §6.5.α #12). Οι τρεις οθόνες
//    **πληροφορούν**· το άρθρο 200 §1 Ν.4072/2012 δέχεται ρητά *«τα μηνύματα
//    ηλεκτρονικού ταχυδρομείου»* ως **έγγραφο τύπο** της μεσιτικής σύμβασης — άρα εδώ η
//    λάθος ημέρα δεν είναι παρουσίαση, είναι **ο όρος που στέλνεται εγγράφως**.
import { formatTermDay } from '@/lib/mandate/mandate-term-window';
import { createModuleLogger } from '@/lib/telemetry';
import { enqueueMessage } from '@/server/comms/orchestrator';
import { mandateTextsFor, type MandateMessageKind } from '@/services/mandate/mandate-email-texts';
import { MESSAGE_PRIORITIES } from '@/types/communications';
// 🔴 ADR-834 §6.5.δ — **ΤΟ ΛΕΞΙΛΟΓΙΟ ΕΙΝΑΙ ΕΝΑ, ΚΑΙ ΔΕΝ ΖΕΙ ΕΔΩ.** Ως το §6.5.δ οι
//    τρεις εκβάσεις ήταν **ωμά αλφαριθμητικά αυτού του αρχείου** και **καμία δεν
//    αποθηκευόταν** — άρα η οθόνη δεν είχε τι να διαβάσει και μάντευε. Τώρα η έκβαση
//    σφραγίζεται πάνω στην εντολή, οπότε ο **γραφέας** και ο **αναγνώστης** οφείλουν
//    να μιλούν την ίδια γλώσσα· δεύτερη γραφή των ίδιων τριών λέξεων εδώ θα ήταν
//    ακριβώς ο αδελφός κλώνος του N.18, αόρατος σε κάθε αναζήτηση ονόματος.
import { NOTIFY_FAILED, NOTIFY_NO_ADDRESS, NOTIFY_SENT } from '@/types/owner-property-mandate';

const logger = createModuleLogger('mandate-invitation.service');

/**
 * ⚠️ **Η προεπιλογή ΔΕΝ είναι το νεκρό `nestor-app.vercel.app`** που κουβαλούν πέντε
 * άλλες διαδρομές του έργου. Το CLAUDE.md δηλώνει ρητά ότι εκείνο το URL είναι
 * *«dead/legacy»* και η παραγωγή ζει στο **nestorconstruct.gr** (Netcup). Ένας
 * σύνδεσμος συγκατάθεσης προς νεκρό τομέα είναι χειρότερος από κανέναν: ο ιδιοκτήτης
 * νομίζει ότι απάντησε.
 */
export function consentUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestorconstruct.gr';
  return `${base.replace(/\/+$/, '')}/mandate/${encodeURIComponent(token)}`;
}

/**
 * Πώς πήγε η αποστολή — **ρητά**, γιατί το γραφείο πρέπει να το μάθει.
 *
 * 🔑 **Τα `kind` ΔΕΝ είναι κυριολεξίες αυτού του αρχείου**: είναι το
 * `MandateNotifyOutcome`, το λεξιλόγιο που **αποθηκεύεται** πάνω στην εντολή
 * (ADR-834 §6.5.δ). Έτσι το `notify.kind` του καλούντα μπαίνει **αυτούσιο** στο
 * `notifyOutcome`, χωρίς κανέναν μεταφραστή στη μέση — και ένας μεταφραστής είναι
 * ακριβώς ο τόπος όπου δύο λεξιλόγια αποκλίνουν σιωπηλά.
 *
 * ⚠️ **Το `to` μένει ΕΔΩ και δεν αποθηκεύεται**: είναι η απάντηση **της στιγμής**
 * προς την οθόνη που μόλις πάτησε το κουμπί. Στη βάση ζει ήδη το `clientContactId`,
 * και μια δεύτερη γραφή της διεύθυνσης θα ήταν αντίγραφο προσωπικού δεδομένου που
 * παλιώνει μόνο του.
 */
export type NotifyOutcome =
  | { readonly kind: typeof NOTIFY_SENT; readonly to: string }
  /** Η επαφή **δεν έχει email**. Δεν είναι σφάλμα — είναι κατάσταση του κόσμου. */
  | { readonly kind: typeof NOTIFY_NO_ADDRESS }
  | { readonly kind: typeof NOTIFY_FAILED };

/** Η διεύθυνση και η γλώσσα του πελάτη, από την **επαφή** του γραφείου. */
async function readClientChannel(
  adminDb: AdminFirestore,
  clientContactId: string,
): Promise<{ email: string | null; language: unknown }> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .doc(clientContactId)
    .get();

  const data = snapshot.data() as
    | { emails?: unknown; preferredLanguage?: unknown }
    | undefined;

  return {
    email: primaryEmailOf(data?.emails as never),
    language: data?.preferredLanguage,
  };
}

/** Ό,τι χρειάζεται το μήνυμα για να γραφτεί και να ταξιδέψει. */
export interface MandateInvitation {
  readonly clientContactId: string;
  readonly agencyName: string;
  readonly listingTitle: string;
  readonly expiresAt: string;
  readonly token: string;
  /**
   * 🔑 **Ντετερμινιστικό κλειδί** — ο ίδιος αντι-spam φρουρός που χρησιμοποιεί ο
   * αγγελιοφόρος της ζήτησης: δύο κλήσεις για την **ίδια** πρόσκληση δεν γεννούν δύο
   * email. Δεν γράφτηκε καμία ουρά, κανένα «last notified at».
   *
   * ⚠️ **Το `nonce` ΕΙΝΑΙ η ταυτότητα της πρόσκλησης**, άρα νέα πρόσκληση δίνει νέο
   * κλειδί και **επιτρέπεται** να ξαναστείλει, ενώ επανάληψη της ίδιας δεν
   * διπλασιάζει το μήνυμα. Αυτό είναι που κάνει το κουμπί «ξαναστείλε» του καταλόγου
   * ασφαλές χωρίς κανένα ξεχωριστό χρονόμετρο.
   */
  readonly idempotencyKey: string;
}

/**
 * **Στέλνει το μήνυμα** — και δεν πετά ποτέ.
 *
 * ⚠️ **Η αποτυχία της ειδοποίησης ΔΕΝ ακυρώνει την πράξη του μεσίτη**, ίδιο συμβόλαιο
 * με τον γραφέα της δημόσιας προβολής: η δουλειά του έγινε. Ό,τι έγινε λέγεται
 * **ονομαστικά** στο αποτέλεσμα, ώστε η οθόνη να μπορεί να πει «στάλθηκε στον Χ» ή
 * «η επαφή δεν έχει email» — δύο πολύ διαφορετικά πράγματα για το γραφείο.
 */
export async function sendMandateInvitation(
  adminDb: AdminFirestore,
  kind: MandateMessageKind,
  invitation: MandateInvitation,
): Promise<NotifyOutcome> {
  const channel = await readClientChannel(adminDb, invitation.clientContactId);
  if (channel.email === null) return { kind: NOTIFY_NO_ADDRESS };

  const wording = mandateTextsFor(kind, channel.language);
  const url = consentUrl(invitation.token);

  try {
    const result = await enqueueMessage({
      channels: ['email'],
      to: channel.email,
      subject: wording.subject(invitation.agencyName, invitation.listingTitle),
      content: wording.body(
        invitation.agencyName,
        invitation.listingTitle,
        formatTermDay(invitation.expiresAt),
        url,
      ),
      priority: MESSAGE_PRIORITIES.HIGH,
      idempotencyKey: invitation.idempotencyKey,
    });

    return result.success ? { kind: NOTIFY_SENT, to: channel.email } : { kind: NOTIFY_FAILED };
  } catch (error) {
    logger.error('Το μήνυμα προς τον ιδιοκτήτη δεν μπήκε στην ουρά', {
      data: { clientContactId: invitation.clientContactId },
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: NOTIFY_FAILED };
  }
}
