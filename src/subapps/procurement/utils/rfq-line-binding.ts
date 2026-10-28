/**
 * **Δέσιμο απάντησης ↔ γραμμής RFQ** (ADR-327 §8.5) — ΟΙ κανόνες, μία φορά, καθαροί (client + server).
 *
 * Μια προσφορά απαντά σε κάθε γραμμή RFQ με ΕΝΑΝ από τρεις τρόπους: γραμμή με τιμή (`lines[].rfqLineId`),
 * «περιλαμβάνεται» ή «εξαιρείται» (`scopeResponses`). Πάνω σε αυτό: εναλλακτικές δεμένες στη γραμμή που
 * αντικαθιστούν (`alternates`) και πρόσθετες γραμμές του προμηθευτή (`rfqLineId: null`).
 *
 * 🔴 Ο server **ποτέ** δεν εμπιστεύεται το `rfqLineId` του client: `checkRfqLineAnswers` τρέχει απέναντι στις
 * γραμμές που διάβασε ο ΕΝΑΣ αναγνώστης (`readRfqLinesPublic`) για το RFQ **της πρόσκλησης** — ξένο id = 400.
 *
 * @module subapps/procurement/utils/rfq-line-binding
 * @enterprise ADR-327 §8.5
 */

import { normalizeGreekText } from '@/utils/greek-text';
import type { QuoteLine, RfqScopeResponse } from '../types/quote';
import type { PublicRfqLine } from '../types/rfq-line';
import type { RfqResponseLock } from '../types/rfq';
import { DEFAULT_UOM } from '@/lib/uom/uom-registry';
import { quoteLineTotal } from './quote-line-total';
import { lockedFieldsOf, UNLOCKED_RESPONSE } from './rfq-response-lock';

/** Όλες οι απαντήσεις μιας προσφοράς σε ένα RFQ. */
export interface RfqLineAnswers {
  lines: readonly QuoteLine[];
  alternates: readonly QuoteLine[];
  scopeResponses: readonly RfqScopeResponse[];
}

/** Κλειστό σύνολο — ο κωδικός φτάνει αυτούσιος στον client (`binding:<code>`). */
export type RfqBindingErrorCode =
  | 'unknown_rfq_line'      // id που δεν ανήκει στο RFQ της πρόσκλησης
  | 'duplicate_answer'      // δύο απαντήσεις (τιμή / περιλαμβάνεται / εξαιρείται) στην ίδια γραμμή RFQ
  | 'unanswered_rfq_line'   // γραμμή RFQ χωρίς απάντηση, όπου απαιτείται πλήρης απάντηση (πύλη)
  | 'unbound_alternate';    // εναλλακτική χωρίς γραμμή που αντικαθιστά

export interface RfqBindingError {
  code: RfqBindingErrorCode;
  rfqLineId: string | null;
}

const RFQ_BINDING_ERROR_CODES: readonly RfqBindingErrorCode[] = [
  'unknown_rfq_line', 'duplicate_answer', 'unanswered_rfq_line', 'unbound_alternate',
];

/** Το κλειδί i18n (`quotes` namespace) για κάθε κωδικό — ο server στέλνει `binding:<code>`, ποτέ κείμενο. */
export type RfqBindingErrorKey = `quotes.binding.errors.${RfqBindingErrorCode}`;

/**
 * Σφάλμα αποθήκευσης → κλειδί i18n, όταν είναι απόρριψη δεσίματος (`binding:<code>`) — αλλιώς `null` (ο καλών δείχνει
 * το δικό του μήνυμα). Ένα σημείο για κάθε επιφάνεια του PM που γράφει `rfqLineId`: ο ωμός κωδικός δεν φτάνει στον άνθρωπο.
 */
export function rfqBindingErrorKey(error: unknown): RfqBindingErrorKey | null {
  const message = error instanceof Error ? error.message : '';
  const code = message.startsWith('binding:') ? message.slice('binding:'.length) : '';
  const known = RFQ_BINDING_ERROR_CODES.find((c) => c === code);
  return known ? `quotes.binding.errors.${known}` : null;
}

/** Οι γραμμές RFQ που η προσφορά απαντά **με τιμή ή χωρίς** — μία φορά η καθεμία. */
function answeredIds(answers: RfqLineAnswers): { ids: string[]; duplicate: string | null } {
  const ids = [
    ...answers.lines.flatMap((l) => (l.rfqLineId ? [l.rfqLineId] : [])),
    ...answers.scopeResponses.map((r) => r.rfqLineId),
  ];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return { ids, duplicate: id };
    seen.add(id);
  }
  return { ids, duplicate: null };
}

/**
 * **Επικύρωση** των απαντήσεων απέναντι στις γραμμές του RFQ. `requireEveryLine` = η πύλη: κάθε γραμμή RFQ
 * παίρνει ρητή απάντηση — ένα κενό είναι **δήλωση** («εξαιρείται»), ποτέ σιωπή (πρότυπο Procore Include/Exclude,
 * αυστηρότερο: εκεί η σιωπή επιτρέπεται και το κενό το βρίσκει ο PM μόνος του στο leveling).
 */
export function checkRfqLineAnswers(
  rfqLines: readonly Pick<PublicRfqLine, 'id'>[],
  answers: RfqLineAnswers,
  options: { requireEveryLine: boolean },
): RfqBindingError | null {
  const known = new Set(rfqLines.map((l) => l.id));
  const { ids, duplicate } = answeredIds(answers);
  const foreign = [...ids, ...answers.alternates.flatMap((a) => (a.rfqLineId ? [a.rfqLineId] : []))]
    .find((id) => !known.has(id));
  if (foreign) return { code: 'unknown_rfq_line', rfqLineId: foreign };
  if (duplicate) return { code: 'duplicate_answer', rfqLineId: duplicate };
  if (answers.alternates.some((a) => !a.rfqLineId)) return { code: 'unbound_alternate', rfqLineId: null };
  if (options.requireEveryLine) {
    const answered = new Set(ids);
    const missing = rfqLines.find((l) => !answered.has(l.id));
    if (missing) return { code: 'unanswered_rfq_line', rfqLineId: missing.id };
  }
  return null;
}

/** §8.5 Β — οι κλειδωμένες τιμές της γραμμής RFQ γράφονται πάνω από ό,τι έστειλε ο client· η αξία ξαναϋπολογίζεται. */
function withLockedFields(line: QuoteLine, rfqLine: PublicRfqLine, lock: RfqResponseLock): QuoteLine {
  const locked = lockedFieldsOf(lock, rfqLine);
  const quantity = locked.quantity ?? line.quantity;
  return {
    ...line,
    quantity,
    unit: locked.unit ?? line.unit,
    lineTotal: quantity === line.quantity ? line.lineTotal : quoteLineTotal(quantity, line.unitPrice),
  };
}

/**
 * **Η γραμμή RFQ είναι η αυθεντία του ΤΙ ζητήθηκε**: η απάντηση σε γραμμή RFQ (με τιμή ή χωρίς) παίρνει περιγραφή και κωδικό
 * (ΑΤΟΕ, το κλειδί σύνδεσης με BOQ/PO) από τη γραμμή — ο προμηθευτής δεν «μετονομάζει» το ζητούμενο,
 * γράφει σημείωση. Η εναλλακτική κρατά τη ΔΙΚΗ της περιγραφή (είναι άλλο προϊόν) αλλά τον κωδικό της γραμμής.
 * §8.5 Β: με `lock`, η **βασική** απάντηση παίρνει και την ποσότητα/μονάδα της γραμμής — ΕΔΩ και μόνο εδώ (η πύλη
 * απλώς τα δείχνει μόνο-ανάγνωσης· ένας πειραγμένος client δεν αλλάζει τίποτα). Οι εναλλακτικές μένουν ελεύθερες.
 */
export function applyRfqLineAuthority(
  rfqLines: readonly PublicRfqLine[],
  answers: RfqLineAnswers,
  lock: RfqResponseLock = UNLOCKED_RESPONSE,
): RfqLineAnswers {
  const byId = new Map(rfqLines.map((l) => [l.id, l] as const));
  const base = (line: QuoteLine): QuoteLine => {
    const rfqLine = line.rfqLineId ? byId.get(line.rfqLineId) : undefined;
    if (!rfqLine) return line;
    const authored = { ...line, description: rfqLine.description, categoryCode: rfqLine.categoryCode };
    return withLockedFields(authored, rfqLine, lock);
  };
  const alternate = (line: QuoteLine): QuoteLine => {
    const rfqLine = line.rfqLineId ? byId.get(line.rfqLineId) : undefined;
    return rfqLine ? { ...line, categoryCode: rfqLine.categoryCode } : line;
  };
  const scope = (response: RfqScopeResponse): RfqScopeResponse => {
    const rfqLine = byId.get(response.rfqLineId);
    return rfqLine ? { ...response, description: rfqLine.description } : response;
  };
  return {
    lines: answers.lines.map(base),
    alternates: answers.alternates.map(alternate),
    scopeResponses: answers.scopeResponses.map(scope),
  };
}

// ============================================================================
// INFERENCE — pre-§8.5 quotes, scans, manual entry (no explicit rfqLineId)
// ============================================================================

function descriptionKey(text: string): string {
  return normalizeGreekText(text).replace(/\s+/g, ' ').trim();
}

/** Η ΜΟΝΑΔΙΚΗ γραμμή RFQ που ικανοποιεί το κριτήριο — αλλιώς καμία (διφορούμενο ≠ ταίριασμα). */
function uniqueMatch(rfqLines: readonly PublicRfqLine[], test: (l: PublicRfqLine) => boolean): string | null {
  const hits = rfqLines.filter(test);
  return hits.length === 1 ? hits[0].id : null;
}

/**
 * Πρόταση δεσίματος για γραμμή **χωρίς** `rfqLineId`: πρώτα ίδιος κωδικός ΑΤΟΕ, μετά ίδια περιγραφή (χωρίς
 * τόνους/κεφαλαία/διπλά κενά) — μόνο όταν το ταίριασμα είναι **μοναδικό**. `null` = πρόσθετη γραμμή.
 * Ο καλών ΣΗΜΑΔΕΥΕΙ ότι το δέσιμο είναι συμπέρασμα· ποτέ δεν το γράφει πίσω σιωπηλά.
 */
export function inferRfqLineId(line: Pick<QuoteLine, 'description' | 'categoryCode'>, rfqLines: readonly PublicRfqLine[]): string | null {
  if (line.categoryCode) {
    const byCode = uniqueMatch(rfqLines, (l) => l.categoryCode === line.categoryCode);
    if (byCode) return byCode;
  }
  const key = descriptionKey(line.description);
  return key ? uniqueMatch(rfqLines, (l) => descriptionKey(l.description) === key) : null;
}

// ============================================================================
// REVIEW — πρόταση δεσίματος στον έλεγχο σαρωμένης/χειροκίνητης προσφοράς
// ============================================================================

/** `explicit` = γραμμένο στη γραμμή · `suggested` = συμπέρασμα (`inferRfqLineId`) που ο PM δεν έχει αποδεχτεί · `none` = πρόσθετη. */
export type RfqBindingOrigin = 'explicit' | 'suggested' | 'none';

export interface RfqBindingProposal {
  lineId: string;
  rfqLineId: string | null;
  origin: RfqBindingOrigin;
}

/**
 * Μία πρόταση ανά γραμμή προσφοράς. Τα ρητά δεσίματα κρατιούνται και **δεσμεύουν** τη γραμμή RFQ τους· το συμπέρασμα
 * προτείνει μόνο ελεύθερη γραμμή RFQ, μία φορά (ίδιος κανόνας με το `duplicate_answer`). Ποτέ δεν γράφει — ο καλών
 * γράφει **όλες** τις γραμμές μαζί όταν ο PM αποδεχτεί: μόλις μία γραμμή έχει `rfqLineId`, ο κινητήρας leveling
 * θεωρεί την προσφορά ρητά δεμένη και τις υπόλοιπες πρόσθετες.
 */
export function proposeRfqLineBindings(
  lines: readonly Pick<QuoteLine, 'id' | 'description' | 'categoryCode' | 'rfqLineId'>[],
  rfqLines: readonly PublicRfqLine[],
): RfqBindingProposal[] {
  const known = new Set(rfqLines.map((l) => l.id));
  const taken = new Set(lines.flatMap((l) => (l.rfqLineId && known.has(l.rfqLineId) ? [l.rfqLineId] : [])));
  return lines.map((line) => {
    if (line.rfqLineId && known.has(line.rfqLineId)) return { lineId: line.id, rfqLineId: line.rfqLineId, origin: 'explicit' };
    if (line.rfqLineId === null) return { lineId: line.id, rfqLineId: null, origin: 'explicit' };
    const inferred = inferRfqLineId(line, rfqLines);
    if (!inferred || taken.has(inferred)) return { lineId: line.id, rfqLineId: null, origin: 'none' };
    taken.add(inferred);
    return { lineId: line.id, rfqLineId: inferred, origin: 'suggested' };
  });
}

// ============================================================================
// DRAFT — χειροκίνητη προσφορά μέσα σε RFQ: η φόρμα ξεκινά από το αίτημα
// ============================================================================

/** Τα πεδία που η γραμμή RFQ δίνει στη γραμμή προσφοράς· τιμή/ΦΠΑ/id τα βάζει ο καλών. */
export type RfqDraftLine = Pick<QuoteLine, 'rfqLineId' | 'description' | 'categoryCode' | 'quantity' | 'unit'>;

/**
 * §8.5.4 — **η φόρμα από το αίτημα** (Procore bid form · Ariba line items): μία γραμμή, **ρητά** δεμένη, για κάθε γραμμή
 * RFQ που η προσφορά δεν απαντά ακόμη. Ιδεμπότητο: δεύτερη κλήση με το αποτέλεσμα της πρώτης ⇒ `[]`. Το δέσιμο είναι
 * **δεδομένο**, όχι συμπέρασμα — κανένας κωδικός ΑΤΟΕ που μάντεψε η φόρμα δεν γίνεται «τεκμήριο» για το `inferRfqLineId`.
 */
export function draftLinesForUnansweredRfqLines(
  rfqLines: readonly PublicRfqLine[],
  lines: readonly Pick<QuoteLine, 'rfqLineId'>[],
): RfqDraftLine[] {
  const answered = new Set(lines.flatMap((l) => (l.rfqLineId ? [l.rfqLineId] : [])));
  return rfqLines
    .filter((r) => !answered.has(r.id))
    .map((r) => ({
      rfqLineId: r.id,
      description: r.description,
      categoryCode: r.categoryCode,
      quantity: r.quantity ?? 1, // γραμμή χωρίς επιμέτρηση = 1 κατ' αποκοπή (η νέα προσφορά απαιτεί ποσότητα > 0)
      unit: r.unit ?? DEFAULT_UOM,
    }));
}
