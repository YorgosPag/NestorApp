/**
 * @jest-environment node
 *
 * Tests — Υπογραφή περιεχομένου (ADR-934 §5.2.2 Μ-β2)
 *
 * Κάθε δείγμα είναι τα **πραγματικά** πρώτα bytes της μορφής. Η άγκυρα κάλυψης κρατά τον πίνακα δεμένο στο μητρώο τύπων
 * και στο λεξιλόγιο του καταλόγου: νέα δεκτή κατάληξη χωρίς υπογραφή ⇒ κόκκινο.
 */

import { FILE_TYPE_REGISTRY, specByExt } from '@/config/file-types/classification-registry';
import { ASSET_KIND_FILE_CATEGORIES, assetKindAcceptsFile } from '@/subapps/catalog/vocabulary/asset-files';
import type { AssetKind } from '@/subapps/catalog/vocabulary/attribute-types';
import {
  CONTENT_SIGNATURE_FAMILIES,
  CONTENT_SIGNATURE_IDS,
  sniffContent,
  type ContentSignatureId,
} from '../content-signature';

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));
const bytes = (...parts: (string | readonly number[])[]): Uint8Array =>
  new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? ascii(part) : [...part])));
const text = (value: string): Uint8Array => new TextEncoder().encode(value);
const u32 = (value: number): number[] => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];

/** Κουτί `ftyp` με κύριο brand, minor 0 και συμβατά brands. */
const ftyp = (major: string, ...compatible: string[]): Uint8Array =>
  bytes(u32(16 + 4 * compatible.length), 'ftyp', major, [0, 0, 0, 0], ...compatible);

/** Κεφαλίδα EBML με `EBMLVersion = 1` και `DocType`. */
function ebml(docType: string): Uint8Array {
  const body = [0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x80 | docType.length, ...ascii(docType)];
  return bytes([0x1a, 0x45, 0xdf, 0xa3, 0x80 | body.length], body);
}

const sfnt = (tag: string | readonly number[], tables: number): Uint8Array => bytes(tag, [tables >> 8, tables & 0xff], [0, 0, 0, 0, 0, 0]);

const idOf = (head: Uint8Array, declaredExt?: string): ContentSignatureId | 'html' | null => {
  const sniffed = sniffContent(head, declaredExt);
  return sniffed === null || sniffed === 'html' ? sniffed : sniffed.id;
};

describe('δυαδικές υπογραφές', () => {
  it.each<[string, Uint8Array, ContentSignatureId, string, string]>([
    ['PDF', bytes('%PDF-1.7\n'), 'pdf', 'pdf', 'application/pdf'],
    ['PNG', bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), 'png', 'png', 'image/png'],
    ['JPEG', bytes([0xff, 0xd8, 0xff, 0xe0]), 'jpeg', 'jpg', 'image/jpeg'],
    ['GIF89a', bytes('GIF89a'), 'gif', 'gif', 'image/gif'],
    ['GIF87a', bytes('GIF87a'), 'gif', 'gif', 'image/gif'],
    ['WebP', bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '), 'webp', 'webp', 'image/webp'],
    ['TIFF (II)', bytes([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]), 'tiff', 'tif', 'image/tiff'],
    ['TIFF (MM)', bytes([0x4d, 0x4d, 0x00, 0x2a]), 'tiff', 'tif', 'image/tiff'],
    ['BigTIFF', bytes([0x49, 0x49, 0x2b, 0x00]), 'tiff', 'tif', 'image/tiff'],
    ['AVIF', ftyp('avif', 'mif1', 'miaf'), 'avif', 'avif', 'image/avif'],
    ['AVIF με κύριο mif1', ftyp('mif1', 'avif', 'miaf'), 'avif', 'avif', 'image/avif'],
    ['OpenType (CFF)', sfnt('OTTO', 12), 'otf', 'otf', 'font/otf'],
    ['TrueType', sfnt([0, 1, 0, 0], 16), 'ttf', 'ttf', 'font/ttf'],
    ['TrueType (Apple)', sfnt('true', 9), 'ttf', 'ttf', 'font/ttf'],
    ['MP4', ftyp('isom', 'isom', 'iso2', 'avc1', 'mp41'), 'mp4', 'mp4', 'video/mp4'],
    ['MP4 (mp42)', ftyp('mp42', 'mp42', 'isom'), 'mp4', 'mp4', 'video/mp4'],
    ['QuickTime', ftyp('qt  ', 'qt  '), 'mov', 'mov', 'video/quicktime'],
    ['QuickTime χωρίς ftyp', bytes(u32(1024), 'moov'), 'mov', 'mov', 'video/quicktime'],
    ['WebM', ebml('webm'), 'webm', 'webm', 'video/webm'],
    ['Matroska', ebml('matroska'), 'mkv', 'mkv', 'video/x-matroska'],
    ['ZIP', bytes('PK', [3, 4, 20, 0]), 'zip', 'zip', 'application/zip'],
  ])('%s', (_name, head, id, ext, contentType) => {
    expect(sniffContent(head)).toEqual({ id, ext, contentType });
  });

  it('η δηλωμένη κατάληξη διαλέγει μέσα στην οικογένεια (`.jpeg` μένει `.jpeg`, `.tiff` μένει `.tiff`)', () => {
    expect(sniffContent(bytes([0xff, 0xd8, 0xff]), 'JPEG')).toMatchObject({ ext: 'jpeg', contentType: 'image/jpeg' });
    expect(sniffContent(bytes([0x49, 0x49, 0x2a, 0x00]), '.tiff')).toMatchObject({ ext: 'tiff' });
  });

  it('🔑 η δηλωμένη κατάληξη ΔΕΝ κάνει τα bytes κάτι άλλο: PNG με `.jpg` είναι PNG', () => {
    expect(sniffContent(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'jpg')).toMatchObject({ id: 'png', ext: 'png' });
  });

  it('OLE2: η κατάληξη διαλέγει (RFA · DOC)· χωρίς δήλωση ⇒ άγνωστο, ποτέ μαντεμένο RFA', () => {
    const ole2 = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(sniffContent(ole2, 'rfa')).toEqual({ id: 'ole2', ext: 'rfa', contentType: 'application/octet-stream' });
    expect(sniffContent(ole2, 'doc')).toEqual({ id: 'ole2', ext: 'doc', contentType: 'application/msword' });
    expect(sniffContent(ole2)).toBeNull();
    expect(sniffContent(ole2, 'pdf')).toBeNull();
  });

  it('ZIP: `.docx` μέσα στην οικογένεια· `.pdf` δεν κάνει PDF ένα ZIP', () => {
    const zip = bytes('PK', [3, 4]);
    expect(sniffContent(zip, 'docx')).toMatchObject({ id: 'zip', ext: 'docx' });
    expect(sniffContent(zip, 'pdf')).toMatchObject({ id: 'zip', ext: 'zip' });
  });

  it('ήχος σε περιέκτη MP4 δεν είναι βίντεο · HEIC δεν το ξέρει το μητρώο', () => {
    expect(idOf(ftyp('M4A ', 'M4A ', 'mp42', 'isom'))).toBeNull();
    expect(idOf(ftyp('heic', 'mif1', 'heic'))).toBeNull();
  });

  it('γραμματοσειρά με αδύνατο αριθμό πινάκων δεν είναι γραμματοσειρά', () => {
    expect(idOf(sfnt('OTTO', 0))).toBeNull();
    expect(idOf(sfnt([0, 1, 0, 0], 5000))).toBeNull();
  });

  it('EBML άλλου DocType ⇒ άγνωστο', () => {
    expect(idOf(ebml('other'))).toBeNull();
  });
});

describe('σελίδα HTML (WHATWG MIME Sniffing §7.1)', () => {
  it.each([
    ['<!DOCTYPE html><html><body>Sign in</body></html>'],
    ['  \r\n<HTML lang="el">'],
    ['﻿<html>'],
    ['<?xml version="1.0"?>\n<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "x">\n<html xmlns="http://www.w3.org/1999/xhtml">'],
    ['<!-- error page --><p>Not found</p>'],
    ['<head><title>404</title></head>'],
    ['<html\n  lang="en">'],
  ])('%j ⇒ html', (page) => {
    expect(sniffContent(text(page))).toBe('html');
  });

  it('πρότυπο χωρίς byte τερματισμού δεν είναι HTML (`<abbr` ≠ `<a`)', () => {
    expect(sniffContent(text('<abbreviations/>'))).toBeNull();
  });

  it('🔑 HTML με κατάληξη `.pdf` είναι πάλι HTML', () => {
    expect(sniffContent(text('<!doctype html><title>Login</title>'), 'pdf')).toBe('html');
  });
});

describe('SVG', () => {
  it.each([
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>'],
    ['<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: Illustrator -->\n<svg version="1.1">'],
    ['<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg>'],
    ['<!DOCTYPE svg [ <!ENTITY a "<b>"> ]>\n<svg>'],
    ['<svg:svg xmlns:svg="http://www.w3.org/2000/svg">'],
  ])('%j ⇒ svg', (svg) => {
    expect(sniffContent(text(svg))).toEqual({ id: 'svg', ext: 'svg', contentType: 'image/svg+xml' });
  });

  it('XML άλλου ριζικού στοιχείου (σφάλμα S3) δεν είναι εικόνα', () => {
    expect(sniffContent(text('<?xml version="1.0"?><Error><Code>AccessDenied</Code></Error>'))).toBeNull();
  });

  it('προοίμιο που δεν κλείνει μέσα στα bytes ⇒ δεν μαντεύουμε', () => {
    expect(sniffContent(text('<?xml version="1.0"'))).toBeNull();
  });
});

describe('IFC (STEP + FILE_SCHEMA)', () => {
  const step = (schema: string): string => `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_SCHEMA(('${schema}'));\nENDSEC;`;

  it('σχήμα IFC4 / IFC2X3 ⇒ ifc', () => {
    expect(sniffContent(text(step('IFC4')))).toEqual({ id: 'ifc', ext: 'ifc', contentType: 'application/x-step' });
    expect(idOf(text(step('IFC2X3')))).toBe('ifc');
  });

  it('🔑 STEP μηχανολογικού σχεδίου (AP214) δεν είναι μοντέλο κτιρίου, ούτε με `.ifc`', () => {
    expect(sniffContent(text(step('AUTOMOTIVE_DESIGN')), 'ifc')).toBeNull();
  });

  it('χωρίς ορατό σχήμα: αποφασίζει η δηλωμένη κατάληξη', () => {
    expect(idOf(text('ISO-10303-21;\nHEADER;'), 'ifc')).toBe('ifc');
    expect(idOf(text('ISO-10303-21;\nHEADER;'))).toBeNull();
  });
});

describe('PDF με σκουπίδια μπροστά · άγνωστο', () => {
  it('κεφαλίδα ως το byte 1024 ⇒ pdf · πιο πέρα ⇒ άγνωστο', () => {
    expect(idOf(bytes(new Array(500).fill(0x20), '%PDF-1.4'))).toBe('pdf');
    expect(idOf(bytes(new Array(2000).fill(0x41), '%PDF-1.4'))).toBeNull();
  });

  it.each([['hello world'], ['{"error":"not found"}'], ['']])('%j ⇒ null', (value) => {
    expect(sniffContent(text(value))).toBeNull();
  });
});

describe('🔑 άγκυρα κάλυψης — ο πίνακας δεμένος στο μητρώο και στον κατάλογο', () => {
  const families = Object.values(CONTENT_SIGNATURE_FAMILIES);
  const signedExtensions = new Set(families.flatMap((family) => family.extensions));

  it('κάθε κατάληξη του μητρώου που δέχεται κάποιο είδος μέσου έχει υπογραφή', () => {
    const accepted = new Set(Object.values(ASSET_KIND_FILE_CATEGORIES).flat());
    const unsigned = FILE_TYPE_REGISTRY.filter((spec) => accepted.has(spec.category))
      .flatMap((spec) => spec.extensions)
      .filter((ext) => !signedExtensions.has(ext));
    expect(unsigned).toEqual([]);
  });

  it('κάθε κατάληξη του πίνακα είναι του μητρώου — εκτός από το βίντεο, που δηλώνει MIME `video/*`', () => {
    for (const family of families) {
      if (family.videoMime !== undefined) {
        expect(family.videoMime.startsWith('video/')).toBe(true);
        continue;
      }
      expect(family.extensions.filter((ext) => specByExt(ext) === null)).toEqual([]);
    }
  });

  it('η κατάληξη «χωρίς δήλωση» είναι της οικογένειας (ή `null`)', () => {
    for (const family of families) {
      if (family.undeclared !== null) expect(family.extensions).toContain(family.undeclared);
    }
  });

  it('ο πίνακας έχει γραμμή για κάθε υπογραφή, και τίποτα άλλο', () => {
    expect(Object.keys(CONTENT_SIGNATURE_FAMILIES).sort()).toEqual([...CONTENT_SIGNATURE_IDS].sort());
  });

  it.each<[AssetKind, Uint8Array]>([
    ['image', bytes([0xff, 0xd8, 0xff])],
    ['document', bytes('%PDF-1.7')],
    ['bim', text("ISO-10303-21;\nFILE_SCHEMA(('IFC4'));")],
    ['video', ftyp('isom', 'isom')],
    ['font', sfnt('OTTO', 10)],
  ])('ό,τι βγάζει η ανίχνευση για «%s» το δέχεται το `assetKindAcceptsFile`', (kind, head) => {
    const sniffed = sniffContent(head);
    if (sniffed === null || sniffed === 'html') throw new Error('αναμενόταν υπογραφή');
    expect(assetKindAcceptsFile(kind, sniffed)).toBe('accepted');
  });
});
