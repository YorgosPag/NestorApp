import 'server-only';

/**
 * @fileoverview Λίστες Everypay — **όλες** οι σελίδες, ποτέ μόνο η πρώτη (ADR-ACC-030 §5.9 #8)
 * @description Οι λίστες του παρόχου (`GET /payments` · `GET /refunds`) σελιδοποιούνται με `count` (1–20,
 *   **προεπιλογή 10**) και `offset` (πόσες εγγραφές παραλείπονται), και επιστρέφουν `{ total_count, items }`
 *   (docs.everypay.gr «List all payments» / «List all refunds»). Χωρίς σελιδοποίηση, μια πληρωμή με 11 επιστροφές
 *   θα κατέγραφε σιωπηλά τις 10.
 *
 *   - Σελίδα 20 εγγραφών (το μέγιστο) ⇒ λιγότερες κλήσεις.
 *   - Τέλος: όταν διαβαστούν `total_count` εγγραφές **ή** έρθει κενή σελίδα (η λίστα μίκρυνε στο μεταξύ).
 *   - Αποδιπλασιασμός κατά `token`: νέα εγγραφή στην αρχή της λίστας κατά τη διάρκεια της ανάγνωσης μετατοπίζει
 *     τις σελίδες και θα έφερνε την ίδια εγγραφή δύο φορές.
 *   - Όριο ασφαλείας `MAX_PAGES`: πέρα από αυτό **σφάλμα** (502, ο καλών ξαναδοκιμάζει / το βλέπει άνθρωπος) — ποτέ
 *     σιωπηλή αποκοπή, που θα έμοιαζε με «καμία άλλη κίνηση».
 *
 * @see https://docs.everypay.gr/api-reference/
 */

import { EverypayApiError, everypayRequest } from './everypay-client';
import type { EverypayCredentials } from './everypay-config';
import { listPageOrNull, textField } from './everypay-readers';

/** Το μέγιστο `count` που δέχεται ο πάροχος. */
export const EVERYPAY_LIST_PAGE_SIZE = 20;
/** 50 × 20 = 1.000 εγγραφές ανά ερώτημα: πολύ πάνω από κάθε πραγματικό ερώτημα μας (ανά πληρωμή / ανά συνεδρία / 2 μέρες). */
export const EVERYPAY_LIST_MAX_PAGES = 50;

export type EverypayListPath = '/payments' | '/refunds';

/** Όλες οι εγγραφές του ερωτήματος. Μορφή εκτός συμβολαίου ή υπέρβαση ορίου ⇒ 502, ποτέ σιωπηλό «τίποτα». */
export async function everypayListAll(
  credentials: EverypayCredentials, path: EverypayListPath, query: Readonly<Record<string, string>>,
): Promise<Record<string, unknown>[]> {
  const byToken = new Map<string, Record<string, unknown>>();
  const untokened: Record<string, unknown>[] = [];
  let offset = 0;
  for (let page = 0; page < EVERYPAY_LIST_MAX_PAGES; page += 1) {
    const body = await everypayRequest(credentials, {
      method: 'GET', path, query: { ...query, count: String(EVERYPAY_LIST_PAGE_SIZE), offset: String(offset) },
    });
    const listPage = listPageOrNull(body);
    if (listPage === null) throw new EverypayApiError(502, null, `List response without items/total_count: ${path}`);
    for (const item of listPage.items) {
      const token = textField(item, 'token');
      if (token === null) untokened.push(item);
      else byToken.set(token, item);
    }
    offset += listPage.items.length;
    if (listPage.items.length === 0 || offset >= listPage.totalCount) return [...byToken.values(), ...untokened];
  }
  throw new EverypayApiError(502, null, `List exceeds ${EVERYPAY_LIST_MAX_PAGES * EVERYPAY_LIST_PAGE_SIZE} records: ${path}`);
}
