'use client';

/**
 * ADR-651 Φάση Λ — client cache του **QR κωδικού** της πινακίδας (§5.11, §8 #8).
 *
 * Το QR είναι «άλλη μια εικόνα σε κελί πινακίδας», ακριβώς όπως η σφραγίδα (Φάση Ε): μπαίνει ως
 * `RasterPrimitive` και τα τρία backends (canvas / PDF / in-scene `ImageEntity`) τη ζωγραφίζουν
 * δωρεάν. Άρα εδώ **δεν** υπάρχει δεύτερο image pipeline — μόνο η **γέννηση** του data URL.
 *
 * Ίδιος μηχανισμός φόρτωσης με τη σφραγίδα (`createKeyedImageCache`, N.18): keyed by **payload**
 * (το κείμενο που κωδικοποιεί το QR). Η μόνη διαφορά είναι το `decode`: αντί για fetch+canvas, το
 * QR **γεννιέται τοπικά** με `QRCode.toDataURL` (μοτίβο `api/attendance/qr/generate`) — μηδέν
 * δίκτυο, ντετερμινιστικό (ίδιο payload ⇒ ίδιο PNG).
 *
 * Προ-φορτώνεται όταν οπλίζεται το εργαλείο / ανοίγει η εκτύπωση και διαβάζεται **σύγχρονα** στο
 * κλικ/ghost/PDF (ADR-040: μηδέν `await` στο render path).
 *
 * @see ./title-block-fingerprint.ts — τι κωδικοποιεί το payload (σύνδεσμος + αποτύπωμα έκδοσης)
 * @see ./stamp-image-client.ts — το αδελφό cache της σφραγίδας (ίδιο factory)
 */

import QRCode from 'qrcode';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { createKeyedImageCache } from './title-block-image-cache';

const logger = createModuleLogger('TitleBlockQrImage');

/**
 * Το QR είναι **τετράγωνο** (widthPx === heightPx): αρκεί μία διάσταση. Μεγάλο enough για crisp
 * contain-fit στην εκτύπωση, χωρίς να φουσκώνει το data URL.
 */
const QR_SIZE_PX = 512;

/** Ένα φορτωμένο QR — PNG data URL + η (τετράγωνη) διάστασή του σε pixels. */
export interface QrImage {
  readonly dataUrl: string;
  readonly sizePx: number;
}

/** Γέννηση PNG data URL από το payload (τοπικά, ντετερμινιστικά — μηδέν δίκτυο). */
async function decodeQr(payload: string): Promise<QrImage> {
  const dataUrl = await QRCode.toDataURL(payload, {
    width: QR_SIZE_PX,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  return { dataUrl, sizePx: QR_SIZE_PX };
}

const qrCache = createKeyedImageCache<QrImage>(decodeQr, (error) =>
  logger.warn('QR code unavailable — printing the title block without a QR cell', {
    error: getErrorMessage(error),
  }),
);

/** Προ-φορτώνει το QR για το δοσμένο payload (idempotent· in-flight dedupe). Αποτυχία ⇒ `null`. */
export function loadTitleBlockQr(payload: string | undefined): Promise<QrImage | null> {
  return qrCache.load(payload);
}

/** Event-time read (κλικ / ghost / PDF). `null` όσο δεν έχει φορτώσει ή αν απέτυχε. */
export function getTitleBlockQr(payload: string | undefined): QrImage | null {
  return qrCache.get(payload);
}

/** Test seam — καθαρίζει το singleton μεταξύ των specs. */
export function __resetTitleBlockQrCacheForTests(): void {
  qrCache.reset();
}
