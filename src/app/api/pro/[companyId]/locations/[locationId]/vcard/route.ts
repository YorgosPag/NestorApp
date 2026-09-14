/**
 * @fileoverview 🏆 **«ΑΠΟΘΗΚΕΥΣΗ ΕΠΑΦΗΣ»** — η vCard ενός καταστήματος, σε ανώνυμο (ADR-841 §7 Α21.17).
 * @related services/mandate/showcase-card-reveal (`revealLocationCard`) · lib/contact/vcard · lib/agency/showcase-vcard
 * @module app/api/pro/[companyId]/locations/[locationId]/vcard/route
 *
 * 🔒 **ΜΕΤΡΑ ΩΣ ΕΜΦΑΝΙΣΗ**: περιέχει τους ίδιους αριθμούς, άρα `withHeavyRateLimit` (το **ίδιο** όριο με το
 * `channels`), ίδιες κεφαλίδες `no-store`/`noindex`, **ταυτόσημο 404**. Μια πόρτα λιγότερο αυστηρή από την
 * άλλη θα γινόταν απλώς η πόρτα που χρησιμοποιεί ο συλλέκτης.
 *
 * 🔑 **Χτίζεται τη στιγμή του αιτήματος, ποτέ αποθηκευμένη**: αλλαγή τηλεφώνου στην κάρτα ⇒ η επόμενη λήψη
 * φέρνει τον νέο αριθμό. Ένα προπαραγμένο αρχείο θα ήταν δεύτερο αντίγραφο που παλιώνει.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { agencyProfileRoute } from '@/components/mandate/agency-directory-route';
import { showcaseLocationVCard } from '@/lib/agency/showcase-vcard';
import { buildVCard, vcardFileName } from '@/lib/contact/vcard';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { attachmentDisposition } from '@/lib/http/content-disposition';
import { absoluteUrl } from '@/lib/http/request-origin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { revealLocationCard } from '@/services/mandate/showcase-card-reveal';
import { PRIVATE_CHANNEL_HEADERS } from '@/app/api/pro/private-response-headers';

interface VCardSegment {
  readonly params: Promise<{ readonly companyId: string; readonly locationId: string }>;
}

type VCardFailure = { readonly error: 'NOT_FOUND' } | { readonly error: 'UNAVAILABLE' };

function notFound(): NextResponse<VCardFailure> {
  return NextResponse.json({ error: 'NOT_FOUND' } as const, { status: 404, headers: PRIVATE_CHANNEL_HEADERS });
}

async function vcardHandler(request: NextRequest, segment?: VCardSegment): Promise<NextResponse> {
  if (segment === undefined) return notFound();
  const { companyId, locationId } = await segment.params;
  const reveal = await revealLocationCard(getAdminFirestore(), companyId, locationId);

  switch (reveal.kind) {
    case 'absent':
      return notFound();
    // 🔴 **Δεν μάθαμε** — ποτέ 404: ο επισκέπτης θα συμπέραινε ότι το γραφείο δεν έχει τηλέφωνο.
    case 'unavailable':
      return NextResponse.json({ error: 'UNAVAILABLE' } as const, { status: 503, headers: PRIVATE_CHANNEL_HEADERS });
    case 'revealed': {
      const profileUrl = absoluteUrl(request, agencyProfileRoute(reveal.showcase.alias));
      const card = showcaseLocationVCard(reveal.showcase, reveal.location, reveal.channels, profileUrl);
      return new NextResponse(buildVCard(card), {
        headers: {
          ...PRIVATE_CHANNEL_HEADERS,
          'Content-Type': 'text/vcard; charset=utf-8',
          'Content-Disposition': attachmentDisposition(vcardFileName(card)),
        },
      });
    }
  }
}

export const GET = withHeavyRateLimit<VCardSegment>(vcardHandler);
