/**
 * @fileoverview **ΓΕΓΟΝΟΤΑ → ΚΟΥΜΠΙΑ, ΤΗ ΣΤΙΓΜΗ ΤΗΣ ΑΠΟΣΤΟΛΗΣ** — ο επιλυτής ενεργειών του email ειδοποίησης
 *   (ADR-841 §7 Α21.21 Φάση Β · ADR-848).
 * @related server/notifications/notification-email-envelope.ts (`liveEmailLinks`) · types/notification-email-facts.ts ·
 *   services/mandate/holiday-hours-question-token.ts · components/mandate/showcase-card-paths.ts
 * @module server/notifications/notification-email-actions
 *
 * 🔑 **Υπογράφεται ΕΔΩ, όχι στον παραγωγό**: ένα email που περίμενε το παράθυρο παράδοσης χτίζει τον σύνδεσμο από το
 * origin και το μυστικό **αυτής** της στιγμής. Ένας σύνδεσμος **ανά παραλήπτη** — το ίχνος λέει ποιος πάτησε.
 *
 * ⚠️ **Κάθε απουσία υποβαθμίζει μόνο ό,τι της ανήκει**: χωρίς μυστικό ή origin ⇒ **κανένα** κουμπί ενέργειας, και το email
 * πέφτει στο ένα «Άνοιγμα» προς την κάρτα (ο διαχειριστής απαντά από τη φόρμα). Ποτέ κουμπί που οδηγεί σε «άκυρο».
 */

import 'server-only';

import { holidayQuestionPagePath } from '@/components/mandate/showcase-card-paths';
import type { HumanLanguage } from '@/i18n/languages';
import { HOLIDAY_ANSWER_KINDS } from '@/lib/calendar/holiday-question';
import { publicUrl } from '@/lib/http/public-origin';
import { encodeHolidayQuestionLink, holidayQuestionSecret } from '@/services/mandate/holiday-hours-question-token';
import { holidayQuestionWording } from '@/services/mandate/holiday-question-email-texts';

import type { EmailActionButton, RenderableMessage } from './notification-email-render';

/** **Τα κουμπιά ενός μηνύματος** — κενό όταν δεν έχει γεγονότα ή όταν δεν μπορούν να χτιστούν έγκυροι σύνδεσμοι. */
export function liveEmailActions(message: RenderableMessage, language: HumanLanguage): readonly EmailActionButton[] {
  const { facts, recipientId } = message;
  if (facts === undefined || !recipientId) return [];
  const secret = holidayQuestionSecret();
  if (secret === null) return [];
  const token = encodeHolidayQuestionLink(secret, { id: facts.questionId, nonce: facts.nonce, recipientUid: recipientId });
  const wording = holidayQuestionWording(language);
  const choices = [
    ...HOLIDAY_ANSWER_KINDS.map((kind) => ({ label: wording.answerAll[kind], path: holidayQuestionPagePath(token, kind) })),
    { label: wording.otherHours, path: holidayQuestionPagePath(token, null) },
  ];
  const buttons = choices.flatMap(({ label, path }) => {
    const url = publicUrl(path);
    return url === null ? [] : [{ url, label }];
  });
  return buttons.length === choices.length ? buttons : [];
}
