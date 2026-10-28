/**
 * 🏢 SSoT — **τι είδους γραμμή είναι ένας αριθμός** (κινητό / σταθερό), όταν κανείς άνθρωπος δεν το δήλωσε.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-29, ADR-327 §8.5.4)**: η σάρωση προσφοράς MACON ATEE γέννησε επαφή με το σταθερό
 * `+30 2310 428900` ως `type: 'mobile'`. Η απόφαση ζούσε σε **τρία** σημεία του server, όλα λάθος με διαφορετικό
 * τρόπο: `'mobile'` καρφωτό (`buildContactDocument`, `updateContactField`) και αφελές `startsWith('2')`
 * (`resolvePhoneType` — πιάνει μόνο ελληνικό εθνικό αριθμό, όχι `+30 2…`, ούτε κανέναν ξένο).
 *
 * 🔑 **Βιβλιοθήκη, όχι πρόθεμα** — ίδιος λόγος με το `lib/contact/channel-phone.ts`: τα metadata της Google
 * `libphonenumber` (MIT, ίδια πηγή με Android/Gmail) ξέρουν τι είναι κινητό σε κάθε χώρα. Ένα χειρόγραφο πρόθεμα
 * θα ήταν δεύτερος, χειρότερος ορισμός.
 *
 * ⚠️ **`/max` και ΜΟΝΟ ΣΤΟΝ SERVER** (`server-only`): τα `/min` metadata του `channel-phone` **δεν** δίνουν τύπο για
 * την Ελλάδα (μετρημένο: `getType()` ⇒ `undefined`)· τα `/max` (~145 KB) δεν πρέπει να φτάσουν σε bundle πελάτη.
 *
 * 🔑 Ό,τι η βιβλιοθήκη **δεν** ξεχωρίζει (`FIXED_LINE_OR_MOBILE` στις ΗΠΑ, άκυρος αριθμός) ⇒ η προεπιλογή του
 * καλούντος — ποτέ μαντεψιά. Δηλωμένη ετικέτα από άνθρωπο/AI κερδίζει πάντα· αυτό εδώ ρωτιέται **μόνο** χωρίς ετικέτα.
 *
 * @module server/lib/phone-line-type
 */

import 'server-only';

import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

import { DEFAULT_PHONE_COUNTRY } from '@/lib/contact/channel-phone';

/** Οι τύποι τηλεφώνου που ξέρει το UI των Επαφών (`CommunicationConfigs`) και που μπορούν να συναχθούν. */
export type InferredPhoneType = 'mobile' | 'home' | 'work';

/** Τίνος είναι ο αριθμός: το σταθερό προσώπου είναι «σπίτι», εταιρείας/υπηρεσίας «εργασία». */
export type PhoneOwnerKind = 'individual' | 'company' | 'service';

/** Ο κάτοχος από το πεδίο `type` ενός εγγράφου επαφής — άγνωστο/λείπει ⇒ πρόσωπο (η ιστορική προεπιλογή). */
export function phoneOwnerKindOf(contactType: unknown): PhoneOwnerKind {
  return contactType === 'company' || contactType === 'service' ? contactType : 'individual';
}

/** Αριθμοί που υπάρχουν μόνο για επιχειρήσεις (800, 801, 0900, VoIP, UAN) — «εργασία» για κάθε κάτοχο. */
const BUSINESS_NUMBER_TYPES: ReadonlySet<string> = new Set(['TOLL_FREE', 'SHARED_COST', 'PREMIUM_RATE', 'VOIP', 'UAN']);

/**
 * Ο τύπος γραμμής ενός αριθμού χωρίς δηλωμένη ετικέτα.
 *
 * @param fallback ό,τι έγραφε ο καλών πριν — επιστρέφεται όταν η βιβλιοθήκη δεν μπορεί να απαντήσει.
 */
export function inferPhoneType(raw: string, owner: PhoneOwnerKind, fallback: InferredPhoneType): InferredPhoneType {
  const lineType = parsePhoneNumberFromString(raw.trim(), DEFAULT_PHONE_COUNTRY)?.getType();
  if (lineType === 'MOBILE') return 'mobile';
  if (lineType === 'FIXED_LINE') return owner === 'individual' ? 'home' : 'work';
  if (lineType !== undefined && BUSINESS_NUMBER_TYPES.has(lineType)) return 'work';
  return fallback;
}
