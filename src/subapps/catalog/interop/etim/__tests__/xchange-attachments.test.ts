/**
 * Συνημμένα ETIM xChange ⇒ μέσα της γραμμής (ADR-934 §5.2 Μ-α): ο πίνακας ATX → ρόλος απέναντι στο **επίσημο** σχήμα 2.0,
 * το διπλό επίπεδο τύπου/λεπτομέρειας, και ότι ό,τι δεν γίνεται μέσο μετριέται — ποτέ σιωπηλά.
 */

import { ASSET_ROLE_KINDS } from '../../../vocabulary/asset-roles';
import { attachmentOutcomeOf, ETIM_ATTACHMENT_OUTCOME, ETIM_ATTACHMENT_TYPES } from '../../../vocabulary/etim-attachments';
import { AttachmentTally, assetsOfProduct } from '../xchange-attachments';
import { readXChangeDocument, type XChangeProduct } from '../xchange-document';
import schema20 from './fixtures/xchange-2.0.schema.json';

type Entry = Record<string, unknown>;

/** Τα enum `AttachmentType` του σχήματος, όπου κι αν βρίσκονται (προϊόν · είδος · προμηθευτής). */
function attachmentEnums(node: unknown, found: string[][] = []): string[][] {
  if (Array.isArray(node)) node.forEach((child) => attachmentEnums(child, found));
  else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      const values = (value as { enum?: unknown }).enum;
      if (key === 'AttachmentType' && Array.isArray(values)) found.push(values.map(String));
      attachmentEnums(value, found);
    }
  }
  return found;
}

const productOf = (product: Entry = {}, item: Entry = {}): Entry => ({
  ProductIdentification: { ManufacturerProductNumber: 'M-1' },
  TradeItem: [{ ItemIdentification: { SupplierItemNumber: 'S-1' }, ...item }],
  ...product,
});

function readProduct(product: Entry): XChangeProduct {
  const view = readXChangeDocument(JSON.stringify({ CatalogueId: 'c1', Supplier: [{ Product: [product] }] }));
  if (view === null || view.products[0] === undefined) throw new Error('not an xChange document');
  return view.products[0];
}

function assetsOf(product: Entry) {
  const tally = new AttachmentTally();
  const assets = assetsOfProduct(readProduct(product), tally);
  return { assets, report: tally.build() };
}

const detail = (uri: string, extra: Entry = {}): Entry => ({ AttachmentUri: uri, ...extra });

describe('πίνακας ATX → ρόλος', () => {
  it('καλύπτει ΑΚΡΙΒΩΣ το enum AttachmentType του επίσημου σχήματος 2.0 (προϊόν και είδος)', () => {
    const [product, ...rest] = attachmentEnums(schema20).filter((values) => values.includes('ATX002'));
    expect(product).toBeDefined();
    for (const other of rest) expect([...other].sort()).toEqual([...(product ?? [])].sort());
    expect([...ETIM_ATTACHMENT_TYPES].sort()).toEqual([...(product ?? [])].sort());
  });

  it('κάθε κωδικός του προμηθευτή είναι γνωστός στον πίνακα', () => {
    const supplier = attachmentEnums(schema20).find((values) => !values.includes('ATX002'));
    expect(supplier).toBeDefined();
    for (const code of supplier ?? []) expect(ETIM_ATTACHMENT_TYPES).toContain(code);
  });

  it('η αντιστοίχιση ΔΕΝ είναι η μετατοπισμένη του PDF', () => {
    expect(ETIM_ATTACHMENT_OUTCOME.ATX004).toEqual({ kind: 'asset', role: 'declaration' });
    expect(ETIM_ATTACHMENT_OUTCOME.ATX012).toEqual({ kind: 'asset', role: 'energyLabel' });
    expect(ETIM_ATTACHMENT_OUTCOME.ATX015).toEqual({ kind: 'asset', role: 'photo' });
    expect(ETIM_ATTACHMENT_OUTCOME.ATX019).toEqual({ kind: 'asset', role: 'safetyDataSheet' });
    expect(ETIM_ATTACHMENT_OUTCOME.ATX023).toEqual({ kind: 'unsupported' });
    expect(ETIM_ATTACHMENT_OUTCOME.ATX024).toEqual({ kind: 'link' });
  });

  it('κάθε ρόλος-στόχος δέχεται τουλάχιστον ένα είδος αρχείου', () => {
    for (const outcome of Object.values(ETIM_ATTACHMENT_OUTCOME)) {
      if (outcome.kind === 'asset') expect(ASSET_ROLE_KINDS[outcome.role].length).toBeGreaterThan(0);
    }
  });

  it('άγνωστος κωδικός ⇒ unsupported, όχι σφάλμα', () => {
    expect(attachmentOutcomeOf('ATX777')).toEqual({ kind: 'unsupported' });
  });
});

describe('συνημμένα ⇒ μέσα', () => {
  it('ένας τύπος, δύο λεπτομέρειες (μία ανά γλώσσα) ⇒ δύο μέσα, με σειρά, γλώσσες και ημερομηνίες', () => {
    const { assets, report } = assetsOf(productOf({
      ProductAttachments: [{
        AttachmentType: 'ATX019',
        AttachmentOrder: 1,
        AttachmentDetails: [
          detail('https://Cdn.Example.com/sds-el.pdf#page=2', { AttachmentLanguage: ['el-GR'], AttachmentFilename: 'sds-el.pdf', AttachmentIssueDate: '2026-03-01' }),
          detail('https://cdn.example.com/sds-en.pdf', { AttachmentLanguage: ['en-GB', 'en-GB'], AttachmentExpiryDate: '2030-12-31' }),
        ],
      }],
    }));
    expect(assets).toEqual([
      { uri: 'https://cdn.example.com/sds-el.pdf', role: 'safetyDataSheet', order: 1, filename: 'sds-el.pdf', languages: ['el-GR'], issuedOn: '2026-03-01', expiresOn: null, atx: 'ATX019' },
      { uri: 'https://cdn.example.com/sds-en.pdf', role: 'safetyDataSheet', order: 1, filename: null, languages: ['en-GB'], issuedOn: null, expiresOn: '2030-12-31', atx: 'ATX019' },
    ]);
    expect(report.assets).toBe(2);
  });

  it('συνημμένα του πρώτου είδους μετρούν, χωρίς σειρά· ίδιο (ρόλος, URI) ⇒ ένα μέσο', () => {
    const photo = { AttachmentType: 'ATX018', AttachmentDetails: [detail('https://x.example/p.jpg')] };
    const { assets } = assetsOf(productOf({ ProductAttachments: [{ ...photo, AttachmentOrder: 2 }] }, { ItemAttachments: [photo, { AttachmentType: 'ATX011', AttachmentDetails: [detail('https://x.example/d.pdf')] }] }));
    expect(assets.map((asset) => [asset.role, asset.uri, asset.order])).toEqual([
      ['photo', 'https://x.example/p.jpg', 2],
      ['drawing', 'https://x.example/d.pdf', null],
    ]);
  });

  it('σύνδεσμος · τύπος χωρίς ρόλο · μικρογραφία · διεύθυνση που δεν κατεβαίνει · άκυρη ημερομηνία ⇒ μετριούνται', () => {
    const { assets, report } = assetsOf(productOf({
      ProductAttachments: [
        { AttachmentType: 'ATX024', AttachmentDetails: [detail('https://supplier.example/product/1')] },
        { AttachmentType: 'ATX021', AttachmentDetails: [detail('https://x.example/w.pdf')] },
        { AttachmentType: 'ATX099', AttachmentDetails: [detail('https://x.example/o.pdf')] },
        { AttachmentType: 'ATX015', AttachmentTypeSpecification: 'MDX048', AttachmentDetails: [detail('https://x.example/t.jpg')] },
        { AttachmentType: 'ATX003', AttachmentDetails: [detail('datasheets/a.pdf'), detail('ftp://x.example/a.pdf'), {}] },
        { AttachmentType: 'ATX001', AttachmentDetails: [detail('https://x.example/c.pdf', { AttachmentExpiryDate: '31/12/2030' })] },
      ],
    }));
    expect(assets.map((asset) => [asset.role, asset.expiresOn])).toEqual([['certificate', null]]);
    expect(report).toEqual({ assets: 1, links: 1, unsupportedTypes: ['ATX021', 'ATX099'], thumbnails: 1, unreachableUris: 3, invalidDates: 1, unreadable: 0 });
  });

  it('στραβό συνημμένο δεν παίρνει μαζί του τα σωστά, και δεν ρίχνει το έγγραφο', () => {
    const { assets, report } = assetsOf(productOf({
      ProductAttachments: [{ AttachmentDetails: [detail('https://x.example/a.pdf')] }, 'όχι αντικείμενο', { AttachmentType: 'ATX016', AttachmentDetails: [detail('https://x.example/m.pdf')] }],
    }));
    expect(assets.map((asset) => asset.role)).toEqual(['manual']);
    expect(report.unreadable).toBe(2);
  });

  it('συνημμένα που δεν είναι λίστα ⇒ κενά, το έγγραφο διαβάζεται', () => {
    const { assets, report } = assetsOf(productOf({ ProductAttachments: 'όχι λίστα' }));
    expect(assets).toEqual([]);
    expect(report.assets).toBe(0);
  });
});
