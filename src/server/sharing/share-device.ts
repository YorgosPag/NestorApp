import 'server-only';

/**
 * =============================================================================
 * SHARE DEVICE — «έχει ανοίξει ΑΥΤΗ η συσκευή αυτόν τον σύνδεσμο ξανά;» (ADR-884 §9.1 Α3′)
 * =============================================================================
 *
 * 🏆 **Πρότυπο**: το DocSend/Papermark ειδοποιούν σε **κάθε** επίσκεψη· το Google Drive **ποτέ**. Για ονομαστικό
 * σύνδεσμο περιήγησης και τα δύο αστοχούν: το «κάθε» το καίει η επαναφόρτωση, το «ποτέ» αφήνει τον αποστολέα τυφλό.
 * Απόφαση Giorgio 2026-09-26: ειδοποίηση **μόνο** στο **πρώτο** άνοιγμα και από **νέα** συσκευή.
 *
 * 🔑 **Συσκευή = cookie πρώτου μέρους ΑΝΑ ΣΥΝΔΕΣΜΟ**, με τυχαία τιμή 256 bit (ίδιος γεννήτορας με το διακριτικό του
 * συνδέσμου). ⛔ **Όχι** IP, **όχι** User-Agent, **όχι** αποτύπωμα browser: ένα αποτύπωμα ακολουθεί τον άνθρωπο σε
 * **κάθε** ιστότοπο και δεν σβήνεται· αυτό το cookie ζει **μόνο** για αυτόν τον σύνδεσμο, μόνο ως τη λήξη του, και
 * σβήνεται με τα cookies του browser.
 *
 * 🔑 **Αποθηκεύεται μόνο το αποτύπωμα** (`sha256`) — ίδιο μάθημα με το `tokenHash`: μια διαρροή της βάσης δεν δίνει
 * τιμή cookie. Η τιμή **δεν υπογράφεται**: όποιος πλαστογραφήσει «νέα συσκευή» κάνει ακριβώς ό,τι κάνει σβήνοντας τα
 * cookies του — ανοίγει τον σύνδεσμο που ήδη έχει. Η υπογραφή δεν προστατεύει τίποτα εδώ.
 *
 * 🔑 **Μία συναλλαγή** κρίνει «πρώτο · νέα · γνωστή» πάνω στο **φρέσκο** ανάγνωσμα: δύο ταυτόχρονα ανοίγματα από την
 * ίδια νέα συσκευή δεν βγάζουν δύο «νέα συσκευή».
 *
 * ⚠️ **Όριο μνήμης** (`SHARE_DEVICE_MEMORY`): πέρα από αυτό ο σύνδεσμος έχει προωθηθεί ευρέως και κάθε νέα συσκευή θα
 * ήταν θόρυβος — `saturated`, καμία ειδοποίηση, καμία ανάπτυξη του εγγράφου.
 *
 * @module server/sharing/share-device
 */

import type { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';

import { generateShareToken, hashShareToken, isPlausibleShareToken } from '@/lib/sharing/share-token';
import { grantCookieOptions } from '@/server/access-grant/access-grant';
import { collectionOfShareSource, type StoredShare } from './share-token-lookup';

/** Πόσες συσκευές θυμάται ένας σύνδεσμος. */
export const SHARE_DEVICE_MEMORY = 50;

/** Το πεδίο του εγγράφου κοινοποίησης — **μόνο** αποτυπώματα. */
export const SHARE_DEVICE_FIELD = 'openedDeviceHashes';

const COOKIE_PREFIX = 'nestor_share_device_';
/** Μόνο η επίλυση (`POST /api/shares/resolve`) το χρειάζεται — κανένα άλλο αίτημα δεν το κουβαλά. */
const COOKIE_PATH = '/api/shares';

/** Τι ήταν αυτό το άνοιγμα για τη συσκευή — ονομασμένο, ποτέ boolean. */
export type ShareDeviceOutcome = 'first-open' | 'new-device' | 'known' | 'saturated';

export function shareDeviceCookieName(shareId: string): string {
  return `${COOKIE_PREFIX}${shareId}`;
}

/** Η συσκευή που δηλώνει το αίτημα — μόνο αν έχει το σχήμα τιμής που εκδίδουμε. */
export function requestShareDevice(request: NextRequest, shareId: string): string | null {
  const value = request.cookies.get(shareDeviceCookieName(shareId))?.value;
  return isPlausibleShareToken(value) ? value : null;
}

/** Νέα συσκευή: η υπάρχουσα αν έχει σχήμα, αλλιώς καινούργια τιμή. */
export function shareDeviceOrNew(existing: string | null): { readonly value: string; readonly minted: boolean } {
  return existing === null ? { value: generateShareToken(), minted: true } : { value: existing, minted: false };
}

/** Γράφει το cookie συσκευής — ζει **όσο** ο σύνδεσμος (μετά τη λήξη δεν έχει τι να αναγνωρίσει). */
export function attachShareDevice(
  response: NextResponse,
  input: { readonly shareId: string; readonly value: string; readonly expiresAt: string },
  nowMs: number = Date.now(),
): void {
  const maxAge = Math.floor((Date.parse(input.expiresAt) - nowMs) / 1000);
  if (!Number.isFinite(maxAge) || maxAge <= 0) return;
  const cookie = { name: shareDeviceCookieName(input.shareId), path: COOKIE_PATH };
  response.cookies.set(cookie.name, input.value, grantCookieOptions(cookie, maxAge));
}

function hashesOf(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** Καθαρή κρίση πάνω σε φρέσκο ανάγνωσμα — δοκιμάσιμη χωρίς βάση. */
export function judgeShareDevice(known: readonly string[], hash: string): ShareDeviceOutcome {
  if (known.includes(hash)) return 'known';
  if (known.length >= SHARE_DEVICE_MEMORY) return 'saturated';
  return known.length === 0 ? 'first-open' : 'new-device';
}

/**
 * Η καταγραφή: τι ήταν το άνοιγμα, και **πολλοστή** συσκευή είναι (1 = πρώτο άνοιγμα). Ο αύξων αριθμός είναι η
 * ταυτότητα της ειδοποίησης (ιδεμποτία κατά **μετάβαση**, όπως `tour-access-notifier`): η συναλλαγή δίνει κάθε αριθμό
 * **μία** φορά, άρα δύο ειδοποιήσεις με το ίδιο κλειδί είναι δομικά αδύνατες.
 */
export interface ShareDeviceRegistration {
  readonly outcome: ShareDeviceOutcome;
  readonly ordinal: number;
}

/** Καταγράφει τη συσκευή **ατομικά** και λέει τι ήταν το άνοιγμα. */
export async function registerShareDevice(
  adminDb: Firestore,
  share: Pick<StoredShare, 'id' | 'source'>,
  device: string,
): Promise<ShareDeviceRegistration> {
  const hash = await hashShareToken(device);
  const ref = adminDb.collection(collectionOfShareSource(share.source)).doc(share.id);
  return adminDb.runTransaction(async (tx) => {
    const known = hashesOf((await tx.get(ref)).data()?.[SHARE_DEVICE_FIELD]);
    const outcome = judgeShareDevice(known, hash);
    if (outcome !== 'first-open' && outcome !== 'new-device') return { outcome, ordinal: known.length };
    tx.update(ref, { [SHARE_DEVICE_FIELD]: [...known, hash] });
    return { outcome, ordinal: known.length + 1 };
  });
}
