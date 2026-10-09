/**
 * @fileoverview 🎬 **ΤΟ `VideoObject` ΤΗΣ ΑΓΓΕΛΙΑΣ** — δημόσιο έγγραφο → δομημένα δεδομένα, ή `null` (ADR-907 §10.10).
 * @related lib/seo/json-ld.ts · components/seo/JsonLdScript.tsx · components/listing-detail/ListingVideos.tsx
 * @module lib/listings/listing-video-structured-data
 *
 * 🔑 **ΔΗΛΩΝΕΙ ΜΟΝΟ Ο,ΤΙ Η ΟΘΟΝΗ ΔΕΙΧΝΕΙ.** Ο ίδιος κριτής προέλευσης (`isPubliclyPresentable`, ADR-842 Α7) που
 * φυλά το φύλλο `ListingVideos` φυλά και αυτό: βίντεο που ο αγοραστής δεν θα έβλεπε δεν διαφημίζεται σε ανιχνευτή.
 *
 * 🔴 **ΥΠΟΧΡΕΩΤΙΚΟ ΠΕΔΙΟ ΠΟΥ ΛΕΙΠΕΙ ⇒ ΚΑΝΕΝΑ `VideoObject`, ΠΟΤΕ ΨΕΥΤΙΚΗ ΤΙΜΗ.** Η Google ζητά `name` ·
 * `thumbnailUrl` · `uploadDate`. Βίντεο χωρίς εξώφυλλο (`poster: null` — ανέβηκε πριν το §10.8, ή ο browser του
 * εκδότη δεν είχε αποκωδικοποιητή) **δεν** δηλώνεται: ξένη φωτογραφία ως μικρογραφία θα ήταν ψέμα προς μηχανή.
 *
 * ⛔ **ΚΑΝΕΝΑ `description`, ΕΠΙΤΗΔΕΣ** (συνιστώμενο, όχι υποχρεωτικό): η Google ζητά κείμενο **μοναδικό ανά
 * βίντεο**, και δεν έχουμε περιγραφή του βίντεο — κανείς δεν τη γράφει. Η πρόταση `alt` («Βίντεο του ακινήτου…»)
 * είναι ίδια σε κάθε αγγελία· ως `description` θα ήταν υπόσχεση χωρίς μηχανισμό. Γι' αυτό και **κανένα κλειδί i18n**.
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE** — καμία I/O, κανένα ρολόι, καμία μεταβλητή περιβάλλοντος: οι διευθύνσεις του ραφιού είναι
 * ήδη απόλυτες, και η ώρα έρχεται από το έγγραφο.
 */

import { LISTING_VIDEO_CONTENT_TYPE } from '@/lib/listings/listing-video-policy';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import type { ListingImage, ListingVideo, PublicListing } from '@/types/public-listing';

const SCHEMA_ORG_CONTEXT = 'https://schema.org';

/** Ένας κόμβος JSON-LD — αντικείμενο, ώστε να δέχεται `@context` χωρίς ισχυρισμό τύπου. */
type JsonLdNode = { readonly [key: string]: JsonLdValue };

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/**
 * Δευτερόλεπτα → διάρκεια ISO 8601 (`PT9S` · `PT2M5S` · `PT1H`), ή `null` όταν δεν είναι διάρκεια.
 *
 * ⚠️ Στρογγυλεύει στο **ακέραιο** δευτερόλεπτο, όπως το ρολόι της σκηνής (`formatMediaClock`) — ο ανιχνευτής και ο
 * άνθρωπος διαβάζουν την ίδια διάρκεια. Κλιπ κάτω από μισό δευτερόλεπτο γράφεται `PT1S`: `PT0S` δεν είναι βίντεο.
 */
export function isoDurationFromSeconds(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const total = Math.max(1, Math.round(seconds));
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const rest = total % SECONDS_PER_MINUTE;

  const parts = [hours > 0 ? `${hours}H` : '', minutes > 0 ? `${minutes}M` : '', rest > 0 ? `${rest}S` : ''];
  return `PT${parts.join('')}`;
}

/** Είναι απόλυτη διεύθυνση `https`; Σχετική διεύθυνση σε JSON-LD λύνεται όπου τύχει — δεν δηλώνεται. */
function isAbsoluteHttps(candidate: string): boolean {
  try {
    return new URL(candidate).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Κάθε παράγωγο του εξωφύλλου, το μεγαλύτερο πρώτο, χωρίς επανάληψη — μόνο ό,τι κάθεται ήδη στο ράφι. */
function thumbnailUrls(poster: ListingImage): readonly string[] {
  const largestFirst = [poster.url, ...[...poster.sources].reverse().map((source) => source.url)];
  return [...new Set(largestFirst)].filter(isAbsoluteHttps);
}

/** Η στιγμή του εγγράφου ως ISO με ζώνη — ή `null` όταν δεν διαβάζεται ως στιγμή. */
function uploadDateOf(video: ListingVideo): string | null {
  const instant = Date.parse(video.at);
  return Number.isNaN(instant) ? null : new Date(instant).toISOString();
}

function videoObject(name: string, video: ListingVideo): JsonLdNode | null {
  const { poster, url, durationSec } = video.value;
  if (poster === null || !isAbsoluteHttps(url)) return null;

  const thumbnailUrl = thumbnailUrls(poster);
  const uploadDate = uploadDateOf(video);
  if (thumbnailUrl.length === 0 || uploadDate === null) return null;

  const duration = isoDurationFromSeconds(durationSec);
  return {
    '@type': 'VideoObject',
    name,
    thumbnailUrl,
    uploadDate,
    contentUrl: url,
    encodingFormat: LISTING_VIDEO_CONTENT_TYPE,
    ...(duration === null ? {} : { duration }),
  };
}

/**
 * **Τα δομημένα δεδομένα βίντεο μιας δημόσιας αγγελίας** — `null` όταν δεν υπάρχει τίποτα αληθινό να δηλωθεί.
 *
 * Ένα βίντεο ⇒ ένα `VideoObject`· περισσότερα ⇒ `@graph` (η πολιτική δημοσιεύει σήμερα **ένα**, αλλά ο τύπος είναι
 * πίνακας, και σιωπηλή απόρριψη του δεύτερου θα ήταν δεύτερο όριο «ένα βίντεο» γραμμένο σε λάθος στρώμα).
 */
export function listingVideoStructuredData(listing: PublicListing): JsonLdValue | null {
  const name = listing.title.trim();
  if (name.length === 0) return null;

  const nodes = listing.videos
    .filter(isPubliclyPresentable)
    .map((video) => videoObject(name, video))
    .filter((node): node is JsonLdNode => node !== null);

  if (nodes.length === 0) return null;
  if (nodes.length === 1) return { '@context': SCHEMA_ORG_CONTEXT, ...nodes[0] };
  return { '@context': SCHEMA_ORG_CONTEXT, '@graph': nodes };
}
