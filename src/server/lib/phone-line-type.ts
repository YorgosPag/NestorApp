/**
 * 🏢 SSoT — **τι τύπο παίρνει ένας αριθμός** όταν κανείς άνθρωπος (ή AI) δεν τον δήλωσε.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-29, ADR-327 §8.5.4)**: η σάρωση προσφοράς MACON ATEE γέννησε επαφή με το σταθερό
 * `+30 2310 428900` ως `type: 'mobile'`. Η απόφαση ζούσε σε **τρία** σημεία του server, όλα λάθος με διαφορετικό
 * τρόπο: `'mobile'` καρφωτό (`buildContactDocument`, `updateContactField`) και αφελές `startsWith('2')`
 * (`resolvePhoneType` — πιάνει μόνο ελληνικό εθνικό αριθμό, όχι `+30 2…`, ούτε κανέναν ξένο).
 *
 * 🔴 **ΔΙΟΡΘΩΣΗ ΤΗΣ ΙΔΙΑΣ ΜΕΡΑΣ (ζωντανός έλεγχος)**: η πρώτη εκδοχή έδινε σε σταθερό εταιρείας `work` — τιμή που η
 * φόρμα εταιρείας **δεν προσφέρει** ⇒ κενή λίστα «Τύπος». Η απάντηση πρέπει να ανήκει **πάντα** στο υποσύνολο του
 * κατόχου· το λεξιλόγιο ζει στο `lib/contact/phone-type-vocabulary.ts`, όχι εδώ.
 *
 * 🔑 **Βιβλιοθήκη, όχι πρόθεμα** — ίδιος λόγος με το `lib/contact/channel-phone.ts`: τα metadata της Google
 * `libphonenumber` (MIT, ίδια πηγή με Android/Gmail) ξέρουν τι είναι κινητό σε κάθε χώρα. Ένα χειρόγραφο πρόθεμα
 * θα ήταν δεύτερος, χειρότερος ορισμός.
 *
 * ⚠️ **`/max` και ΜΟΝΟ ΣΤΟΝ SERVER** (`server-only`): τα `/min` metadata του `channel-phone` **δεν** δίνουν τύπο για
 * την Ελλάδα (μετρημένο: `getType()` ⇒ `undefined`)· τα `/max` (~145 KB) δεν πρέπει να φτάσουν σε bundle πελάτη.
 *
 * Δηλωμένη ετικέτα από άνθρωπο/AI κερδίζει πάντα· αυτό εδώ ρωτιέται **μόνο** χωρίς ετικέτα.
 *
 * @module server/lib/phone-line-type
 */

import 'server-only';

import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

import { DEFAULT_PHONE_COUNTRY } from '@/lib/contact/channel-phone';
import { DEFAULT_PHONE_TYPE, type PhoneOwnerKind, type PhoneType } from '@/lib/contact/phone-type-vocabulary';

/** Αριθμοί που υπάρχουν μόνο για επιχειρήσεις (800, 801, 0900, VoIP, UAN) — «εργασία» για πρόσωπο. */
const BUSINESS_NUMBER_TYPES: ReadonlySet<string> = new Set(['TOLL_FREE', 'SHARED_COST', 'PREMIUM_RATE', 'VOIP', 'UAN']);

/**
 * Ο τύπος ενός αριθμού χωρίς δηλωμένη ετικέτα — **πάντα μέσα στο υποσύνολο του κατόχου** (`PHONE_TYPES_BY_OWNER`).
 *
 * - **Εταιρεία / υπηρεσία** ⇒ η προεπιλογή τους (`main`): εκεί ο άξονας του λεξιλογίου είναι ο **ρόλος** της γραμμής
 *   (κεντρικό, τμήμα, πωλήσεις…), όχι κινητό/σταθερό — όπως το vCard `main-number` (RFC 7852) και το `main` του
 *   Google People API.
 * - **Πρόσωπο** ⇒ τα metadata του αριθμού: κινητό ⇒ `mobile`, σταθερό ⇒ `home`, επιχειρηματικός ⇒ `work`·
 *   ό,τι η βιβλιοθήκη δεν ξεχωρίζει (`FIXED_LINE_OR_MOBILE` στις ΗΠΑ, άκυρος) ⇒ η προεπιλογή — ποτέ μαντεψιά.
 */
export function inferPhoneType(raw: string, owner: PhoneOwnerKind): PhoneType {
  if (owner !== 'individual') return DEFAULT_PHONE_TYPE[owner];
  const lineType = parsePhoneNumberFromString(raw.trim(), DEFAULT_PHONE_COUNTRY)?.getType();
  if (lineType === 'MOBILE') return 'mobile';
  if (lineType === 'FIXED_LINE') return 'home';
  if (lineType !== undefined && BUSINESS_NUMBER_TYPES.has(lineType)) return 'work';
  return DEFAULT_PHONE_TYPE.individual;
}
