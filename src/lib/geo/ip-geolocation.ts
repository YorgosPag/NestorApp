import 'server-only';

/**
 * @fileoverview **«Από πού, περίπου, ήρθε αυτό το αίτημα;»** — με **τοπική** βάση GeoIP. Η IP δεν φεύγει ποτέ σε τρίτο.
 * @related ADR-894 · `ip-place.types.ts` (το σχήμα) · `lib/http/client-ip.ts` (η διεύθυνση) ·
 *   `lib/security/outbound-url-guard.ts` (`isPublicAddress`) · `scripts/fetch-geoip-db.ts` (η βάση)
 * @module lib/geo/ip-geolocation
 *
 * 🔑 **Πρότυπο GitHub «Sessions» / Google «Your devices»**: επίπεδο πόλης, επίλυση στον server, από την IP
 * του αιτήματος. Μέχρι τις 2026-09-29 ο **browser** ρωτούσε το `ipapi.co` (ADR-891 §10.4 Θ1).
 *
 * 🔑 **Η βάση είναι η DB-IP City Lite** (MMDB, CC BY 4.0). Ο αναγνώστης (`maxmind`, MIT) τη φορτώνει **μία**
 * φορά ανά διεργασία, **τεμπέλικα**, και την ξαναφορτώνει όταν αλλάξει το αρχείο (`watchForUpdates`) ⇒ αν
 * κάποτε η βάση ζήσει σε τόμο με updater (πρότυπο MaxMind `geoipupdate`), δεν αλλάζει γραμμή εδώ.
 *
 * ⛔ **Υποβάθμιση, ποτέ σφάλμα.** Βάση που λείπει ⇒ `database-unavailable`, και η σύνδεση προχωρά. Μια
 * εξαίρεση εδώ θα έριχνε τη σύνδεση για ένα διακοσμητικό πεδίο.
 */

import path from 'node:path';

import { open, type CityResponse, type Reader } from 'maxmind';

import { isPublicAddress } from '@/lib/security/outbound-url-guard';
import { createModuleLogger } from '@/lib/telemetry';

import { DEFAULT_GEOIP_DB_RELATIVE_PATH } from './ip-geolocation-paths';
import type { GeoIpSource, IpPlace, IpPlaceBasis } from './ip-place.types';

const logger = createModuleLogger('IpGeolocation');

/** Αποτυχημένο άνοιγμα ⇒ ξαναδοκιμή μετά από τόσο, όχι σε κάθε αίτημα. */
const REOPEN_BACKOFF_MS = 10 * 60 * 1000;

/** Ό,τι χρειάζεται ο επιλυτής από τον αναγνώστη — για να δοκιμάζεται χωρίς πραγματικό MMDB. */
export type GeoIpReader = Pick<Reader<CityResponse>, 'get' | 'metadata'>;

export function geoIpDatabasePath(): string {
  return process.env.GEOIP_DB_PATH || path.join(process.cwd(), DEFAULT_GEOIP_DB_RELATIVE_PATH);
}

function placeWithout(basis: IpPlaceBasis, source: GeoIpSource | null = null): IpPlace {
  return { countryCode: null, city: null, region: null, precision: 'none', basis, source };
}

/** Η προέλευση από τα **ίδια** τα μεταδεδομένα του αρχείου — καμία δεύτερη αλήθεια δίπλα του. */
export function geoIpSourceOf(reader: GeoIpReader): GeoIpSource {
  const { databaseType, buildEpoch } = reader.metadata;
  return { database: databaseType, edition: buildEpoch.toISOString().slice(0, 7) };
}

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Καθαρή συνάρτηση: εγγραφή MMDB → απάντηση. Χώρα χωρίς πόλη ⇒ `country`· τίποτα ⇒ `no-match`. */
export function placeFromRecord(record: CityResponse | null, source: GeoIpSource): IpPlace {
  const isoCode = nonEmpty(record?.country?.iso_code);
  const countryCode = isoCode && /^[A-Za-z]{2}$/.test(isoCode) ? isoCode.toUpperCase() : null;
  if (!countryCode) return placeWithout('no-match', source);

  const city = nonEmpty(record?.city?.names?.en);
  const region = nonEmpty(record?.subdivisions?.[0]?.names?.en);
  return { countryCode, city, region, precision: city ? 'city' : 'country', basis: 'geoip', source };
}

/** Επίλυση με **δοσμένο** αναγνώστη — ο πυρήνας, χωρίς κατάσταση. */
export function resolveIpPlaceWith(reader: GeoIpReader | null, ip: string): IpPlace {
  if (!ip || ip === 'unknown') return placeWithout('no-address');
  if (!isPublicAddress(ip)) return placeWithout('non-public-address');
  if (!reader) return placeWithout('database-unavailable');

  const source = geoIpSourceOf(reader);
  try {
    return placeFromRecord(reader.get(ip), source);
  } catch (error) {
    // Μη έγκυρη διεύθυνση για τον αναγνώστη — ποτέ δεν ρίχνει το αίτημα.
    logger.warn('GeoIP lookup failed', { error: error instanceof Error ? error.message : String(error) });
    return placeWithout('no-match', source);
  }
}

let readerPromise: Promise<GeoIpReader | null> | null = null;
let retryAfter = 0;

function openReader(): Promise<GeoIpReader | null> {
  const dbPath = geoIpDatabasePath();
  return open<CityResponse>(dbPath, { watchForUpdates: true, watchForUpdatesNonPersistent: true })
    .then((reader): GeoIpReader => {
      logger.info('GeoIP database opened', { ...geoIpSourceOf(reader) });
      return reader;
    })
    .catch((error: unknown) => {
      logger.warn('GeoIP database unavailable — locations degrade to unknown', {
        error: error instanceof Error ? error.message : String(error),
      });
      readerPromise = null;
      retryAfter = Date.now() + REOPEN_BACKOFF_MS;
      return null;
    });
}

/** Ο **ένας** αναγνώστης της διεργασίας· `null` όσο η βάση λείπει (με αναμονή πριν από νέα απόπειρα). */
function sharedReader(): Promise<GeoIpReader | null> {
  if (readerPromise) return readerPromise;
  if (Date.now() < retryAfter) return Promise.resolve(null);
  readerPromise = openReader();
  return readerPromise;
}

/** **Η** απάντηση για τη διεύθυνση ενός αιτήματος. Δεν ρίχνει ποτέ. */
export async function resolveIpPlace(ip: string): Promise<IpPlace> {
  if (!ip || ip === 'unknown' || !isPublicAddress(ip)) return resolveIpPlaceWith(null, ip);
  return resolveIpPlaceWith(await sharedReader(), ip);
}

/** Μόνο για tests: ξεχνά τον αναγνώστη της διεργασίας. */
export function resetGeoIpReaderForTests(): void {
  readerPromise = null;
  retryAfter = 0;
}
