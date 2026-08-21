/**
 * @jest-environment node
 *
 * ⚠️ **node, ΟΧΙ jsdom** — και ο λόγος είναι μετρημένος: το jsdom **δεν υλοποιεί
 * `crypto.subtle`** (επαληθεύτηκε ζωντανά: κάθε κλήση απέρριπτε με
 * `CRYPTO_ERROR`). Σε jsdom η σουίτα θα δοκίμαζε τη διαδρομή αποτυχίας και θα
 * ανέφερε «η μηχανή δεν δουλεύει» για λόγο που **δεν είναι η μηχανή**. Ο Node 20
 * προσφέρει native WebCrypto — το **ίδιο** API που τρέχει στον browser.
 */
/**
 * Άγκυρες για το SSoT `@/lib/hash/sha256` (ADR-749 — μία μηχανή, μία αλήθεια).
 *
 * ⚠️ Τα Δ1-Δ2 είναι **δημοσιευμένα διανύσματα του FIPS 180-4**, όχι τιμές που
 * παρήγαγε η ίδια η υλοποίηση: αν καρφώναμε το output της, η άγκυρα θα ήταν
 * πράσινη ακόμα κι αν ο αλγόριθμος ήταν λάθος από την πρώτη μέρα.
 */
import {
  sha256Hex,
  sha256HexOfText,
  bytesToHex,
  isWebCryptoAvailable,
  CRYPTO_UNAVAILABLE_ERROR,
} from '../sha256';

/** SHA-256("") και SHA-256("abc") — FIPS 180-4 Appendix B. */
const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('sha256 SSoT', () => {
  it('Δ1: το κενό κείμενο δίνει το διάνυσμα του FIPS 180-4', async () => {
    await expect(sha256HexOfText('')).resolves.toBe(EMPTY);
  });

  it('Δ2: το "abc" δίνει το διάνυσμα του FIPS 180-4', async () => {
    await expect(sha256HexOfText('abc')).resolves.toBe(ABC);
  });

  it('Δ3: το αποτέλεσμα είναι πάντα 64 χαρακτήρες lowercase hex', async () => {
    const hex = await sha256HexOfText('Νέστωρ Παγώνης — μη-ASCII');
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('Κ1: `bytesToHex` γεμίζει με μηδενικό κάθε byte < 0x10', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff');
  });

  it('Κ2: `isWebCryptoAvailable` λέει ναι σε αυτό το περιβάλλον', () => {
    expect(isWebCryptoAvailable()).toBe(true);
  });

  /**
   * ⚠️ Η ΠΙΟ ΚΡΙΣΙΜΗ ΑΓΚΥΡΑ. Ένα `Uint8Array` μπορεί να είναι **προβολή** πάνω σε
   * μεγαλύτερο buffer. Περνώντας ωμά το `.buffer` κατακερματίζεις ΟΛΟΚΛΗΡΟ τον
   * buffer — παίρνεις έγκυρο 64-χαρακτήρο hex που είναι **λάθος**, σιωπηλά.
   */
  it('Κ3: προβολή με byteOffset>0 κατακερματίζει ΜΟΝΟ το δικό της παράθυρο', async () => {
    const backing = new Uint8Array([0xde, 0xad, 0x61, 0x62, 0x63, 0xbe, 0xef]);
    const view = backing.subarray(2, 5); // ακριβώς τα bytes του "abc"
    expect(view.byteOffset).toBeGreaterThan(0);
    await expect(sha256Hex(view)).resolves.toBe(ABC);
  });

  it('Κ4: προβολή που καλύπτει όλο τον buffer δίνει το ίδιο με τον buffer', async () => {
    const bytes = new TextEncoder().encode('abc');
    await expect(sha256Hex(bytes)).resolves.toBe(ABC);
    await expect(sha256Hex(bytes.buffer)).resolves.toBe(ABC);
  });

  it('Κ5: χωρίς Web Crypto πετά τον ονομασμένο λόγο, όχι TypeError', async () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(isWebCryptoAvailable()).toBe(false);
      await expect(sha256Hex(new Uint8Array([1]))).rejects.toThrow(CRYPTO_UNAVAILABLE_ERROR);
    } finally {
      if (real) Object.defineProperty(globalThis, 'crypto', real);
    }
  });
});
