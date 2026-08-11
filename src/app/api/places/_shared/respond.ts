/**
 * @fileoverview **ΑΠΟΤΕΛΕΣΜΑ ΕΝΤΟΠΙΣΜΟΥ → ΑΠΑΝΤΗΣΗ HTTP** — μία μετάφραση, δύο διαδρομές.
 * @related ADR-777 · services/places/public-place-write.service.ts
 * @module app/api/places/_shared/respond
 *
 * 🔴 **Εξήχθη από την αρχή, επειδή το ίδιο έγινε ήδη μία φορά**: στην Α14 το CHECK
 * 3.28 ζήτησε ακριβώς αυτή την εξαγωγή για το `owner-properties`, και εδώ οι δύο
 * διαδρομές (**εντοπισμός** · **πρόταση**) κάνουν την **ίδια** μετάφραση από τις έξι
 * καταστάσεις της πύλης.
 *
 * ⚠️ **Κάθε κατάσταση απαντάται ρητά, χωρίς `default`** — έβδομη κατάσταση στην πύλη
 * **δεν μεταγλωττίζεται** μέχρι κάποιος να αποφασίσει τι σημαίνει για το δίκτυο.
 */

import { NextResponse } from 'next/server';

import type { PlaceResolution } from '@/services/places/public-place-write.service';
import type { PlaceRef } from '@/types/geo/public-place';

/** Ό,τι φεύγει προς τον πελάτη σε **επιτυχία**. */
export interface PlaceResolvedResponse {
  readonly place: PlaceRef;
  /** `false` = επαναχρησιμοποιήθηκε υπάρχουσα ταυτότητα. Η οθόνη το λέει στον άνθρωπο. */
  readonly created: boolean;
  readonly merged: readonly string[];
}

/**
 * **Δεν είναι σφάλμα — είναι ΕΡΩΤΗΣΗ.**
 *
 * Γι' αυτό ταξιδεύει με **200** και όχι με 409: ο διακομιστής δεν απέτυχε και ο
 * πελάτης δεν έκανε λάθος. Το §13.3 απαγορεύει στην εγγύτητα να **αποφασίσει**, οπότε
 * η μόνη σωστή κίνηση είναι να γυρίσει το ερώτημα στον άνθρωπο — και ένας κωδικός
 * σφάλματος θα τον έστελνε να «διορθώσει» κάτι σωστό.
 */
export interface PlaceDuplicateResponse {
  readonly duplicateOf: PlaceRef;
  readonly displayAddress: string | null;
}

export interface PlaceErrorResponse {
  /** Κωδικός — γίνεται **κλειδί i18n** στην οθόνη (N.11), ποτέ ωμό κείμενο εδώ. */
  readonly error: string;
  readonly detail?: string;
}

export type PlaceApiResponse =
  | PlaceResolvedResponse
  | PlaceDuplicateResponse
  | PlaceErrorResponse;

/**
 * **Κατάσταση πύλης → HTTP.**
 *
 * | Κατάσταση | Κωδικός | Γιατί |
 * |---|---|---|
 * | `resolved` | **200** | έγινε |
 * | `duplicate-candidate` | **200** | **ερώτηση**, όχι σφάλμα — δες παραπάνω |
 * | `malformed` | **422** | το αίτημα ήταν **κατανοητό** και η χειρονομία άκυρη· 400 θα σήμαινε «δεν σε κατάλαβα» |
 * | `rejected` | **422** | ο **κόσμος** δεν συμφωνεί (το κτίριο δεν υπάρχει) — ο άνθρωπος διαλέγει άλλο |
 * | `unavailable` | **503** | *«δεν μάθαμε»* — και το `Retry-After` το λέει: **ξαναδοκίμασε**, μην αλλάξεις τίποτα |
 * | `failed` | **500** | δεν φτάσαμε στη βάση |
 */
export function respondToResolution(
  result: PlaceResolution,
): NextResponse<PlaceApiResponse> {
  switch (result.kind) {
    case 'resolved':
      return NextResponse.json({
        place: result.ref,
        created: result.created,
        merged: result.merged,
      });

    case 'duplicate-candidate':
      return NextResponse.json({
        duplicateOf: result.existing,
        displayAddress: result.displayAddress,
      });

    case 'malformed':
      return NextResponse.json(
        { error: 'PLACE_CLAIM_MALFORMED', detail: result.defect },
        { status: 422 },
      );

    case 'rejected':
      return NextResponse.json(
        { error: 'PLACE_SOURCE_REJECTED', detail: result.reason },
        { status: 422 },
      );

    case 'unavailable':
      // ⚠️ **503 και ΟΧΙ 404/409**: το «δεν μάθαμε» δεν επιτρέπεται να διαβαστεί ως
      // «δεν υπάρχει» — ούτε από άνθρωπο, ούτε από κώδικα που θα γραφτεί αργότερα.
      return NextResponse.json(
        { error: 'PLACE_LOOKUP_UNAVAILABLE', detail: result.reason },
        { status: 503, headers: { 'Retry-After': '5' } },
      );

    case 'failed':
      return NextResponse.json({ error: 'PLACE_WRITE_FAILED' }, { status: 500 });
  }
}

/** Το σώμα δεν διαβάστηκε ως σχήμα — **400**, γιατί εδώ όντως «δεν σε κατάλαβα». */
export function respondToMalformedBody(
  malformed: readonly string[],
): NextResponse<PlaceApiResponse> {
  return NextResponse.json(
    { error: 'MALFORMED_BODY', detail: malformed.join(',') },
    { status: 400 },
  );
}
