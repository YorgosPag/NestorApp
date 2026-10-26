/**
 * @fileoverview 🏷️ **ΤΟ ΟΝΟΜΑ ΕΝΟΣ ΠΡΟΦΙΛ ICC** — η περιγραφή («Coated FOGRA39», «sRGB IEC61966-2.1») από τα bytes του
 *   προφίλ, χωρίς βιβλιοθήκη (ADR-923 §5.10.3).
 * @module lib/images/icc-profile-name
 *
 * Μορφή (ICC.1:2022 §7): κεφαλίδα 128 bytes · πλήθος tags (uint32 BE) · πίνακας 12 bytes ανά tag (υπογραφή · offset ·
 * μέγεθος). Το tag `desc` έχει **δύο** μορφές:
 * - ICC v2 `desc` (`textDescriptionType`): μήκος ASCII (μαζί με το NUL) και το κείμενο.
 * - ICC v4 `mluc` (`multiLocalizedUnicodeType`): εγγραφές (γλώσσα · χώρα · μήκος · offset) με κείμενο UTF-16BE.
 *   Προτιμάται η αγγλική εγγραφή — είναι αυτή που τυπώνουν τα Photoshop/InDesign/Acrobat.
 *
 * 🔒 **Τα bytes είναι ξένα**: κάθε offset ελέγχεται πριν διαβαστεί, το κείμενο κόβεται, οι χαρακτήρες ελέγχου
 *   αφαιρούνται. Αποτυχία ⇒ `null`, ποτέ εξαίρεση (το όνομα είναι πληροφορία, όχι προϋπόθεση).
 * ⚠️ **Καθαρό, χωρίς Node**: προβάλλεται στα Cloud Functions (ADR-874 · CHECK 3.93).
 */

const HEADER_BYTES = 128;
const TAG_ENTRY_BYTES = 12;
/** Ένα προφίλ με περισσότερα tags είναι κατεστραμμένο ή κακόβουλο — τα πραγματικά έχουν δεκάδες. */
const MAX_TAGS = 1024;
/** Μια περιγραφή προφίλ είναι μια γραμμή· ό,τι μακρύτερο κόβεται. */
export const ICC_PROFILE_NAME_MAX_LENGTH = 200;

function uint32(bytes: Uint8Array, at: number): number | null {
  if (at < 0 || at + 4 > bytes.byteLength) return null;
  return ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
}

function signature(bytes: Uint8Array, at: number): string | null {
  if (at < 0 || at + 4 > bytes.byteLength) return null;
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

/** Κανονικό κείμενο: χωρίς NUL/χαρακτήρες ελέγχου, κομμένα κενά και μήκος — ή `null` αν δεν μείνει τίποτα. */
function cleanName(raw: string): string | null {
  const cleaned = raw.replace(/\p{Cc}/gu, '').trim().slice(0, ICC_PROFILE_NAME_MAX_LENGTH).trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Η θέση του tag `desc` μέσα στο προφίλ: `[offset, size]`, ή `null`. */
function descTagRange(bytes: Uint8Array): readonly [number, number] | null {
  const count = uint32(bytes, HEADER_BYTES);
  if (count === null || count > MAX_TAGS) return null;
  for (let index = 0; index < count; index++) {
    const entry = HEADER_BYTES + 4 + index * TAG_ENTRY_BYTES;
    if (signature(bytes, entry) !== 'desc') continue;
    const offset = uint32(bytes, entry + 4);
    const size = uint32(bytes, entry + 8);
    if (offset === null || size === null || offset + size > bytes.byteLength) return null;
    return [offset, size];
  }
  return null;
}

/** ICC v2 `textDescriptionType`: 'desc' · 4 δεσμευμένα · μήκος ASCII (με NUL) · κείμενο. */
function textDescription(bytes: Uint8Array, offset: number, size: number): string | null {
  const length = uint32(bytes, offset + 8);
  if (length === null || length === 0 || 12 + length > size) return null;
  let text = '';
  for (let i = 0; i < length; i++) text += String.fromCharCode(bytes[offset + 12 + i]);
  return cleanName(text);
}

function utf16be(bytes: Uint8Array, start: number, length: number): string {
  let text = '';
  for (let i = 0; i + 1 < length; i += 2) text += String.fromCharCode((bytes[start + i] << 8) | bytes[start + i + 1]);
  return text;
}

/** ICC v4 `multiLocalizedUnicodeType`: προτίμηση στην αγγλική εγγραφή, αλλιώς η πρώτη. */
function multiLocalized(bytes: Uint8Array, offset: number, size: number): string | null {
  const records = uint32(bytes, offset + 8);
  const recordSize = uint32(bytes, offset + 12);
  if (records === null || recordSize === null || records === 0 || recordSize < 12) return null;
  if (16 + records * recordSize > size) return null;
  let chosen = offset + 16;
  for (let index = 0; index < records; index++) {
    const record = offset + 16 + index * recordSize;
    if (signature(bytes, record)?.startsWith('en')) {
      chosen = record;
      break;
    }
  }
  const length = uint32(bytes, chosen + 4);
  const textOffset = uint32(bytes, chosen + 8);
  if (length === null || textOffset === null || textOffset + length > size) return null;
  return cleanName(utf16be(bytes, offset + textOffset, length));
}

/** **Bytes προφίλ ⇒ όνομα**, ή `null` όταν δεν υπάρχει/δεν διαβάζεται περιγραφή. */
export function iccProfileName(bytes: Uint8Array): string | null {
  const range = descTagRange(bytes);
  if (range === null) return null;
  const [offset, size] = range;
  switch (signature(bytes, offset)) {
    case 'desc':
      return textDescription(bytes, offset, size);
    case 'mluc':
      return multiLocalized(bytes, offset, size);
    default:
      return null;
  }
}
