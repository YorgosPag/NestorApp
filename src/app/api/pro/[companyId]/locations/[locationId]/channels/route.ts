/**
 * @fileoverview 🏆 **«ΕΜΦΑΝΙΣΗ ΤΗΛΕΦΩΝΟΥ»** — η ΜΟΝΗ πόρτα από την οποία φεύγει κανάλι καρτας
 *   σε ανώνυμο (ADR-841 §7 Α21.16).
 * @related services/mandate/showcase-card-reveal · types/showcase-card.ts
 * @module app/api/pro/[companyId]/locations/[locationId]/channels/route
 *
 * 🔒 **ΑΝΩΝΥΜΗ ΚΑΙ ΣΚΟΠΙΜΑ ΑΥΣΤΗΡΗ**: `withHeavyRateLimit` (10/λεπτό ανά hash IP, **fail-closed**) —
 * η ίδια βαθμίδα με τις υπόλοιπες *«δημόσιες πόρτες χωρίς ταυτότητα»*. Εδώ **το όριο ΕΙΝΑΙ ο
 * φρουρός**: ένας άνθρωπος πατά μία-δύο φορές· ένα πρόγραμμα συγκομιδής πατά χιλιάδες.
 *
 * ⚠️ `Cache-Control: no-store` + `X-Robots-Tag: noindex` — ένα cache ενδιάμεσου θα σέρβιρε τον αριθμό
 * **χωρίς** να περάσει από το όριο, και μια μηχανή αναζήτησης θα τον ευρετηρίαζε.
 *
 * 🔑 **Ταυτόσημο 404** για ανύπαρκτο/αποσυρμένο/χωρίς κανάλια — η πόρτα δεν απαντά *«υπάρχει;»*.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { revealLocationChannels } from '@/services/mandate/showcase-card-reveal';
import type { RevealedChannels } from '@/types/showcase-card';
import { PRIVATE_CHANNEL_HEADERS as PRIVATE_HEADERS } from '@/app/api/pro/private-response-headers';

interface ChannelsSegment {
  readonly params: Promise<{ readonly companyId: string; readonly locationId: string }>;
}

export type ChannelRevealResponse =
  | { readonly channels: RevealedChannels }
  | { readonly error: 'NOT_FOUND' }
  | { readonly error: 'UNAVAILABLE' };

async function revealHandler(
  _request: NextRequest,
  segment?: ChannelsSegment,
): Promise<NextResponse<ChannelRevealResponse>> {
  if (segment === undefined) {
    return NextResponse.json({ error: 'NOT_FOUND' } as const, { status: 404, headers: PRIVATE_HEADERS });
  }
  const { companyId, locationId } = await segment.params;
  const reveal = await revealLocationChannels(getAdminFirestore(), companyId, locationId);

  switch (reveal.kind) {
    case 'revealed':
      return NextResponse.json({ channels: reveal.channels }, { headers: PRIVATE_HEADERS });
    case 'absent':
      return NextResponse.json({ error: 'NOT_FOUND' } as const, { status: 404, headers: PRIVATE_HEADERS });
    // 🔴 **Δεν μάθαμε** — ποτέ 404: ο επισκέπτης θα συμπέραινε ότι το γραφείο δεν έχει τηλέφωνο.
    case 'unavailable':
      return NextResponse.json({ error: 'UNAVAILABLE' } as const, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export const GET = withHeavyRateLimit<ChannelsSegment>(revealHandler);
