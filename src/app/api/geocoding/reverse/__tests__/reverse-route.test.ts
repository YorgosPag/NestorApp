/**
 * @fileoverview **Η ΔΙΑΔΡΟΜΗ `reverse` ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ, ΜΕΣΑ ΣΕ ΜΙΑ ΠΡΟΘΕΣΜΙΑ** — ADR-332 D27 Β13.
 * @related app/api/geocoding/reverse/route.ts · lib/geocoding/overpass-housenumber.ts
 *
 * 🔴 Δύο ελαττώματα, ένα αρχείο:
 *  - «ο πάροχος δεν απάντησε» έφευγε ως **404** («εδώ δεν γράφει τίποτα») — ο διάλογος έλεγε ψέματα.
 *  - το Overpass έτρεχε με **δικά του** χρονόμετρα μετά το Nominatim — άθροισμα, όχι προθεσμία.
 *
 * Mock μόνο στα σύνορα: `fetch` (Nominatim), ο αναζητητής αριθμού (Overpass), το όριο ρυθμού.
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHeavyRateLimit: <T>(handler: T) => handler,
}));
jest.mock('@/lib/geocoding/overpass-housenumber', () => ({
  findNearestHouseNumber: jest.fn(),
}));

import type { NextRequest } from 'next/server';
import type { Deadline } from '@/lib/async-utils';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { findNearestHouseNumber } from '@/lib/geocoding/overpass-housenumber';
import { GET } from '../route';

const ORIGINAL_FETCH = global.fetch;

/** Ό,τι απάντησε ζωντανά το Nominatim για την πόρτα της Σαμοθράκης 16: ο δρόμος, χωρίς αριθμό. */
const NOMINATIM_STREET = {
  lat: '40.6643548',
  lon: '22.8975059',
  display_name: 'Σαμοθράκης, Ελευθέριο Κορδελιό',
  address: { road: 'Σαμοθράκης', suburb: 'Ελευθέριο Κορδελιό', postcode: '563 34', country: 'Ελλάδα' },
};

function nominatimAnswers(body: unknown, status = 200): jest.Mock {
  const mock = jest.fn(async () => ({ ok: status < 300, status, json: async () => body }));
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

async function call(): Promise<{ status: number; body: Record<string, unknown> }> {
  const request = { url: 'http://localhost/api/geocoding/reverse?lat=40.6641899&lon=22.8974273' } as NextRequest;
  const response = (await GET(request)) as unknown as { status: number; json: () => Promise<Record<string, unknown>> };
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  jest.mocked(findNearestHouseNumber).mockReset();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe('Β13 — τρεις εκβάσεις, όχι δύο', () => {
  it('🔴 το Nominatim ΔΕΝ απάντησε ⇒ 503 («δεν ρώτησα»), ΟΧΙ 404 («εδώ δεν γράφει τίποτα»)', async () => {
    global.fetch = jest.fn(async () => { throw new Error('The operation was aborted due to timeout'); }) as unknown as typeof fetch;

    expect((await call()).status).toBe(503);
  });

  it('🔴 όριο ρυθμού του Nominatim (429) ⇒ 503', async () => {
    nominatimAnswers({}, 429);
    expect((await call()).status).toBe(503);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: το Nominatim ΑΠΑΝΤΗΣΕ «Unable to geocode» ⇒ 404 — αυτό ΕΙΝΑΙ «εδώ δεν γράφει τίποτα»', async () => {
    nominatimAnswers({ error: 'Unable to geocode' });
    expect((await call()).status).toBe(404);
  });
});

describe('Β13 — ΜΙΑ προθεσμία για όλο το αίτημα', () => {
  it('🔴 ο αναζητητής αριθμού παίρνει την ΙΔΙΑ προθεσμία, με ό,τι απομένει από αυτήν', async () => {
    nominatimAnswers(NOMINATIM_STREET);
    jest.mocked(findNearestHouseNumber).mockResolvedValue('16');

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.number).toBe('16');
    const options = jest.mocked(findNearestHouseNumber).mock.calls[0]![3] as { deadline: Deadline };
    expect(options.deadline.remainingMs()).toBeLessThanOrEqual(GEOGRAPHIC_CONFIG.GEOCODING.REVERSE_BUDGET_MS);
    expect(options.deadline.remainingMs()).toBeGreaterThan(0);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: το Nominatim έδωσε αριθμό ⇒ ΚΑΝΕΝΑ αίτημα Overpass', async () => {
    nominatimAnswers({ ...NOMINATIM_STREET, address: { ...NOMINATIM_STREET.address, house_number: '16' } });

    expect((await call()).body.number).toBe('16');
    expect(findNearestHouseNumber).not.toHaveBeenCalled();
  });

  it('ο αριθμός δεν βρέθηκε μέσα στην προθεσμία ⇒ η απάντηση φεύγει ΧΩΡΙΣ αριθμό (όχι σφάλμα)', async () => {
    nominatimAnswers(NOMINATIM_STREET);
    jest.mocked(findNearestHouseNumber).mockResolvedValue(null);

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.street).toBe('Σαμοθράκης');
    expect(body.number).toBe('');
  });
});

// =============================================================================
// ΦΑΣΗ Β′ — Η ΔΙΟΙΚΗΤΙΚΗ ΑΛΥΣΙΔΑ ΠΟΥ ΠΕΤΑΓΑΜΕ (ADR-332 D27 · Ζ2 · Ζ4β · Ζ4γ)
// =============================================================================

/**
 * 🔴 **Το `NominatimReverseAddress` δήλωνε ΔΕΚΑ κλειδιά και έλειπαν ακριβώς τα διοικητικά.**
 * Ό,τι δεν δηλώνεται δεν διαβάζεται, και ό,τι δεν διαβάζεται «δεν υπάρχει» — έτσι ο **δήμος**,
 * η μία από τις **δύο** ταυτότητες που αποθηκεύει το `companyAddress`, ήταν **πάντα στην
 * απάντηση** και **ποτέ** στη βάση.
 *
 * ⚠️ **Τα φορτία εδώ είναι ΑΥΤΟΥΣΙΑ από ζωντανές απαντήσεις** *(2026-09-12, `accept-language:
 * el,en`)*, με το τυπογραφικό της μηχανής («Θεσ**α**λονίκης», ένα σ) **αναλλοίωτο**. Ένα
 * φορτίο που φτιάξαμε εμείς θα επικύρωνε τη φαντασία μας.
 */
describe('Φάση Β′ — ο δήμος βγαίνει από την αλυσίδα, ΚΑΙ όπου η γεωμετρία σιωπά', () => {
  /** Εγνατία 102, Θεσσαλονίκη — ζωντανή απάντηση. */
  const EGNATIA = {
    lat: '40.6329',
    lon: '22.9480',
    display_name: 'Εγνατία, Θεσσαλονίκη',
    address: {
      road: 'Εγνατία',
      house_number: '102',
      city: 'Δημοτική Ενότητα Θεσαλονίκης',
      municipality: 'Δήμος Θεσσαλονίκης',
      county: 'Μητροπολιτική Ενότητα Θεσσαλονίκης',
      state: 'Περιφέρεια Κεντρικής Μακεδονίας',
      city_district: '1η Κοινότητα Θεσσαλονίκης',
      postcode: '546 25',
      country: 'Ελλάδα',
    },
  };

  /** Σύνταγμα — **εδώ κανένα εσωτερικό κάλυμμα δήμου δεν περιέχει το σημείο**. */
  const SYNTAGMA = {
    lat: '37.9755',
    lon: '23.7348',
    display_name: 'Κολωνάκι, Αθήνα',
    address: {
      road: 'Φιλελλήνων',
      city: 'Αθήνα',
      municipality: 'Δήμος Αθηναίων',
      county: 'Περιφερειακή Ενότητα Κεντρικού Τομέα Αθηνών',
      state: 'Περιφέρεια Αττικής',
      city_district: '1η Κοινότητα Αθηνών',
      quarter: 'Κολωνάκι',
      postcode: '105 57',
      country: 'Ελλάδα',
    },
  };

  it('🏆 Εγνατία 102 ⇒ ο ΔΗΜΟΣ αποδεικνύεται από την ετικέτα (municipality:0701)', async () => {
    nominatimAnswers(EGNATIA);
    const { body } = await call();

    const admin = body.admin as readonly { level: number; id: string; name: string }[];
    expect(admin).toBeDefined();
    expect(admin.find((l) => l.level === 5)?.id).toBe('municipality:0701');
    // Το όνομα είναι του **μητρώου**, με δύο σίγμα — όχι το τυπογραφικό της μηχανής.
    expect(admin.find((l) => l.level === 5)?.name).toContain('ΘΕΣΣΑΛΟΝΙΚΗΣ');
  });

  it('🔴 «Μητροπολιτική Ενότητα» (όρος OSM, εκτός ΕΛΣΤΑΤ) ΔΕΝ ακυρώνει τον δήμο', async () => {
    nominatimAnswers(EGNATIA);
    const { body } = await call();

    const admin = body.admin as readonly { level: number }[];
    // Απουσία στοιχείου ≠ στοιχείο απουσίας: η βαθμίδα 4 δεν βρέθηκε και **δεν** εμπόδισε.
    expect(admin.some((l) => l.level === 5)).toBe(true);
  });

  it('🏆 Σύνταγμα ⇒ δήμος ΚΑΙ οικισμός, εκεί που η γεωμετρία δεν αποδεικνύει τίποτα', async () => {
    nominatimAnswers(SYNTAGMA);
    const { body } = await call();

    const admin = body.admin as readonly { level: number; id: string; name: string }[];
    expect(admin.find((l) => l.level === 5)?.id).toBe('municipality:4501');
    // «Αθήνα» → «Αθήναι» μέσα στον αποδεδειγμένο δήμο (αρχαΐζουσα μορφή, 20,2% του μητρώου).
    expect(admin.find((l) => l.level === 8)?.name).toBe('Αθήναι');
  });

  it('🔴 Ζ2 — η ΣΥΝΟΙΚΙΑ δεν καταλαμβάνει πια την «Πόλη»: «Κολωνάκι» μένει συνοικία', async () => {
    nominatimAnswers(SYNTAGMA);
    const { body } = await call();

    expect(body.neighborhood).toBe('Κολωνάκι');
    // Η «Πόλη» ακολουθεί την **ταυτότητα** του οικισμού, ποτέ τη γειτονιά.
    expect(body.city).toBe('Αθήναι');
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ — ΤΗΝ ΒΡΗΚΕ ΕΛΕΓΧΟΣ ΜΕΤΑΛΛΑΞΗΣ.**
   *
   * Η πρώτη εκδοχή αυτής της σουίτας δήλωνε ότι «η συνοικία δεν καταλαμβάνει πια την Πόλη»,
   * αλλά **καμία** άγκυρα δεν το απέδειχνε: το φορτίο του Συντάγματος φέρνει `quarter`, όχι
   * `neighbourhood`. Η μετάλλαξη *«ξαναβάλε το `neighbourhood` στην αλυσίδα της πόλης»*
   * **επέζησε** — δηλαδή ο κανόνας ήταν σχόλιο, όχι συμβόλαιο.
   *
   * Αυτό εδώ είναι το **μετρημένο** σχήμα του ευρήματος Ζ2 *(ADR-332 D27, Λ6)*: η μηχανή
   * πρότεινε **«Λαδάδικα» ως Πόλη**. Και επειδή **καμία** συνοικία Αθήνας/Θεσσαλονίκης δεν
   * είναι οικισμός ΕΛΣΤΑΤ, όσο κρατούσε τη θέση της πόλης η ταυτοποίηση ήταν **αδύνατη**.
   */
  it('🔴 Ζ2 — «Λαδάδικα» ΜΕΝΕΙ συνοικία και ΔΕΝ γίνεται Πόλη (το μετρημένο εύρημα)', async () => {
    nominatimAnswers({
      lat: '40.6380',
      lon: '22.9350',
      display_name: 'Μητροπόλεως, Λαδάδικα',
      address: {
        road: 'Μητροπόλεως',
        house_number: '43',
        neighbourhood: 'Λαδάδικα',
        city: 'Δημοτική Ενότητα Θεσαλονίκης',
        municipality: 'Δήμος Θεσσαλονίκης',
        state: 'Περιφέρεια Κεντρικής Μακεδονίας',
        postcode: '546 24',
        country: 'Ελλάδα',
      },
    });
    const { body } = await call();

    expect(body.neighborhood).toBe('Λαδάδικα');
    expect(body.city).not.toBe('Λαδάδικα');
    // Ο δήμος αποδεικνύεται κανονικά — η συνοικία δεν εμποδίζει πια τίποτα.
    expect((body.admin as readonly { level: number; id: string }[]).find((l) => l.level === 5)?.id)
      .toBe('municipality:0701');
  });

  /**
   * 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΒΡΗΚΕ Η ΖΩΝΤΑΝΗ ΜΕΤΡΗΣΗ, ΟΧΙ ΤΑ TESTS** *(ALFA → Σταυρούπολις)*.
   *
   * Η αλυσίδα της ετικέτας απέδειξε ως τον **δήμο**· ο οικισμός αποδείχθηκε **μετά**, μέσα σε
   * εκείνη την εμβέλεια. Τα **ενδιάμεσα** επίπεδα — L6 δημοτική ενότητα, L7 κοινότητα — είναι
   * **πρόγονοι αποδεδειγμένου οικισμού**, άρα **αποδεδειγμένα**· και όμως γράφτηκαν **κενά**
   * στο Firestore *(`municipalUnitName: ''` ενώ το μητρώο ξέρει «ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ
   * ΣΤΑΥΡΟΥΠΟΛΕΩΣ»)*. Παραβίαζε την ίδια μας την αρχή, και **κανένα** test δεν το ρωτούσε.
   */
  it('🔴 ο αποδεδειγμένος οικισμός συμπληρώνει ΚΑΙ τα ενδιάμεσα επίπεδα (L6/L7)', async () => {
    nominatimAnswers({
      lat: '40.6724',
      lon: '22.9348',
      display_name: 'Προξένου Κορομηλά, Σταυρούπολη',
      address: {
        road: 'Προξένου Κορομηλά',
        house_number: '5',
        city: 'Σταυρούπολη',
        municipality: 'Δήμος Παύλου Μελά',
        state: 'Περιφέρεια Κεντρικής Μακεδονίας',
        neighbourhood: 'Ομόνοια',
        postcode: '564 31',
        country: 'Ελλάδα',
      },
    });
    const { body } = await call();
    const admin = body.admin as readonly { level: number; id: string; name: string }[];

    expect(admin.find((l) => l.level === 8)?.id).toBe('settlement:0711010101');
    expect(admin.find((l) => l.level === 5)?.id).toBe('municipality:0711');
    // ⬇️ Αυτά έλειπαν: πρόγονοι του αποδεδειγμένου οικισμού, δηλαδή αποδεδειγμένοι.
    expect(admin.find((l) => l.level === 6)?.name).toContain('ΣΤΑΥΡΟΥΠΟΛΕΩΣ');
    expect(admin.find((l) => l.level === 7)).toBeDefined();
  });

  it('🔒 το `city` αγγίζεται ΜΟΝΟ όταν ο οικισμός αποδείχθηκε (Εγνατία: δεν αποδείχθηκε)', async () => {
    nominatimAnswers(EGNATIA);
    const { body } = await call();

    const admin = body.admin as readonly { level: number }[];
    // Μια **δημοτική ενότητα** δεν είναι οικισμός ⇒ καμία ταυτότητα 8, καμία επινόηση ονόματος.
    expect(admin.some((l) => l.level === 8)).toBe(false);
    expect(body.city).toBe('Θεσαλονίκης');
  });
});
