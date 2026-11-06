import 'server-only';

/**
 * **Ποια μοντέλα παίρνουν τυπωμένο QR, και πάνω σε ποια διεύθυνση** (ADR-923 §5.13 Σ7 · Δ1 · Δ5).
 * 🔑 **Ν10 α**: και τα απλά προϊόντα (κάρτες πλέγματος), από τον **ίδιο** δρόμο. Το απλό προϊόν είναι δικό του δημόσιο έγγραφο
 *    με id το id του, άρα ο ίδιος ανιχνευτής κρίνει την ορατότητά του. Τα «μοντέλα» παρακάτω σημαίνουν «ό,τι παίρνει QR».
 *
 * 🔒 **QR μόνο για μοντέλο που βλέπει ο ανώνυμος**: ρωτά τον **ίδιο** αναγνώστη με το `/q/<id>` (`readPublicModelTarget`), με
 *    την ίδια πύλη βιτρίνας και τα ίδια tags. Κρυφό, αποσυρμένο, ανακλημένο και ανύπαρκτο δεν τυπώνονται: δεύτερη κρίση
 *    ορατότητας εδώ θα μπορούσε να διαφωνήσει με τη σελίδα στην οποία οδηγεί ο κωδικός.
 * 🔑 Το χαρτί δείχνει **πάντα** τη σύντομη διεύθυνση (`/Q/…` ή `/q/<id>`), ποτέ τη διεύθυνση με slug: το 307 `no-store` κλείνει και το αντίτυπο όταν
 *    αποσυρθεί το προϊόν.
 * 🔒 **Απόφαση 4**: η τελική έκδοση με έστω ένα QR σε μη δημόσια βάση **αρνείται** με τον σταθερό κωδικό
 *    `qrOriginNotPublic` (`PUBLICATION_FAILURES`). Η άρνηση γράφεται στην εγγραφή της έκδοσης (ίχνος: ποιος, πότε, γιατί), και
 *    ο εκτελεστής τη ρίχνει πριν ξεκινήσει η μηχανή, άρα δεν βγαίνει ούτε σελίδα. Χωρίς δημόσιο μοντέλο δεν χρειάζεται βάση.
 * ⚠️ Γιατί όχι εύρημα `issues.*` (422): το `ISSUE_KEYS` φέρνει κάθε κωδικό σε κάθε σελίδα καταλόγου, και το slice της
 *    `catalog/imports` είχε 27 bytes περιθώριο (μετρημένο 2026-11-03). Η οικογένεια `publishing.failure.*` ζει μόνο στη
 *    σελίδα εκδόσεων, όπου ο άνθρωπος βλέπει την άρνηση.
 * ⚠️ Η κρίση γίνεται στην αίτηση και μπαίνει στο κλειδί ιδεμποτίας μέσω των διευθύνσεων. Η μνήμη του αναγνώστη ζει ως 5′,
 *    άρα μοντέλο που μόλις δημοσιεύτηκε μπορεί να βγει χωρίς QR ως τότε. Το αντίστροφο δεν βλάπτει: το `/q/` ξανακρίνει.
 *
 * @module server/catalog/publishing/publication-links.server
 */

import { publicOrigin } from '@/lib/http/public-origin';
import { readPublicModelTarget } from '@/services/public-catalog/public-catalog.reader';
import { printedLinkBase, printedModelUrl, type PublicationLinkPolicy } from '@/subapps/catalog/publishing/publication-qr';

export interface PublicationLinks {
  /** id μοντέλου → απόλυτη διεύθυνση QR. Μοντέλο που λείπει δεν τυπώνει QR. */
  readonly urls: ReadonlyMap<string, string>;
  /** Δημόσια μοντέλα που θα έπαιρναν QR, αν η βάση ήταν δημόσια. Μη κενό ⇒ η τελική έκδοση αρνείται. */
  readonly refusedModelIds: readonly string[];
}
export type PublicationLinkReader = (modelIds: readonly string[]) => Promise<PublicationLinks>;
/** `null` ⇒ ο ανώνυμος δεν το βλέπει. Η μορφή του `readPublicModelTarget`. */
export type PublicModelProbe = (modelId: string) => Promise<string | null>;

/** Ταυτόχρονες αναγνώσεις: ένας κατάλογος έχει εκατοντάδες μοντέλα, και καμία δεν πρέπει να περιμένει τις άλλες όλες. */
const PROBE_BATCH = 16;
const NO_LINKS: PublicationLinks = { urls: new Map(), refusedModelIds: [] };

async function publicModelIds(modelIds: readonly string[], probe: PublicModelProbe): Promise<string[]> {
  const shown: string[] = [];
  for (let from = 0; from < modelIds.length; from += PROBE_BATCH) {
    const slice = modelIds.slice(from, from + PROBE_BATCH);
    const targets = await Promise.all(slice.map(probe));
    slice.forEach((id, index) => { if (targets[index] !== null) shown.push(id); });
  }
  return shown;
}

/** Ο αναγνώστης συνδέσμων μιας πολιτικής. Βλάβη του αναγνώστη ρίχνει: έκδοση χωρίς QR λόγω βλάβης θα ήταν σιωπηλή απώλεια. */
export function publicationLinkReader(policy: PublicationLinkPolicy, deps: { readonly probe?: PublicModelProbe; readonly origin?: () => string | null } = {}): PublicationLinkReader {
  const probe = deps.probe ?? readPublicModelTarget;
  const originOf = deps.origin ?? publicOrigin;
  return async (modelIds) => {
    const shown = await publicModelIds(modelIds, probe);
    const base = shown.length === 0 ? null : printedLinkBase(policy, originOf());
    if (base?.kind === 'refused') return { urls: new Map(), refusedModelIds: shown };
    if (base?.kind !== 'origin') return NO_LINKS;
    return { urls: new Map(shown.map((id) => [id, printedModelUrl(base.origin, id)])), refusedModelIds: [] };
  };
}
