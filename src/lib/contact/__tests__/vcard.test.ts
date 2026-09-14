/**
 * ADR-841 §7 Α21.17 — «Αποθήκευση επαφής»: vCard 3.0 που δεν σπάει τα ελληνικά.
 */

import { buildVCard, escapeVCardText, foldVCardLine, vcardFileName, type VCardOrganisation } from '../vcard';
import { showcaseLocationVCard } from '@/lib/agency/showcase-vcard';

const CARD: VCardOrganisation = {
  organisation: 'ΒΑΦΕΣ ΠΑΓΩΝΗ',
  unit: null,
  phones: [{ e164: '+302310123456', extension: null }],
  emails: ['office@vafes.gr'],
  address: { streetLine: 'Τσιμισκή, 12', postalCode: '54624' },
  urls: ['https://www.vafes.gr/', 'https://nestorconstruct.gr/pro/vafes-pagoni'],
};

const octets = (text: string): number => Buffer.byteLength(text, 'utf8');

describe('buildVCard', () => {
  it('3.0, CRLF παντού, αρχή και τέλος', () => {
    const out = buildVCard(CARD);
    expect(out.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(out.endsWith('END:VCARD\r\n')).toBe(true);
    expect(out.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('επαφή ΟΡΓΑΝΙΣΜΟΥ: X-ABShowAs, κενό N, ORG με κατάστημα', () => {
    const out = buildVCard({ ...CARD, unit: 'Καλαμαριά' });
    expect(out).toContain('\r\nN:;;;;\r\n');
    expect(out).toContain('\r\nX-ABShowAs:COMPANY\r\n');
    expect(out).toContain('\r\nORG:ΒΑΦΕΣ ΠΑΓΩΝΗ;Καλαμαριά\r\n');
    expect(out).toContain('\r\nFN:ΒΑΦΕΣ ΠΑΓΩΝΗ — Καλαμαριά\r\n');
  });

  it('τηλέφωνο E.164, εσωτερικό ως παύση κλήσης, email, διεύθυνση, URL', () => {
    const out = buildVCard({ ...CARD, phones: [{ e164: '+302310123456', extension: '12' }] });
    expect(out).toContain('\r\nTEL;TYPE=WORK,VOICE:+302310123456,12\r\n');
    expect(out).toContain('\r\nEMAIL;TYPE=INTERNET,WORK:office@vafes.gr\r\n');
    expect(out).toContain('\r\nADR;TYPE=WORK:;;Τσιμισκή\\, 12;;;54624;\r\n');
    expect(out).toContain('\r\nURL:https://www.vafes.gr/\r\nURL:https://nestorconstruct.gr/pro/vafes-pagoni\r\n');
  });

  it('🔴 «μόνο περιοχή» ⇒ ΚΑΜΙΑ γραμμή ADR', () => {
    expect(buildVCard({ ...CARD, address: null })).not.toContain('ADR');
  });
});

describe('escapeVCardText', () => {
  it('🔴 «;» «,» «\\» και αλλαγή γραμμής — αλλιώς μία επωνυμία γίνεται πολλές τιμές', () => {
    expect(escapeVCardText('ΑΦΟΙ; Α, Β\\ Γ\nΔ')).toBe('ΑΦΟΙ\\; Α\\, Β\\\\ Γ\\nΔ');
  });
});

describe('foldVCardLine', () => {
  const line = `ORG:${'Ελληνική Τεχνική Εταιρεία Κατασκευών και Ανάπτυξης Ακινήτων '.repeat(3)}`;

  it('🔴 κάθε φυσική γραμμή ≤ 75 OCTETS (όχι χαρακτήρες)', () => {
    for (const physical of foldVCardLine(line).split('\r\n')) expect(octets(physical)).toBeLessThanOrEqual(75);
  });

  it('🔴 ποτέ κοπή στη μέση ελληνικού γράμματος — και η ξεδίπλωση δίνει το αρχικό', () => {
    const physicals = foldVCardLine(line).split('\r\n');
    for (const physical of physicals) {
      expect(Buffer.from(physical, 'utf8').toString('utf8')).not.toContain('�');
    }
    expect(foldVCardLine(line).replace(/\r\n /g, '')).toBe(line);
  });

  it('σύντομη γραμμή μένει ως έχει', () => {
    expect(foldVCardLine('VERSION:3.0')).toBe('VERSION:3.0');
  });
});

describe('vcardFileName', () => {
  it('επωνυμία και κατάστημα, χωρίς χαρακτήρες που αρνείται το σύστημα αρχείων', () => {
    expect(vcardFileName({ organisation: 'ΒΑΦΕΣ/ΠΑΓΩΝΗ', unit: 'Κέντρο' })).toBe('ΒΑΦΕΣ ΠΑΓΩΝΗ - Κέντρο.vcf');
  });

  it('🔑 στίξη που επιτρέπεται ΜΕΝΕΙ («&», «,», «.»)', () => {
    expect(vcardFileName({ organisation: 'ΑΦΟΙ Α & Β, Ο.Ε.', unit: null })).toBe('ΑΦΟΙ Α & Β, Ο.Ε..vcf');
  });

  it('κενό ⇒ «contact.vcf», ποτέ «.vcf»', () => {
    expect(vcardFileName({ organisation: ' / ', unit: null })).toBe('contact.vcf');
  });
});

describe('showcaseLocationVCard', () => {
  const channels = { phones: [{ e164: '+302310123456', extension: null }], emails: [] };

  it('οδός που ΔΕΝ δημοσιεύτηκε ⇒ καμία διεύθυνση· χωρίς ιστοσελίδα και διεύθυνση βιτρίνας ⇒ κανένα URL', () => {
    const card = showcaseLocationVCard({ displayName: 'Α', website: null }, { label: null, street: null }, channels, null);
    expect(card.address).toBeNull();
    expect(card.urls).toEqual([]);
  });

  it('η ετικέτα γίνεται τμήμα· URL: πρώτα η ιστοσελίδα, μετά η βιτρίνα', () => {
    const card = showcaseLocationVCard(
      { displayName: 'Α', website: 'https://www.vafes.gr/' },
      { label: 'Καλαμαριά', street: { street: 'Τσιμισκή', number: '12', postalCode: '54624' } },
      channels,
      'https://x.gr/pro/a',
    );
    expect(card).toMatchObject({
      unit: 'Καλαμαριά',
      address: { streetLine: 'Τσιμισκή, 12', postalCode: '54624' },
      urls: ['https://www.vafes.gr/', 'https://x.gr/pro/a'],
    });
  });
});
