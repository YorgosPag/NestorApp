/**
 * `/q/<id>` — **η σύντομη διεύθυνση του τυπωμένου QR** (ADR-923 §5.13 Δ5, σχέδιο §4.4).
 *
 * 🔴 **307 με `no-store`, ποτέ 308.** Το 308 το θυμάται ο φυλλομετρητής: ένα αποσυρμένο προϊόν θα έμενε ανοιχτό από την κρυφή
 *    του μνήμη, και η ανάκληση δεν θα έφτανε ποτέ τον άνθρωπο με το χαρτί στο χέρι.
 * 🔒 Κρυφό, αποσυρμένο, ανακλημένο και ανύπαρκτο πάνε στο ίδιο 404. Το QR δεν είναι μαντείο.
 * 🔑 Σχετικό `Location` μέσω του `redirectTo`: ο διακομιστής δεν δηλώνει ποιος νομίζει ότι είναι.
 * 🔑 Βλάβη ανάγνωσης είναι 503, όχι 404: το προϊόν ίσως υπάρχει.
 *
 * @module app/(light)/q/[id]/route
 */

import { NextResponse, type NextRequest } from 'next/server';

import { redirectTo } from '@/lib/http/request-origin';
import { createModuleLogger } from '@/lib/telemetry';
import { readPublicModelTarget } from '@/services/public-catalog/public-catalog.reader';
import { PUBLIC_UNAVAILABLE_ROUTE, publicIdOfSegment } from '@/subapps/catalog/public/public-catalog-routes';

const logger = createModuleLogger('public-short-link');

const NO_STORE = 'no-store';

function temporaryRedirect(location: string): NextResponse {
  const response = redirectTo(location, 307);
  response.headers.set('Cache-Control', NO_STORE);
  return response;
}

export async function GET(_request: NextRequest, { params }: { readonly params: Promise<{ readonly id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  if (publicIdOfSegment(id) !== id) return temporaryRedirect(PUBLIC_UNAVAILABLE_ROUTE);
  try {
    return temporaryRedirect((await readPublicModelTarget(id)) ?? PUBLIC_UNAVAILABLE_ROUTE);
  } catch (error) {
    logger.warn('Το QR δεν επιλύθηκε', { id, error: error instanceof Error ? error.message : String(error) });
    return new NextResponse(null, { status: 503, headers: { 'Cache-Control': NO_STORE } });
  }
}
