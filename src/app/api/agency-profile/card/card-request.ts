/**
 * @fileoverview **ΤΙ ΡΩΤΑ Η ΠΟΡΤΑ ΤΗΣ ΚΑΡΤΑΣ ΠΡΙΝ ΓΡΑΨΕΙ** — σχήμα σύρματος + επαλήθευση τόπων
 *   (ADR-841 §7 Α21.16).
 * @related app/api/agency-profile/card/route.ts · app/api/agency-profile/showcase-request.ts (`locatePlace`)
 * @module app/api/agency-profile/card/card-request
 *
 * 🔑 **Ίδιο δόγμα με το `showcase-request`**: τα `max` εδώ είναι **φρουροί πόρου** (32 καταστήματα,
 * 8 κανάλια) — τα **πραγματικά** ταβάνια (10 · 3) τα επιβάλλει **ονομαστικά** ο κριτής
 * (`showcase-card-form`), ώστε ο άνθρωπος να μάθει *«έως 3 τηλέφωνα»* αντί για `MALFORMED_BODY`.
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { getAdminFirestore } from '@/lib/firebaseAdmin';
import { placeRefSchema } from '@/lib/geo/place-ref-schema';
import type { VerifiedLocationDeclaration } from '@/lib/agency/showcase-card-form';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { OwnedShowcaseLocation, ShowcaseCardWire } from '@/types/showcase-card';
import { locatePlace, PLACE_ERROR_STATUS, type PlaceError } from '../showcase-request';

const intervalSchema = z.object({ opens: z.string().max(5), closes: z.string().max(5) });
const daySchema = z.array(intervalSchema).max(8);

/** Επτά ημέρες, **όλες** παρούσες — ίδιο «ή όλο ή τίποτα» με τον αναγνώστη. */
const hoursSchema = z.object({
  1: daySchema, 2: daySchema, 3: daySchema, 4: daySchema, 5: daySchema, 6: daySchema, 7: daySchema,
});

/** 🔑 `z.ZodType<ShowcaseCardWire>` — νέο πεδίο στο σύρμα **δεν μεταγλωττίζεται** εδώ σιωπηλά. */
export const cardSchema: z.ZodType<ShowcaseCardWire> = z.object({
  locations: z
    .array(
      z.object({
        id: z.string().max(128).nullable(),
        role: z.enum(['headquarters', 'branch']),
        label: z.string().max(80).nullable(),
        place: placeRefSchema,
        street: z
          .object({ street: z.string().max(120), number: z.string().max(16), postalCode: z.string().max(16) })
          .nullable(),
        hours: hoursSchema.nullable(),
        phones: z
          .array(z.object({ number: z.string().max(40), extension: z.string().max(10).nullable() }))
          .max(8),
        emails: z.array(z.string().max(254)).max(8),
      }),
    )
    .max(32),
  // Φρουρός πόρου (4096) — το πραγματικό ταβάνι (2048) το λέει ονομαστικά ο κριτής.
  website: z.string().max(4096).nullable(),
});

export type ShowcaseCardResponse =
  | { readonly locations: readonly OwnedShowcaseLocation[]; readonly website: string | null }
  | { readonly error: 'INVALID_CARD'; readonly reason: AgencyProfileRejection }
  /** Ο τόπος **ποιου** καταστήματος — η φόρμα έχει πολλά, και «κάποιος τόπος» είναι γρίφος. */
  | { readonly error: PlaceError; readonly locationIndex: number }
  | { readonly error: 'SHOWCASE_NOT_PUBLISHED' }
  | { readonly error: 'READ_FAILED' }
  | { readonly error: 'WRITE_FAILED' };

/**
 * **Επαληθεύει κάθε τόπο και παράγει τη γεωμετρία του** — με την **ίδια** κρίση που ρωτά η
 * βιτρίνα (`locatePlace`): *«άλλαξέ τον»* (422) ≠ *«ξαναδοκίμασε»* (503).
 */
export async function verifyLocations(
  adminDb: ReturnType<typeof getAdminFirestore>,
  wire: ShowcaseCardWire,
): Promise<
  | { readonly declared: readonly VerifiedLocationDeclaration[] }
  | { readonly rejected: NextResponse<ShowcaseCardResponse> }
> {
  const declared: VerifiedLocationDeclaration[] = [];
  for (const [locationIndex, location] of wire.locations.entries()) {
    const located = await locatePlace(adminDb, location.place);
    if ('placeError' in located) {
      return {
        rejected: NextResponse.json(
          { error: located.placeError, locationIndex },
          { status: PLACE_ERROR_STATUS[located.placeError] },
        ),
      };
    }
    declared.push({ wire: location, position: located.position });
  }
  return { declared };
}
