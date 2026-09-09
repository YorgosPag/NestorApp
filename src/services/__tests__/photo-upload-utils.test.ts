/**
 * Unit tests for photo-upload utility functions.
 * Tests pure functions extracted during ADR-065 SRP split.
 *
 * Covers:
 * - generateUniqueFileName (filename generation with prefix/extension)
 * - resolveContactName (priority resolution: explicit > contactData > undefined)
 * - resolvePhotoPurpose (validation against PHOTO_PURPOSES constants)
 */

import { generateUniqueFileName, resolveContactName, resolvePhotoPurpose } from '../photo-upload-types';

// ============================================================================
// generateUniqueFileName
// ============================================================================

describe('generateUniqueFileName', () => {
  it('preserves the original file extension', () => {
    const result = generateUniqueFileName('photo.jpg');
    expect(result).toMatch(/\.jpg$/);
  });

  it('preserves .png extension', () => {
    const result = generateUniqueFileName('screenshot.png');
    expect(result).toMatch(/\.png$/);
  });

  it('sanitizes special characters in base name', () => {
    const result = generateUniqueFileName('my photo (1).jpg');
    // Special chars replaced with underscores
    expect(result).not.toMatch(/[() ]/);
  });

  it('truncates long base names to 50 characters', () => {
    const longName = 'a'.repeat(100) + '.jpg';
    const result = generateUniqueFileName(longName);
    // Base name portion should be max 50 chars
    const basePart = result.split('_')[0];
    expect(basePart.length).toBeLessThanOrEqual(50);
  });

  it('includes prefix when provided', () => {
    const result = generateUniqueFileName('photo.jpg', 'contact_123');
    expect(result).toMatch(/^contact_123_/);
  });

  it('does not include prefix when not provided', () => {
    const result = generateUniqueFileName('photo.jpg');
    expect(result).not.toMatch(/^contact_/);
  });

  it('generates unique filenames on successive calls', () => {
    const result1 = generateUniqueFileName('photo.jpg');
    const result2 = generateUniqueFileName('photo.jpg');
    expect(result1).not.toBe(result2);
  });

  // ADR-293 replaced the old `Date.now()` infix with a canonical enterprise ID
  // (`generateFileId()` → `file_<uuid>`, no timestamp). The previous version of
  // this test still searched the filename for a 13-digit millisecond stamp and
  // had been red ever since — asserting a behaviour the code no longer has.
  // What the function actually guarantees is the enterprise ID, so assert that.
  it('embeds a canonical enterprise file ID (ADR-293 — not a raw timestamp)', () => {
    const result = generateUniqueFileName('photo.jpg');

    expect(result).toMatch(/_file_[0-9a-f-]{36}\.jpg$/i);
    // The legacy 13-digit millisecond stamp must NOT come back: raw Date.now()
    // in an identifier is exactly what SOS N.6 forbids.
    expect(result.split('_').some((p) => /^\d{13}$/.test(p))).toBe(false);
  });
});

// ============================================================================
// resolveContactName
// ============================================================================

describe('resolveContactName', () => {
  it('returns explicit contactName when provided', () => {
    expect(resolveContactName('Γιώργος', undefined)).toBe('Γιώργος');
  });

  it('returns contactData.name when contactName is undefined', () => {
    expect(resolveContactName(undefined, { name: 'Μαρία' })).toBe('Μαρία');
  });

  it('prefers explicit contactName over contactData.name', () => {
    expect(resolveContactName('Γιώργος', { name: 'Μαρία' })).toBe('Γιώργος');
  });

  it('returns undefined when both are missing', () => {
    expect(resolveContactName(undefined, undefined)).toBeUndefined();
  });

  it('returns undefined for empty string contactName', () => {
    expect(resolveContactName('', undefined)).toBeUndefined();
  });

  it('returns undefined for whitespace-only contactName', () => {
    expect(resolveContactName('   ', undefined)).toBeUndefined();
  });

  it('trims whitespace from contactName', () => {
    expect(resolveContactName('  Γιώργος  ', undefined)).toBe('Γιώργος');
  });

  it('trims whitespace from contactData.name', () => {
    expect(resolveContactName(undefined, { name: '  Μαρία  ' })).toBe('Μαρία');
  });

  it('returns undefined for empty contactData.name', () => {
    expect(resolveContactName(undefined, { name: '' })).toBeUndefined();
  });

  it('returns undefined for contactData without name field', () => {
    expect(resolveContactName(undefined, {})).toBeUndefined();
  });
});

// ============================================================================
// resolvePhotoPurpose
// ============================================================================

describe('resolvePhotoPurpose', () => {
  it('returns "profile" for valid "profile" input', () => {
    expect(resolvePhotoPurpose('profile')).toBe('profile');
  });

  it('returns "id" for valid "id" input', () => {
    expect(resolvePhotoPurpose('id')).toBe('id');
  });

  it('returns "other" for valid "other" input', () => {
    expect(resolvePhotoPurpose('other')).toBe('other');
  });

  it('defaults to "profile" for undefined input', () => {
    expect(resolvePhotoPurpose(undefined)).toBe('profile');
  });

  it('defaults to "profile" for empty string', () => {
    expect(resolvePhotoPurpose('')).toBe('profile');
  });

  it('defaults to "profile" for whitespace-only input', () => {
    expect(resolvePhotoPurpose('   ')).toBe('profile');
  });

  // ==========================================================================
  // 🔴 ADR-841 §7 Α21.8 — Η ΣΥΜΠΕΡΙΦΟΡΑ ΠΟΥ **ΑΝΤΙΣΤΡΑΦΗΚΕ**, ΚΑΙ ΓΙΑΤΙ
  // ==========================================================================
  //
  // Εδώ υπήρχε: `expect(resolvePhotoPurpose('invalid')).toBe('profile')` — δηλαδή
  // η άγκυρα **κωδικοποιούσε** το σιωπηλό ξέπλυμα ως προδιαγραφή.
  //
  // 🔑 Δεν ήταν επικύρωση: το `FileRecord.purpose` είναι `string`, το γράφουν **έξι**
  //    λεξιλόγια *(~180 τιμές μόνο από τα upload entry points)*, και η γενική
  //    διαδρομή τις γράφει **ωμές** χωρίς να περάσει από εδώ. Ο «φρουρός» ξέπλενε
  //    **μόνο** τη φωτογραφική πόρτα — και εκεί έχασε το `'logo'` του γραφείου, που
  //    αποθηκεύτηκε **ως πορτρέτο φυσικού προσώπου** *(μετρημένο σε πραγματικά
  //    δεδομένα: `wordmark-tight.png` → `purpose:'profile'`)*.
  //
  // ⚠️ Οι δύο άγκυρες ΗΤΑΝ ΑΝΤΙΦΑΤΙΚΕΣ: η `showcase-mark-purpose.test.ts` απαιτεί
  //    ο δηλωμένος σκοπός να **επιβιώνει**· αυτή απαιτούσε να **ξεπλένεται**.
  //    Δεν μπορούσαν να είναι και οι δύο πράσινες. Νίκησε αυτή που περιγράφει τι
  //    **ΘΕΛΕΙ** ο ζωντανός καλών, όχι τι **ΕΚΑΝΕ** η υλοποίηση.
  //
  // ⛔ Η αντικατάσταση δοκιμάζει την **ΚΛΑΣΗ**, όχι το δείγμα `'logo'`: κάθε
  //    δηλωμένος σκοπός, από **κάθε** πόρτα, επιβιώνει αυτούσιος.
  describe('🔴 ο δηλωμένος σκοπός επιβιώνει — η ΚΛΑΣΗ, όχι το δείγμα', () => {
    const DECLARED_ELSEWHERE = [
      'logo',            // useShowcaseMark · UPLOAD_PURPOSE · file-upload-config
      'representative',  // UPLOAD_PURPOSE · file-upload-config
      'avatar',          // file-upload-config · PhotoUploadPurpose
      'business-card',   // file-upload-config
      'document',        // file-upload-config · PhotoUploadPurpose
      'floorplan',       // file-upload-config · PhotoUploadPurpose
      'photo',           // defaultUploadHandler fallback · META_PHOTO_PURPOSES
      'id-document',     // UPLOAD_PURPOSE
      'title-deed',      // UploadEntryPoint (~180)
      'study-topographic',
    ] as const;

    it.each(DECLARED_ELSEWHERE)('«%s» επιβιώνει αυτούσιο', (declared) => {
      expect(resolvePhotoPurpose(declared)).toBe(declared);
    });

    it('κανένας δηλωμένος σκοπός δεν καταλήγει «profile»', () => {
      const washed = DECLARED_ELSEWHERE.filter((p) => resolvePhotoPurpose(p) === 'profile');
      expect(washed).toEqual([]);
    });
  });
});

