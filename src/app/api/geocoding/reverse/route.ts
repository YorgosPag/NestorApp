/**
 * =============================================================================
 * 🗺️ REVERSE GEOCODING API — Server-side Nominatim Reverse Proxy
 * =============================================================================
 *
 * Server-side reverse geocoding proxy that:
 * - Accepts lat/lon query parameters
 * - Calls Nominatim reverse API with proper User-Agent (TOS)
 * - Validates coordinates are finite and on the globe
 * - Returns structured address data for form population
 * - Rate limited: withHeavyRateLimit (10 req/min)
 *
 * ⚠️ ADR-332 D27 Β13 — εδώ έγραφε «Validates coordinates within Greek bounding box», και ο
 * κώδικας **δεν το έκανε ποτέ**. Η υπόσχεση αφαιρέθηκε αντί να υλοποιηθεί: ο ίδιος χάρτης
 * σέρνεται και για επαφές σε Κύπρο / Βουλγαρία (ADR-332 D12), που ένα ελληνικό πλαίσιο θα απέρριπτε.
 *
 * 🔑 **ΜΙΑ ΠΡΟΘΕΣΜΙΑ ΓΙΑ ΟΛΟ ΤΟ ΑΙΤΗΜΑ** (Β13 · Google SRE «deadline propagation»). Ως τις
 * 2026-09-10 το Nominatim είχε 8″ και μετά έτρεχαν έως **τρία διαδοχικά** Overpass των έως τριών
 * προσπαθειών × 6″ — μετρημένα 24–38″ στον διάλογο. Τώρα το αίτημα έχει **ένα** απόλυτο όριο
 * (`GEOCODING.REVERSE_BUDGET_MS`) και κάθε στάδιο παίρνει **ό,τι απομένει**. Αν τελειώσει ο χρόνος
 * πριν βρεθεί αριθμός, η απάντηση φεύγει **χωρίς** αριθμό — ίδιο με «το OSM δεν έχει αριθμό εδώ».
 *
 * 🔴 **Τρεις εκβάσεις, όχι δύο**: «ο πάροχος δεν απάντησε» έφευγε ως **404** («εδώ δεν γράφει
 * τίποτα») και ο διάλογος έλεγε ψέματα στον άνθρωπο. Πλέον φεύγει ως **503**.
 *
 * @module app/api/geocoding/reverse/route
 * @see geographic-config.ts, geocoding-service.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { createDeadline, type Deadline } from '@/lib/async-utils';
import { findNearestHouseNumber } from '@/lib/geocoding/overpass-housenumber';
import {
  ADMIN_ID_TRUSTED_VIA,
  identifyWithin,
  provedLevelsOfPlace,
  resolveAdminChain,
} from '@/lib/places/admin-identity';
import { readAdminIdentitySources } from '@/services/places/administrative-hierarchy.reader';
import { PATH_KEY_TO_LEVEL } from '@/lib/places/admin-path';
// ⚠️ Ο **ίδιος** τύπος που διαβάζει ο πελάτης (`ReverseGeocodingResult.admin`) — ένα σχήμα
//    και για τις δύο πλευρές του σύρματος, αλλιώς το συμβόλαιο αποκλίνει σιωπηλά (N.18).
import type {
  ProvedAdminLevel,
  ReverseGeocodingResult,
} from '@/lib/geocoding/geocoding-types';

const logger = createModuleLogger('reverse-geocoding-api');

/**
 * Οι **δύο** βαθμίδες που αποθηκεύει το `companyAddress` — δες
 * `administrative-hierarchy-vocabulary.ts`, όπου οι άλλες **έξι** είναι ρητά `NOT_STORED`.
 *
 * 🔑 **Από τον πίνακα, όχι με το χέρι**: δύο γυμνά `5` και `8` σε διαδρομή διακομιστή θα
 * ήταν «αριθμοί με κρυμμένο νόημα», και θα απέκλιναν την ημέρα που άλλαζε η αυθεντία.
 */
const { GEOCODING } = GEOGRAPHIC_CONFIG;

const ADMIN_LEVEL_MUNICIPALITY = PATH_KEY_TO_LEVEL.municipality;
const ADMIN_LEVEL_SETTLEMENT = PATH_KEY_TO_LEVEL.settlement;

// Vercel serverless timeout
export const maxDuration = 15;

// =============================================================================
// TYPES · ΛΕΞΙΛΟΓΙΟ ΚΑΙ ΠΕΛΑΤΗΣ ΤΟΥ ΠΑΡΟΧΟΥ
// =============================================================================
//
// 🔑 **ΜΕΤΑΚΟΜΙΣΑΝ ΣΤΟ `nominatim-reverse.ts`** (N.7.1 — CHECK 4: όριο διαδρομής API **300**
//    γραμμές, το αρχείο είχε φτάσει **428**). Η τομή είναι σημασιολογική, όχι αριθμητική:
//    εκεί ζει *«τι λέει ο πάροχος και πώς διαβάζεται»*, εδώ *«τι κάνει η διαδρομή με αυτό»*.
import {
  adminChainLabels,
  buildReverseUrl,
  fetchNominatimReverse,
  formatReverseResult,
  settlementLabelOf,
  type NominatimReverseAddress,
  type ReverseGeocodingApiResponse,
} from './nominatim-reverse';

// =============================================================================
// VALIDATION — μένει ΕΔΩ: κρίνει την ΕΙΣΟΔΟ ΤΗΣ ΔΙΑΔΡΟΜΗΣ, όχι την απάντηση του παρόχου.
// =============================================================================

function isValidLatLon(lat: number, lon: number): boolean {
  if (Number.isNaN(lat) || Number.isNaN(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}


/**
 * Συμπληρώνει τον αριθμό από το Overpass όταν λείπει — με **ό,τι απομένει** από την προθεσμία.
 * OSM Greek coverage frequently omits `addr:housenumber`.
 */
async function fillHouseNumber(
  formatted: ReverseGeocodingApiResponse,
  lat: number,
  lon: number,
  deadline: Deadline,
): Promise<{ nominatimNumber: string; overpassNumber: string | null }> {
  const nominatimNumber = formatted.number;
  const overpassNumber = nominatimNumber
    ? null
    : await findNearestHouseNumber(lat, lon, formatted.street, { deadline });
  if (overpassNumber) formatted.number = overpassNumber;

  logger.info('Reverse geocoding housenumber resolution', {
    data: {
      lat,
      lon,
      street: formatted.street,
      nominatimNumber,
      overpassNumber,
      finalNumber: formatted.number,
      remainingMs: deadline.remainingMs(),
    },
  });
  return { nominatimNumber, overpassNumber };
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/** Η αντίστροφη γεωκωδικοποίηση **μέσα** σε μία προθεσμία. */
async function reverseWithin(lat: number, lon: number, debug: boolean, deadline: Deadline): Promise<Response> {
  logger.info('Reverse geocoding request', { data: { lat, lon } });

  const lookup = await fetchNominatimReverse(buildReverseUrl(lat, lon), deadline);
  if (lookup.kind === 'absent') {
    return NextResponse.json({ error: 'No address found at this location' }, { status: 404 });
  }
  if (lookup.kind === 'unavailable') {
    return NextResponse.json({ error: 'Address provider unavailable' }, { status: 503 });
  }

  const formatted = formatReverseResult(lookup.result);
  const admin = await provedAdminOf(lookup.result.address);
  // 🔴 **Ζ2 — Η ΕΤΙΚΕΤΑ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΤΑΥΤΟΤΗΤΑ.** Όταν ο οικισμός **αποδείχθηκε**, η
  //    «Πόλη» γίνεται το όνομα του **μητρώου** και όχι της μηχανής. Ο κανόνας δεν είναι
  //    καλλωπισμός: το έργο απαγορεύει ρητά να αποκλίνουν ταυτότητα και ετικέτα
  //    (`use-hq-address-mutations`: «όνομα από πηγή εκτός ιεραρχίας ⇒ σβήσε το id»). Εδώ
  //    έχουμε id ⇒ οφείλουμε το **δικό μας** όνομα.
  //    ⚠️ Το τίμημα, δηλωμένο: η ΕΛΣΤΑΤ γράφει «**Αθήναι**» εκεί που το OSM λέει «Αθήνα»
  //    (2.678 ονόματα, 20,2%, σε αρχαΐζουσα μορφή). Προτιμάμε **συνεπή** ταυτότητα από
  //    ευχάριστη ετικέτα — και ο άνθρωπος μπορεί να τη διορθώσει, οπότε το id σβήνει μόνο του.
  const settlement = admin?.find((level) => level.level === ADMIN_LEVEL_SETTLEMENT);
  if (settlement) formatted.city = settlement.name;
  const trace = await fillHouseNumber(formatted, lat, lon, deadline);
  // ⚠️ `undefined` ⇒ το κλειδί **λείπει** από το JSON («δεν ρωτήθηκε»)· κενός πίνακας ⇒
  //    «ρωτήθηκε, τίποτα». Η διαφορά είναι το συμβόλαιο του `admin` — μη την ισοπεδώσεις.
  const body = admin === null ? formatted : { ...formatted, admin };

  return NextResponse.json(
    debug ? { ...body, _debug: { ...trace, street: formatted.street } } : body,
  );
}

/**
 * **Η ΙΕΡΑΡΧΙΑ ΠΟΥ ΑΠΟΔΕΙΚΝΥΕΤΑΙ ΑΠΟ ΤΗΝ ΑΛΥΣΙΔΑ** — και ο οικισμός **μέσα** στον δήμο της.
 *
 * @returns `null` όταν η ιεραρχία **δεν διαβάστηκε** *(βλάβη δική μας)*: ο πελάτης οφείλει
 *   τότε να **μην αγγίξει** τα πεδία ταυτότητας. Κενός πίνακας = «ρωτήθηκε, τίποτα».
 */
async function provedAdminOf(
  addr: NominatimReverseAddress,
): Promise<readonly ProvedAdminLevel[] | null> {
  const sources = await readAdminIdentitySources();
  if (!sources) return null;

  const { proved } = resolveAdminChain(adminChainLabels(addr), sources);
  const levels = new Map(proved);

  // 🔑 Ο οικισμός (βαθμίδα 8) απαντιέται **μόνο** μέσα στον αποδεδειγμένο δήμο — εκεί οι
  //    41 ομώνυμες «Καλλιθέα» γίνονται μία (93,9% των ομωνύμων ζουν σε άλλον δήμο).
  const municipality = levels.get(ADMIN_LEVEL_MUNICIPALITY);
  const settlementLabel = settlementLabelOf(addr);
  if (municipality && settlementLabel !== '') {
    const verdict = identifyWithin(settlementLabel, ADMIN_LEVEL_SETTLEMENT, municipality.id, sources);
    if (verdict.kind === 'identified' && ADMIN_ID_TRUSTED_VIA.includes(verdict.via)) {
      // 🔴 **ΚΑΙ ΤΑ ΕΝΔΙΑΜΕΣΑ ΕΠΙΠΕΔΑ — ΤΟ ΒΡΗΚΕ Η ΖΩΝΤΑΝΗ ΜΕΤΡΗΣΗ.** Η αλυσίδα της
      //    ετικέτας απέδειξε ως τον **δήμο**· ο οικισμός αποδείχθηκε **μετά**, μέσα σε
      //    εκείνη την εμβέλεια. Άρα **L6 δημοτική ενότητα** και **L7 κοινότητα** είναι
      //    **πρόγονοι αποδεδειγμένου οικισμού** ⇒ **αποδεδειγμένοι** — και γράφονταν
      //    **κενοί** *(μετρημένο: ALFA → Σταυρούπολις έγραψε `municipalUnitName: ''` ενώ
      //    το μητρώο ξέρει «ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΣΤΑΥΡΟΥΠΟΛΕΩΣ»)*.
      //    ⚠️ **Καμία σύγκρουση δυνατή**: η εμβέλεια **είναι** πρόγονος του οικισμού, άρα
      //    η γενεαλογία του **περιέχει** ό,τι είχε αποδείξει η αλυσίδα.
      for (const [level, place] of provedLevelsOfPlace(sources, verdict.entity)) {
        levels.set(level, place);
      }
    }
  }

  return [...levels.values()].map((place) => ({
    level: place.level,
    id: place.id,
    name: place.name,
  }));
}

async function handleGet(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');

  if (!latStr || !lonStr) {
    return NextResponse.json({ error: 'Missing required parameters: lat, lon' }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (!isValidLatLon(lat, lon)) {
    return NextResponse.json({ error: 'Invalid lat/lon values' }, { status: 400 });
  }

  const deadline = createDeadline(GEOCODING.REVERSE_BUDGET_MS);
  try {
    return await reverseWithin(lat, lon, searchParams.get('debug') === '1', deadline);
  } catch (error) {
    logger.error('Reverse geocoding API error', { error: getErrorMessage(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    deadline.dispose();
  }
}

export const GET = withHeavyRateLimit(handleGet);
