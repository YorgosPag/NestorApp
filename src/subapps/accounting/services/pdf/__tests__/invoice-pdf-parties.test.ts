/**
 * Τα μέρη του τιμολογίου στο PDF (ADR-ACC-018 §14 · ADR-ACC-003 §22.10).
 *
 * Το ερώτημα είναι **γεωμετρικό**: «πέφτει κείμενο πάνω σε κείμενο;» και «λείπει κομμάτι της διεύθυνσης;». Γι' αυτό
 * ο διπλός του jsPDF **καταγράφει** κάθε `text()` με τη θέση του, και μετρά πλάτος με σταθερό κανόνα (μέγεθος × 0,2mm
 * ανά χαρακτήρα), ώστε η αναδίπλωση να είναι ντετερμινιστική.
 *
 * ⚠️ Μεταλλάξεις που ΠΡΕΠΕΙ να κοκκινίζουν: αφαίρεσε το `maxWidth` από τον εκδότη ⇒ Κ1· ξαναβάλε το
 * `if (customer.address)` ⇒ Κ2· γύρνα το ύψος του πλαισίου σε σταθερό 22 ⇒ Κ5.
 */

import type jsPDF from 'jspdf';
import { makeInvoice } from '../../mydata/__tests__/mydata-fixtures';
import type { Invoice } from '../../../types';
import { drawCustomerSection, drawHeader } from '../invoice-pdf-parties';

interface TextCall { readonly text: string; readonly x: number; readonly y: number; readonly fontSize: number; readonly right: boolean }
interface RectCall { readonly h: number }

const CHAR_WIDTH_PER_PT = 0.2;

function fakePdf() {
  let fontSize = 10;
  const texts: TextCall[] = [];
  const rects: RectCall[] = [];
  const width = (text: string) => text.length * fontSize * CHAR_WIDTH_PER_PT;
  const wrap = (text: string, max: number): string[] => text.split('\n').flatMap((paragraph) => {
    const lines: string[] = [];
    let current = '';
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && width(candidate) > max) { lines.push(current); current = word; } else { current = candidate; }
    }
    return [...lines, current];
  });
  const pdf = {
    setFontSize: (size: number) => { fontSize = size; },
    getTextWidth: width,
    splitTextToSize: wrap,
    text: (text: string, x: number, y: number, opts?: { align?: string }) => {
      texts.push({ text, x, y, fontSize, right: opts?.align === 'right' });
    },
    roundedRect: (_x: number, _y: number, _w: number, h: number) => { rects.push({ h }); },
    setTextColor: () => undefined, setDrawColor: () => undefined, setLineWidth: () => undefined,
    line: () => undefined, addImage: () => undefined, addPage: () => undefined,
  };
  return { pdf: pdf as unknown as jsPDF, texts, rects, widthAt: (t: TextCall) => t.text.length * t.fontSize * CHAR_WIDTH_PER_PT };
}

const LONG_ACTIVITY = 'γενικός ανάδοχος κατασκευαστικών έργων/γενικός ανάδοχος κατασκευαστικών έργων';

function invoiceWith(overrides: Partial<Invoice>): Invoice {
  const base = makeInvoice();
  return { ...base, ...overrides, issuer: { ...base.issuer, ...overrides.issuer }, customer: { ...base.customer, ...overrides.customer } };
}

describe('Κ1 — κεφαλίδα: ο εκδότης ΔΕΝ μπαίνει στη δεξιά στήλη', () => {
  it('μακριά «Δραστηριότητα» αναδιπλώνεται και τελειώνει πριν από τη φαρδύτερη γραμμή της δεξιάς στήλης', () => {
    const { pdf, texts, widthAt } = fakePdf();
    drawHeader(pdf, invoiceWith({ type: 'service_invoice_eu', issuer: { ...makeInvoice().issuer, profession: LONG_ACTIVITY } }), null, 15);

    const right = texts.filter((t) => t.right);
    const rightStart = Math.min(...right.map((t) => t.x - widthAt(t)));
    const issuer = texts.filter((t) => !t.right);

    expect(issuer.length).toBeGreaterThan(5); // αναδιπλώθηκε: περισσότερες γραμμές από τα 5 πεδία (χωρίς στοιχεία επικοινωνίας)
    for (const line of issuer) expect(line.x + widthAt(line)).toBeLessThanOrEqual(rightStart);
  });
});

describe('Κ2/Κ3 — πελάτης: πλήρης διεύθυνση (ν. 4308/2014 άρθρο 9 §1 ε)', () => {
  it('χωρίς οδό: πόλη και Τ.Κ. ΔΕΝ χάνονται', () => {
    const { pdf, texts } = fakePdf();
    drawCustomerSection(pdf, invoiceWith({ customer: { ...makeInvoice().customer, address: null, city: 'München', postalCode: '80331', country: 'DE' } }), 40);
    expect(texts.map((t) => t.text)).toContain('München, 80331');
  });

  it('ελληνικός Τ.Κ. στην επίσημη γραφή «546 21»', () => {
    const { pdf, texts } = fakePdf();
    drawCustomerSection(pdf, invoiceWith({ customer: { ...makeInvoice().customer, address: 'Εγνατίας 1', city: 'Θεσσαλονίκη', postalCode: '54621', country: 'GR' } }), 40);
    expect(texts.map((t) => t.text)).toContain('Εγνατίας 1, Θεσσαλονίκη, 546 21');
  });
});

describe('Κ4 — χώρα: όνομα, ποτέ ωμός κωδικός', () => {
  it('DE ⇒ «Γερμανία / Germany»', () => {
    const { pdf, texts } = fakePdf();
    drawCustomerSection(pdf, invoiceWith({ customer: { ...makeInvoice().customer, country: 'DE' } }), 40);
    expect(texts.map((t) => t.text)).toContain('Χώρα / Country: Γερμανία / Germany');
  });

  it('GR ⇒ καμία γραμμή χώρας', () => {
    const { pdf, texts } = fakePdf();
    drawCustomerSection(pdf, invoiceWith({ customer: { ...makeInvoice().customer, country: 'GR' } }), 40);
    expect(texts.some((t) => t.text.startsWith('Χώρα / Country'))).toBe(false);
  });
});

describe('Κ5 — το πλαίσιο του πελάτη μεγαλώνει με το περιεχόμενο', () => {
  it('μακριά επωνυμία + διεύθυνση + email (≥5 γραμμές) ⇒ ύψος > 22mm, και η επόμενη ενότητα ξεκινά κάτω από το πλαίσιο', () => {
    const { pdf, rects } = fakePdf();
    const longName = 'Πολύ Μακριά Επωνυμία Ανώνυμης Εταιρείας Τεχνικών Έργων Και Ενεργειακών Εφαρμογών Βορείου Ελλάδος';
    const longAddress = 'Λεωφόρος Βασιλίσσης Όλγας 212 και Παπαναστασίου γωνία με Μητροπόλεως Κτίριο Β Τρίτος Όροφος';
    const next = drawCustomerSection(pdf, invoiceWith({
      customer: { ...makeInvoice().customer, name: longName, address: longAddress, email: 'logistirio@example.com' },
    }), 40);
    expect(rects[0].h).toBeGreaterThan(22);
    expect(next).toBeGreaterThanOrEqual(40 + 6 + rects[0].h);
  });
});
