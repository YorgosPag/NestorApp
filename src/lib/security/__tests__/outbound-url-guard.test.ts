/**
 * Tests — Outbound URL Guard (ADR-738)
 *
 * Ο φύλακας υπάρχει για **έναν** λόγο: ο server χτυπά URL που έδωσε ανώνυμος
 * καλών. Κάθε τεστ εδώ περιγράφει μια συγκεκριμένη διαδρομή που ένας
 * επιτιθέμενος θα δοκίμαζε, όχι μια αφηρημένη «περίπτωση».
 */

import {
  isPublicAddress,
  validateOutboundUrlSyntax,
  validateOutboundUrl,
} from '../outbound-url-guard';

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

import { lookup } from 'node:dns/promises';

const mockLookup = lookup as unknown as jest.Mock;

describe('isPublicAddress — IPv4', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.1.2.3', 'private class A'],
    ['172.16.0.1', 'private class B, low edge'],
    ['172.31.255.254', 'private class B, high edge'],
    ['192.168.1.1', 'private class C'],
    ['169.254.169.254', 'cloud metadata — η κλασική λεία κάθε SSRF'],
    ['100.64.0.1', 'CGNAT — γειτονικά μηχανήματα σε πολλά hosting'],
    ['0.0.0.0', 'unspecified'],
    ['224.0.0.1', 'multicast'],
    ['240.0.0.1', 'reserved'],
  ])('απορρίπτει %s (%s)', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '93.184.216.34'])(
    'δέχεται τη δημόσια %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe('isPublicAddress — IPv6', () => {
  it.each([
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['fc00::1', 'unique local'],
    ['fd12:3456::1', 'unique local'],
    ['fe80::1', 'link-local'],
    ['ff02::1', 'multicast'],
    ['64:ff9b::7f00:1', 'NAT64 — IPv4 πίσω πόρτα'],
  ])('απορρίπτει %s (%s)', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it('απορρίπτει IPv4-mapped loopback (::ffff:127.0.0.1)', () => {
    // Χωρίς αυτόν τον έλεγχο η IPv6 γραφή θα ήταν ανοιχτή πίσω πόρτα στα ίδια
    // εύρη που η IPv4 διαδρομή μπλοκάρει.
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
  });

  it('δέχεται IPv4-mapped δημόσια (::ffff:8.8.8.8)', () => {
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
  });

  it('δέχεται δημόσια IPv6', () => {
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });
});

describe('validateOutboundUrlSyntax', () => {
  it('απορρίπτει http', () => {
    const result = validateOutboundUrlSyntax('http://example.com/client.json');
    expect(result).toEqual({ ok: false, rejection: 'scheme_not_https' });
  });

  it('απορρίπτει credentials στο URL (σύγχυση parser)', () => {
    // `https://trusted.example@evil.example` διαβάζεται από άνθρωπο ως trusted
    // και από μηχανή ως evil.
    const result = validateOutboundUrlSyntax('https://user:pass@evil.example/c.json');
    expect(result).toEqual({ ok: false, rejection: 'credentials_in_url' });
  });

  it('απορρίπτει fragment', () => {
    const result = validateOutboundUrlSyntax('https://example.com/c.json#frag');
    expect(result).toEqual({ ok: false, rejection: 'fragment_present' });
  });

  it('απορρίπτει literal ιδιωτική IP χωρίς να αγγίξει DNS', () => {
    const result = validateOutboundUrlSyntax('https://169.254.169.254/latest/meta-data/');
    expect(result).toEqual({ ok: false, rejection: 'address_not_public' });
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('απορρίπτει literal IPv6 loopback σε αγκύλες', () => {
    const result = validateOutboundUrlSyntax('https://[::1]/c.json');
    expect(result).toEqual({ ok: false, rejection: 'address_not_public' });
  });

  it('δέχεται κανονικό https URL', () => {
    const result = validateOutboundUrlSyntax('https://app.example.com/oauth/client.json');
    expect(result.ok).toBe(true);
  });
});

describe('validateOutboundUrl — ανάλυση ονόματος', () => {
  beforeEach(() => {
    mockLookup.mockReset();
  });

  it('απορρίπτει domain που λύνει σε loopback (DNS rebinding)', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    const result = await validateOutboundUrl('https://evil.example/c.json');
    expect(result).toEqual({ ok: false, rejection: 'address_not_public' });
  });

  it('απορρίπτει όταν **έστω μία** διεύθυνση είναι ιδιωτική', async () => {
    // Κακόβουλος DNS επιστρέφει σκόπιμα μεικτό σύνολο για να περάσει έναν
    // έλεγχο «της πρώτης». Ο client μπορεί να διαλέξει οποιαδήποτε.
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);
    const result = await validateOutboundUrl('https://mixed.example/c.json');
    expect(result).toEqual({ ok: false, rejection: 'address_not_public' });
  });

  it('δέχεται όταν όλες οι διευθύνσεις είναι δημόσιες', async () => {
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1::1', family: 6 },
    ]);
    const result = await validateOutboundUrl('https://example.com/c.json');
    expect(result.ok).toBe(true);
  });

  it('απορρίπτει όταν το DNS αποτυγχάνει', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    const result = await validateOutboundUrl('https://nowhere.example/c.json');
    expect(result).toEqual({ ok: false, rejection: 'dns_failed' });
  });

  it('απορρίπτει κενό αποτέλεσμα DNS', async () => {
    mockLookup.mockResolvedValue([]);
    const result = await validateOutboundUrl('https://empty.example/c.json');
    expect(result).toEqual({ ok: false, rejection: 'dns_failed' });
  });
});
