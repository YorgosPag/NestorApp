/**
 * @fileoverview **«ΣΕ ΠΟΙΑ ΠΕΡΙΟΧΗ ΜΠΟΡΩ ΝΑ ΠΩ ΟΤΙ ΕΙΝΑΙ;»** — οι επιλογές δηλωμένης περιοχής για μια θέση (ADR-890 §21).
 * @related `services/places/admin-area-attribution.server.ts` (ο ΕΝΑΣ κριτής) · `OwnerPropertyAreaPicker.tsx` (καταναλωτής)
 * @module app/api/places/declarable-areas/route
 *
 * 🔑 **Δεν γράφει τίποτα — δείχνει.** Απαντά με ό,τι η πόρτα γραφής **θα δεχόταν** για αυτό το σημείο και αυτή την
 * ακρίβεια, κρινόμενο από τον **ίδιο** κριτή. Η φόρμα δεν μπορεί να προσφέρει δήλωση που ο server θα απορρίψει.
 *
 * ⚠️ **Απαιτεί ταυτότητα**, όπως το `/api/places/lookup`: τα όρια είναι δημόσια αρχεία, αλλά κάθε κλήση ανοίγει
 * δεκάδες από αυτά στον server — ανώνυμη πόρτα θα ήταν φθηνό εργαλείο φόρτου. Ο ρυθμιστής είναι ο τυπικός: μία
 * κλήση ανά εντοπισμό διεύθυνσης.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { nowISO } from '@/lib/date-local';
import { GEOCODING_ACCURACIES, type GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { isWithinServedArea } from '@/lib/places/place-claim-validation';
import { declarableAdminAreasAt } from '@/services/places/admin-area-attribution.server';
import { addressToPositionCandidate } from '@/services/listings/public-listing-position';

/** Μια επιλογή, όπως τη ζωγραφίζει η φόρμα — όνομα από το ΕΝΑ ευρετήριο, ποτέ αντίγραφο. */
export interface DeclarableAreaOption {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly parentId: string | null;
}

export interface DeclarableAreasResponse {
  readonly options: readonly DeclarableAreaOption[];
  /** Η πρόταση της μηχανής — πάντα μία από τις `options`, ή `null`. Ο άνθρωπος την επιβεβαιώνει. */
  readonly suggestedId: string | null;
}

interface DeclarableAreasError {
  readonly error: string;
}

function numberParam(params: URLSearchParams, name: string): number | null {
  const raw = params.get(name);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `accuracy` απούσα ⇒ χειροκίνητο σημείο· άγνωστη τιμή ⇒ `undefined` (400, ποτέ σιωπηλή εικασία). */
function accuracyParam(params: URLSearchParams): GeocodingAccuracy | null | undefined {
  const raw = params.get('accuracy');
  if (raw === null || raw === '') return null;
  return GEOCODING_ACCURACIES.find((accuracy) => accuracy === raw);
}

function toOption({ id, name, level, parentId }: AdminArea): DeclarableAreaOption {
  return { id, name, level, parentId };
}

async function handler(request: NextRequest): Promise<NextResponse<DeclarableAreasResponse | DeclarableAreasError>> {
  const params = new URL(request.url).searchParams;
  const lat = numberParam(params, 'lat');
  const lng = numberParam(params, 'lng');
  const accuracy = accuracyParam(params);

  if (lat === null || lng === null || accuracy === undefined) {
    return NextResponse.json({ error: 'INVALID_POSITION' }, { status: 400 });
  }
  if (!isWithinServedArea({ lat, lng })) {
    return NextResponse.json({ options: [], suggestedId: null });
  }

  // 🔑 Η ΙΔΙΑ μετατροπή «συντεταγμένες + ακρίβεια → θέση» με την προβολή — όχι δεύτερη απόφαση προέλευσης.
  const position = addressToPositionCandidate(
    { coordinates: { lat, lng }, geocodingMetadata: accuracy === null ? null : { accuracy } },
    nowISO(),
  );
  if (position === null) return NextResponse.json({ error: 'INVALID_POSITION' }, { status: 400 });

  const result = await declarableAdminAreasAt(position, params.get('locality'));
  if (result === null) {
    // 🔴 503, ποτέ «καμία επιλογή»: αλλιώς μια αστοχία ανάγνωσης θα έλεγε στον άνθρωπο ότι δεν έχει τι να δηλώσει.
    return NextResponse.json({ error: 'AREAS_UNAVAILABLE' }, { status: 503, headers: { 'Retry-After': '5' } });
  }
  return NextResponse.json({ options: result.candidates.map(toOption), suggestedId: result.suggestedId });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handler));
