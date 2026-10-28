import 'server-only';

/**
 * **Φρουρός δεσίματος στις εγγραφές του PM** (ADR-327 §8.5.4) — `createQuote` / `updateQuote`.
 *
 * Η πύλη προμηθευτή επικύρωνε ήδη κάθε `rfqLineId` απέναντι στις γραμμές του RFQ (`bindSubmission`)· οι δρόμοι του PM
 * (χειροκίνητη προσφορά, έλεγχος σάρωσης) τα έγραφαν **αυτούσια**. Ξένο ή διπλό δέσιμο έσπαγε σιωπηλά το leveling
 * (δύο τιμές στο ίδιο κελί, ή τιμή σε γραμμή άλλου RFQ). Τώρα: ΟΙ ΙΔΙΟΙ κανόνες (`checkRfqLineAnswers`), ο ΙΔΙΟΣ
 * αναγνώστης (`readRfqLinesPublic`) — χωρίς `requireEveryLine`: ο PM καταγράφει ό,τι έστειλε ο προμηθευτής, και η
 * αναπάντητη γραμμή είναι **εύρημα** της Σύγκρισης (κενό → κάλυψη), όχι σφάλμα καταχώρισης.
 *
 * Δεν εφαρμόζει `applyRfqLineAuthority`: η περιγραφή της σαρωμένης γραμμής είναι **τεκμήριο** του εγγράφου του
 * προμηθευτή και το κλείδωμα ποσότητας/μονάδας είναι περιορισμός της **πύλης** — ο PM μεταγράφει, δεν απαντά.
 *
 * @module subapps/procurement/services/quote-rfq-binding-guard
 * @enterprise ADR-327 §8.5.4
 */

import { getRfq } from './rfq-service';
import { readRfqLinesPublic } from './rfq-line-service';
import { checkRfqLineAnswers, type RfqLineAnswers } from '../utils/rfq-line-binding';

/** Κάποια απάντηση δηλώνει γραμμή RFQ; Αλλιώς τίποτα να επικυρωθεί — καμία ανάγνωση. */
function claimsRfqLine(answers: RfqLineAnswers): boolean {
  return [...answers.lines, ...answers.alternates].some((l) => Boolean(l.rfqLineId)) || answers.scopeResponses.length > 0;
}

/**
 * Πετά `binding:<code>` (κλειστό σύνολο, `RfqBindingErrorCode`) όταν οι απαντήσεις δεν στέκουν απέναντι στις γραμμές
 * του RFQ της προσφοράς. Προσφορά χωρίς RFQ που δηλώνει γραμμή RFQ = `unknown_rfq_line` (fail-closed).
 */
export async function assertPmRfqBinding(companyId: string, rfqId: string | null, answers: RfqLineAnswers): Promise<void> {
  if (!claimsRfqLine(answers)) return;
  const rfq = rfqId ? await getRfq(companyId, rfqId) : null;
  const rfqLines = rfq ? await readRfqLinesPublic(rfq) : [];
  const error = checkRfqLineAnswers(rfqLines, answers, { requireEveryLine: false });
  if (error) throw new Error(`binding:${error.code}`);
}
