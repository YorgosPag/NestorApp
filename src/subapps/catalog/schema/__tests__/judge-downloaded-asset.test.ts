/**
 * @jest-environment node
 *
 * Tests — Κρίση μέσου που κατέβηκε από διεύθυνση (ADR-934 §5.2.2 Μ-β2)
 */

import { assetFetchFailureOf, ASSET_FETCH_FAILURES } from '../../vocabulary/asset-fetch';
import { CATALOG_ASSET_MAX_BYTES } from '../../vocabulary/asset-files';
import {
  downloadByteLimitFor,
  judgeDownloadedContent,
  judgeDownloadedSize,
  type DownloadedAssetHead,
} from '../judge-downloaded-asset';

const PDF = new TextEncoder().encode('%PDF-1.7\n');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HTML = new TextEncoder().encode('<!DOCTYPE html><title>Sign in</title>');
const IFC = new TextEncoder().encode("ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;");
const OLE2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const MIB = 1024 * 1024;

const facts = (overrides: Partial<DownloadedAssetHead>): DownloadedAssetHead => ({
  role: 'datasheet',
  head: PDF,
  uri: 'https://cdn.example/files/sheet.pdf',
  filename: null,
  contentType: 'application/pdf',
  ...overrides,
});

describe('judgeDownloadedContent', () => {
  it('φύλλο δεδομένων PDF ⇒ δεκτό, είδος έγγραφο', () => {
    expect(judgeDownloadedContent(facts({}))).toEqual({
      ok: true,
      kind: 'document',
      signature: { id: 'pdf', ext: 'pdf', contentType: 'application/pdf' },
    });
  });

  it('σελίδα σύνδεσης με 200 ⇒ notAFile, όποια κατάληξη κι αν λέει η διεύθυνση', () => {
    expect(judgeDownloadedContent(facts({ head: HTML, contentType: 'text/html' }))).toEqual({ ok: false, failure: 'notAFile' });
  });

  it('bytes που δεν αναγνωρίζονται ⇒ unknownContent', () => {
    expect(judgeDownloadedContent(facts({ head: new TextEncoder().encode('hello') }))).toEqual({ ok: false, failure: 'unknownContent' });
  });

  it('PNG στον ρόλο φύλλου δεδομένων ⇒ kindMismatch', () => {
    const verdict = judgeDownloadedContent(facts({ head: PNG, uri: 'https://cdn.example/a', contentType: 'image/png' }));
    expect(verdict).toEqual({ ok: false, failure: 'kindMismatch' });
  });

  it('σχέδιο (εικόνα | έγγραφο): το περιεχόμενο διαλέγει το είδος', () => {
    expect(judgeDownloadedContent(facts({ role: 'drawing', head: PNG, uri: 'https://cdn.example/d.png', contentType: null }))).toMatchObject({ ok: true, kind: 'image' });
    expect(judgeDownloadedContent(facts({ role: 'drawing' }))).toMatchObject({ ok: true, kind: 'document' });
  });

  it('🔑 PNG με κατάληξη `.jpg` ⇒ ίδια οικογένεια, δεκτό ως PNG (το περιεχόμενο γράφει τον τύπο)', () => {
    const verdict = judgeDownloadedContent(facts({ role: 'photo', head: PNG, uri: 'https://cdn.example/p.jpg', contentType: 'image/jpeg' }));
    expect(verdict).toMatchObject({ ok: true, kind: 'image', signature: { ext: 'png', contentType: 'image/png' } });
  });

  it('PDF με κατάληξη `.jpg` ⇒ typeConflict', () => {
    expect(judgeDownloadedContent(facts({ uri: 'https://cdn.example/sheet.jpg', contentType: null }))).toEqual({ ok: false, failure: 'typeConflict' });
  });

  it('PDF με `Content-Type: image/jpeg` ⇒ typeConflict', () => {
    expect(judgeDownloadedContent(facts({ contentType: 'image/jpeg' }))).toEqual({ ok: false, failure: 'typeConflict' });
  });

  it('το `AttachmentFilename` μετρά ως δήλωση', () => {
    expect(judgeDownloadedContent(facts({ uri: 'https://cdn.example/download?id=7', filename: 'photo.png', contentType: null }))).toEqual({ ok: false, failure: 'typeConflict' });
  });

  it.each([['application/octet-stream'], ['binary/octet-stream'], ['text/plain; charset=utf-8'], [null], ['']])(
    '🔑 IFC με `Content-Type: %s` ⇒ δεκτό (δήλωση που δεν δεσμεύει)',
    (contentType) => {
      const verdict = judgeDownloadedContent(facts({ role: 'bim', head: IFC, uri: 'https://cdn.example/m.ifc', contentType }));
      expect(verdict).toMatchObject({ ok: true, kind: 'bim', signature: { ext: 'ifc' } });
    },
  );

  it('SVG ως `text/xml` και διεύθυνση `.php` ⇒ δεκτό', () => {
    const svg = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>');
    const verdict = judgeDownloadedContent(facts({ role: 'logo', head: svg, uri: 'https://cdn.example/logo.php?x=1', contentType: 'text/xml' }));
    expect(verdict).toMatchObject({ ok: true, kind: 'image', signature: { ext: 'svg' } });
  });

  it('οικογένεια RFA: η κατάληξη της διεύθυνσης διαλέγει μέσα στο OLE2', () => {
    const verdict = judgeDownloadedContent(facts({ role: 'bim', head: OLE2, uri: 'https://cdn.example/family.rfa', contentType: null }));
    expect(verdict).toEqual({ ok: true, kind: 'bim', signature: { id: 'ole2', ext: 'rfa', contentType: 'application/octet-stream' } });
  });

  it('OLE2 χωρίς δήλωση ⇒ unknownContent (δεν μαντεύουμε RFA)', () => {
    expect(judgeDownloadedContent(facts({ role: 'bim', head: OLE2, uri: 'https://cdn.example/get?id=1', contentType: null }))).toEqual({ ok: false, failure: 'unknownContent' });
  });

  it('OLE2 με `.doc` στον ρόλο BIM ⇒ kindMismatch (αναγνωρίσιμο Word, όχι μοντέλο)', () => {
    expect(judgeDownloadedContent(facts({ role: 'bim', head: OLE2, uri: 'https://cdn.example/spec.doc', contentType: null }))).toEqual({ ok: false, failure: 'kindMismatch' });
  });
});

describe('judgeDownloadedSize', () => {
  const accepted = { kind: 'document' as const, signature: { id: 'pdf' as const, ext: 'pdf', contentType: 'application/pdf' } };

  it('μέσα στο όριο ⇒ null', () => {
    expect(judgeDownloadedSize(accepted, 2 * MIB)).toBeNull();
  });

  it('πάνω από το όριο του είδους ⇒ tooLarge, με το όριο', () => {
    expect(judgeDownloadedSize(accepted, CATALOG_ASSET_MAX_BYTES.document + 1)).toEqual({ ok: false, failure: 'tooLarge', params: { maxMb: 100 } });
  });
});

describe('downloadByteLimitFor', () => {
  it('το όριο της ροής = το μεγαλύτερο όριο των ειδών του ρόλου', () => {
    expect(downloadByteLimitFor('datasheet')).toBe(CATALOG_ASSET_MAX_BYTES.document);
    expect(downloadByteLimitFor('drawing')).toBe(Math.max(CATALOG_ASSET_MAX_BYTES.image, CATALOG_ASSET_MAX_BYTES.document));
    expect(downloadByteLimitFor('bim')).toBe(CATALOG_ASSET_MAX_BYTES.bim);
  });
});

describe('assetFetchFailureOf — απορρίψεις του φρουρού', () => {
  it.each<[Parameters<typeof assetFetchFailureOf>[0], number | null, string]>([
    ['http_error', 404, 'notFound'],
    ['http_error', 410, 'notFound'],
    ['http_error', 500, 'httpError'],
    ['http_error', null, 'httpError'],
    ['address_not_public', null, 'notPublic'],
    ['dns_failed', null, 'dnsFailed'],
    ['too_large', 200, 'tooLarge'],
    ['timeout', null, 'timeout'],
    ['too_many_redirects', null, 'tooManyRedirects'],
    ['scheme_not_https', null, 'invalidUri'],
    ['credentials_in_url', null, 'invalidUri'],
  ])('%s (%s) ⇒ %s', (rejection, status, failure) => {
    expect(assetFetchFailureOf(rejection, status)).toBe(failure);
  });

  it('κάθε κωδικός που βγαίνει ανήκει στο κλειστό λεξιλόγιο', () => {
    expect(ASSET_FETCH_FAILURES).toContain(assetFetchFailureOf('malformed', null));
  });
});
