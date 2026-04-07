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

  it('includes timestamp in the filename', () => {
    const before = Date.now();
    const result = generateUniqueFileName('photo.jpg');
    const after = Date.now();
    // Extract timestamp — it's between the base name and the unique ID
    const parts = result.split('_');
    const timestamps = parts.filter(p => /^\d{13}$/.test(p));
    expect(timestamps.length).toBe(1);
    const ts = Number(timestamps[0]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
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

  it('defaults to "profile" for invalid purpose string', () => {
    expect(resolvePhotoPurpose('invalid')).toBe('profile');
  });

  it('defaults to "profile" for empty string', () => {
    expect(resolvePhotoPurpose('')).toBe('profile');
  });
});

