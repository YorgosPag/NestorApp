/**
 * @jest-environment node
 *
 * Άγκυρα — **Η ΔΙΕΥΘΥΝΣΗ ΠΟΥ ΣΤΕΛΝΟΥΜΕ ΤΟΝ ΑΝΘΡΩΠΟ ΕΙΝΑΙ ΔΙΚΗ ΤΟΥ, ΟΧΙ ΔΙΚΗ ΜΑΣ**
 *
 * ## Το περιστατικό που τη γέννησε (2026-09-02, στην οθόνη)
 *
 * Πάτημα στο **«Ο χώρος του γραφείου μου»** κατέληξε σε
 * `https://0.0.0.0:3000/o/comp_9c7c1a50-…/dashboard`, με προειδοποίηση **phishing**
 * από επέκταση του φυλλομετρητή. Η *διαδρομή* ήταν σωστή· το *σπίτι* μπροστά της
 * ήταν το `HOSTNAME` του container (`Dockerfile:21`), γιατί το `request.url` του
 * standalone διακομιστή χτίζεται από εκεί.
 *
 * ## Γιατί καμία υπάρχουσα πύλη δεν το έπιασε
 *
 * 🔴 **Επειδή τοπικά είναι ΑΟΡΑΤΟ.** Στο `next dev` το `HOSTNAME` είναι `localhost`,
 * άρα το απόλυτο URL τύχαινε να είναι σωστό. Το «δοκίμασέ το» **δεν μπορούσε** να
 * δει αυτό το σφάλμα — δηλαδή πράσινο που σήμαινε «κανείς δεν κοίταξε» (N.12), σε
 * νέα θέση.
 *
 * ## Τι κλειδώνει, και ποια μετάλλαξη κοκκινίζει
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Α | ο κριτής κόβει τη **θύρα** πριν κρίνει | `0.0.0.0:3000` κρίνεται ολόκληρο ⇒ «δρομολογήσιμο» |
 * | Β | το `NEXT_PUBLIC_APP_URL` **προηγείται** της κεφαλίδας | εμπιστοσύνη στο `x-forwarded-host` ⇒ Host header injection |
 * | Γ | το `Location` **του Node** είναι **σχετικό** | επιστροφή σε `NextResponse.redirect(new URL(…, request.url))` |
 * | Δ | το **ίδιο το `/home`** — η γραμμή του περιστατικού | το ίδιο, στον πραγματικό handler |
 * | Ε | το `Location` **του Edge** είναι απόλυτο στο **δημόσιο** σπίτι, αλλιώς **404** | `0.0.0.0:3000` ως origin ⇒ ξανά το περιστατικό |
 * | Η | κάθε `Location` του middleware **επιβιώνει** της ανάλυσης του Edge | σχετικό `Location` ⇒ `TypeError` ⇒ **500** στην παραγωγή |
 * | Θ | το middleware **δεν καλεί** τον `redirectTo` | μία κλήση πίσω στην έξοδο του Node |
 *
 * ⚠️ **Οι γραμμές Γ και Ε δεν συγκρούονται — τις ξεχωρίζει η ΜΕΤΑΦΟΡΑ.** Στο Node το
 * σχετικό `Location` δεν δηλώνει origin που δεν ξέρουμε· στο Edge ο προσαρμογέας το
 * **αναλύει** και πετά. Δύο έξοδοι, μία αυθεντία.
 *
 * @module lib/http/__tests__/request-origin
 * @see lib/http/request-origin
 */

import { readRepoCode } from '@/test-utils/read-source';

import { publicOrigin, publicUrl } from '../public-origin';
import {
  absoluteUrl,
  isUnroutableHost,
  redirectTo,
  requestOrigin,
  requestOriginOrThrow,
} from '../request-origin';

// ============================================================================
// Βοηθήματα
// ============================================================================

/** Ένα αίτημα με **μόνο** κεφαλίδες — ό,τι ακριβώς βλέπει το module. */
function reqWith(headers: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(headers) };
}

/**
 * ⚠️ **Το `NEXT_PUBLIC_APP_URL` καθαρίζεται σε ΚΑΘΕ test.** Αλλιώς η σειρά
 * εκτέλεσης θα καθόριζε το αποτέλεσμα — και μια άγκυρα που εξαρτάται από τη σειρά
 * της δεν είναι άγκυρα.
 */
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

/**
 * *«Δηλώνει αυτό το `Location` ποιοι είμαστε;»* — ο ένας κριτής της άγκυρας.
 *
 * Πιάνει **και τα δύο** σχήματα: απόλυτο με scheme (`https://0.0.0.0:3000/x`) και
 * protocol-relative (`//0.0.0.0:3000/x`) — το δεύτερο είναι εξίσου authority και
 * θα ξέφευγε από έλεγχο που κοιτά μόνο για `://`.
 */
function declaresAuthority(location: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(location) || location.startsWith('//');
}

// ============================================================================
// Α — Ο ΚΡΙΤΗΣ ΤΟΥ HOST
// ============================================================================

describe('Α — isUnroutableHost: η διεύθυνση ακρόασης δεν είναι ταυτότητα', () => {
  // 🔴 Το ΠΡΑΓΜΑΤΙΚΟ δείγμα του περιστατικού, αυτούσιο.
  it.each([
    ['0.0.0.0:3000', 'το host του περιστατικού, ΜΕ θύρα'],
    ['0.0.0.0', 'χωρίς θύρα'],
    ['localhost:3000', 'τοπικό με θύρα'],
    ['LOCALHOST', 'κεφαλαία — η κρίση είναι case-insensitive'],
    ['127.0.0.1:8080', 'loopback'],
    ['[::1]:3000', 'IPv6 loopback σε αγκύλες'],
    ['[::]', 'IPv6 unspecified'],
    ['   ', 'μόνο κενά'],
    ['', 'κενό'],
  ])('απορρίπτει %s (%s)', (host) => {
    expect(isUnroutableHost(host)).toBe(true);
  });

  it.each([
    'nestorconstruct.gr',
    'www.nestorconstruct.gr',
    'nestorconstruct.gr:443',
    'staging.nestorconstruct.gr',
  ])('δέχεται το δημόσιο %s', (host) => {
    expect(isUnroutableHost(host)).toBe(false);
  });

  /**
   * 🔑 **Η μετάλλαξη που φυλάει αυτό το test**: αν κάποιος αφαιρέσει την αφαίρεση
   * θύρας, το `0.0.0.0:3000` γίνεται «δρομολογήσιμο» και ο έλεγχος περνά — δηλαδή
   * αφήνει να διαφύγει **ακριβώς το URL που τον γέννησε**.
   */
  it('η αφαίρεση θύρας ΔΕΝ είναι καλλωπισμός — χωρίς αυτήν ο έλεγχος είναι μονίμως πράσινος', () => {
    expect(isUnroutableHost('0.0.0.0:3000')).toBe(isUnroutableHost('0.0.0.0'));
  });
});

// ============================================================================
// Β — ΤΟ ΔΗΜΟΣΙΟ ORIGIN
// ============================================================================

describe('Β — requestOrigin: το env είναι αυθεντία, η κεφαλίδα εφεδρεία', () => {
  it('το NEXT_PUBLIC_APP_URL προηγείται ΚΑΙ όταν η κεφαλίδα δείχνει αλλού', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';

    const origin = requestOrigin(reqWith({ 'x-forwarded-host': 'evil.example' }));

    expect(origin).toBe('https://nestorconstruct.gr');
  });

  it('κόβει τις τελικές καθέτους της ρυθμισμένης τιμής', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr///';
    expect(requestOrigin(reqWith({}))).toBe('https://nestorconstruct.gr');
  });

  it('αγνοεί κενή ρύθμιση και πέφτει στην κεφαλίδα', () => {
    process.env.NEXT_PUBLIC_APP_URL = '   ';

    const origin = requestOrigin(
      reqWith({ host: 'nestorconstruct.gr', 'x-forwarded-proto': 'https' }),
    );

    expect(origin).toBe('https://nestorconstruct.gr');
  });

  it('προτιμά το x-forwarded-host έναντι του host όταν λείπει ρύθμιση', () => {
    const origin = requestOrigin(
      reqWith({ host: '0.0.0.0:3000', 'x-forwarded-host': 'nestorconstruct.gr' }),
    );

    expect(origin).toBe('https://nestorconstruct.gr');
  });

  it('παίρνει ΤΟ ΠΡΩΤΟ πρωτόκολλο από αλυσίδα proxy', () => {
    const origin = requestOrigin(
      reqWith({ host: 'nestorconstruct.gr', 'x-forwarded-proto': 'https, http' }),
    );

    expect(origin).toBe('https://nestorconstruct.gr');
  });

  // 🔴 Η ΚΑΡΔΙΑ: το host του container δεν γίνεται ποτέ δημόσια διεύθυνση.
  it('επιστρέφει null όταν το μόνο host είναι το 0.0.0.0:3000 του container', () => {
    expect(requestOrigin(reqWith({ host: '0.0.0.0:3000' }))).toBeNull();
  });

  it('επιστρέφει null χωρίς καμία πηγή', () => {
    expect(requestOrigin(reqWith({}))).toBeNull();
  });
});

describe('Β2 — requestOriginOrThrow / absoluteUrl', () => {
  it('πετά με ΟΝΟΜΑΣΤΙΚΗ αιτία αντί να παραγάγει https://null/…', () => {
    expect(() => requestOriginOrThrow(reqWith({ host: '0.0.0.0:3000' }))).toThrow(
      /NEXT_PUBLIC_APP_URL/,
    );
  });

  it('χτίζει απόλυτο URL με ΜΙΑ κάθετο, είτε το path την έχει είτε όχι', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';

    expect(absoluteUrl(reqWith({}), '/shared/abc')).toBe(
      'https://nestorconstruct.gr/shared/abc',
    );
    expect(absoluteUrl(reqWith({}), 'shared/abc')).toBe(
      'https://nestorconstruct.gr/shared/abc',
    );
  });

  it('absoluteUrl επιστρέφει null όταν δεν υπάρχει διεύθυνση — δεν μαντεύει', () => {
    expect(absoluteUrl(reqWith({ host: 'localhost:3000' }), '/x')).toBeNull();
  });
});

// ============================================================================
// Γ — Η ΑΝΑΚΑΤΕΥΘΥΝΣΗ ΔΕΝ ΔΗΛΩΝΕΙ ΠΟΙΟΙ ΕΙΜΑΣΤΕ
// ============================================================================

describe('Γ — redirectTo: σχετικό Location, πάντα', () => {
  it('γράφει το path αυτούσιο, χωρίς scheme και χωρίς authority', () => {
    const response = redirectTo('/o/comp_9c7c1a50/dashboard');

    expect(response.headers.get('Location')).toBe('/o/comp_9c7c1a50/dashboard');
    expect(declaresAuthority(response.headers.get('Location') ?? '')).toBe(false);
  });

  it('προεπιλογή 307 — ο προορισμός εξαρτάται από το ποιος ρωτά, άρα ΠΟΤΕ cacheable 308', () => {
    expect(redirectTo('/login').status).toBe(307);
  });

  it('δέχεται ρητό κωδικό όταν ο καλών τον δηλώνει', () => {
    expect(redirectTo('/login', 303).status).toBe(303);
  });

  /**
   * 🔴 **Η άγκυρα του περιστατικού, σε επίπεδο μονάδας**: ακόμη κι όταν το
   * `NEXT_PUBLIC_APP_URL` **υπάρχει**, το `Location` παραμένει σχετικό. Το origin
   * δεν είναι «άγνωστο που το μαντεύουμε καλύτερα» — είναι **ερώτηση που δεν
   * τίθεται**.
   */
  it('ΔΕΝ βάζει origin ούτε όταν το ξέρει', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';

    expect(redirectTo('/home').headers.get('Location')).toBe('/home');
  });
});

// ============================================================================
// Δ — Η ΠΡΑΓΜΑΤΙΚΗ ΓΡΑΜΜΗ ΤΟΥ ΠΕΡΙΣΤΑΤΙΚΟΥ
// ============================================================================

/**
 * ⚠️ **Εκτελείται ο ΑΛΗΘΙΝΟΣ handler.** Mock γίνονται μόνο οι δύο αυθεντίες που
 * ρωτά (*ποιος είσαι* · *πού ανήκεις*) — αν έκανα mock τη γραμμή της
 * ανακατεύθυνσης, η άγκυρα θα δοκίμαζε τον εαυτό της.
 */
describe('Δ — /home: η γραμμή που έστειλε άνθρωπο σε προειδοποίηση phishing', () => {
  const HOME = '/o/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757/dashboard';

  beforeEach(() => {
    jest.resetModules();
  });

  /** Στήνει τις δύο αυθεντίες και επιστρέφει τον πραγματικό `GET`. */
  async function loadRoute(options: {
    readonly authenticated: boolean;
    readonly href: string | null;
  }): Promise<() => Promise<Response>> {
    jest.doMock('@/server/auth/page-identity', () => ({
      readPageIdentity: jest.fn(async () =>
        options.authenticated
          ? { ok: true, scope: 'organization', ctx: { uid: 'u1', companyId: 'comp_9c7c1a50' } }
          : { ok: false },
      ),
    }));
    jest.doMock('@/lib/workspace/workspace-home', () => ({
      workspaceHomeHref: jest.fn(async () => options.href),
    }));
    jest.doMock('@/lib/telemetry', () => ({
      createModuleLogger: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      }),
    }));

    const routeModule: { GET: () => Promise<Response> } = await import('@/app/home/route');
    return routeModule.GET;
  }

  it('στέλνει στον χώρο με ΣΧΕΤΙΚΟ Location — κανένα 0.0.0.0:3000', async () => {
    // Η ρύθμιση ΥΠΑΡΧΕΙ, και παρ' όλα αυτά δεν εμφανίζεται στο Location:
    // η σωστή απάντηση δεν είναι «καλύτερο origin», είναι «κανένα origin».
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';

    const GET = await loadRoute({ authenticated: true, href: HOME });
    const response = await GET();
    const location = response.headers.get('Location') ?? '';

    expect(response.status).toBe(307);
    expect(location).toBe(HOME);
    expect(declaresAuthority(location)).toBe(false);
    expect(location).not.toContain('0.0.0.0');
  });

  it('ο ανώνυμος πάει στη σύνδεση — επίσης σχετικά', async () => {
    const GET = await loadRoute({ authenticated: false, href: null });
    const location = (await GET()).headers.get('Location') ?? '';

    expect(location).toBe('/login');
    expect(declaresAuthority(location)).toBe(false);
  });

  it('χώρος χωρίς διεύθυνση ⇒ σύνδεση, ποτέ κατασκευασμένο URL', async () => {
    const GET = await loadRoute({ authenticated: true, href: null });
    const location = (await GET()).headers.get('Location') ?? '';

    expect(location).toBe('/login');
    expect(declaresAuthority(location)).toBe(false);
  });
});

// ============================================================================
// Ε — ΤΟ ΔΕΥΤΕΡΟ ΔΕΙΓΜΑ ΤΗΣ ΙΔΙΑΣ ΚΛΑΣΗΣ
// ============================================================================

/**
 * 🔑 **Δεν είναι επανάληψη του Δ.** Το `/home` ήταν το δείγμα που **είδε** ο
 * άνθρωπος· το middleware είναι η **ίδια γραφή** σε δεύτερο σημείο, που κανείς δεν
 * είχε κοιτάξει. Άγκυρα μόνο στο πρώτο θα άφηνε την κλάση ζωντανή.
 */
describe('Ε — middleware: το δίχτυ των literal [placeholder] δεν δηλώνει ΠΟΤΕ το host του container', () => {
  /** Το αίτημα όπως ακριβώς φτάνει στον standalone διακομιστή πίσω από τον proxy. */
  async function guardResponse() {
    const { NextRequest } = await import('next/server');
    const { middleware } = await import('@/middleware');

    // ⚠️ **Το host ΕΙΝΑΙ το `0.0.0.0:3000` επίτηδες** — έτσι ακριβώς φτάνει το αίτημα.
    //    Αν η γραφή γυρίσει σε `new URL(parentPath, request.url)`, το `Location` γίνεται
    //    `http://0.0.0.0:3000/properties` και τα δύο tests παρακάτω κοκκινίζουν.
    return middleware(
      new NextRequest('http://0.0.0.0:3000/properties/%5Bid%5D/edit', {
        headers: { host: '0.0.0.0:3000' },
      }),
    );
  }

  it('με δηλωμένη ταυτότητα: απόλυτο Location στο ΔΗΜΟΣΙΟ σπίτι, ποτέ στο εσωτερικό', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';

    const location = (await guardResponse())?.headers.get('Location') ?? '';

    expect(location).toBe('https://nestorconstruct.gr/properties');
    // 🔴 Η καρδιά του ADR-819: ό,τι κι αν γίνει, **ποτέ** το host του container.
    expect(location).not.toContain('0.0.0.0');
  });

  it('ΧΩΡΙΣ δηλωμένη ταυτότητα: 404 — άρνηση, ποτέ μαντεψιά', async () => {
    // Το μόνο διαθέσιμο host είναι το `0.0.0.0:3000`, δηλαδή **μη δρομολογήσιμο**.
    // Μια ανακατεύθυνση εκεί θα ήταν ακριβώς το περιστατικό· το 404 κρατά τον σκοπό
    // («η διεύθυνση δεν ανοίγει») χωρίς να ονομάσει σπίτι που δεν ξέρουμε.
    const response = await guardResponse();

    expect(response?.status).toBe(404);
    expect(response?.headers.get('Location')).toBeNull();
  });
});

// ============================================================================
// Ζ — Η ΔΙΕΥΘΥΝΣΗ ΧΩΡΙΣ ΑΙΤΗΜΑ (ADR-848)
// ============================================================================

/**
 * 🔑 **Ο αποστολέας email τρέχει σε cron** — δεν υπάρχει κεφαλίδα να ρωτήσει. Αν το
 * `publicOrigin` έπεφτε σιωπηλά σε `localhost`, κάθε σύνδεσμος μέσα σε email θα
 * **έμοιαζε** έγκυρος και δεν θα άνοιγε ποτέ.
 */
describe('Ζ — publicOrigin / publicUrl: μόνο το env, και null αντί για μαντεψιά', () => {
  it('διαβάζει το NEXT_PUBLIC_APP_URL, χωρίς τελικές καθέτους', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr//';
    expect(publicOrigin()).toBe('https://nestorconstruct.gr');
  });

  it('null χωρίς ρύθμιση — ΠΟΤΕ localhost', () => {
    expect(publicOrigin()).toBeNull();
    expect(publicUrl('/n/abc')).toBeNull();
  });

  it('null με κενή ρύθμιση', () => {
    process.env.NEXT_PUBLIC_APP_URL = '   ';
    expect(publicOrigin()).toBeNull();
  });

  it('publicUrl βάζει ΜΙΑ κάθετο, είτε το path την έχει είτε όχι', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';
    expect(publicUrl('/n/abc')).toBe('https://nestorconstruct.gr/n/abc');
    expect(publicUrl('n/abc')).toBe('https://nestorconstruct.gr/n/abc');
  });

  it('ίδιος κανόνας ένωσης με το absoluteUrl — ένας κανόνας, δύο καταναλωτές', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';
    expect(publicUrl('/x?y=1')).toBe(absoluteUrl(reqWith({}), '/x?y=1'));
  });
});

// ============================================================================
// Η — Ο ΚΑΤΑΝΑΛΩΤΗΣ, ΟΧΙ Ο ΠΑΡΑΓΩΓΟΣ
// ============================================================================

/**
 * 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΑΥΤΗ Η ΟΜΑΔΑ ΚΛΕΙΝΕΙ (μετρημένο 2026-09-12, στην παραγωγή)**
 *
 * Η ομάδα `Ε` **έτρεχε ήδη το πραγματικό middleware** — και **έμεινε πράσινη** ενώ
 * κάθε `/o/me/*` έδινε **500**. Γιατί; Το jest καλεί **τη συνάρτησή μας** και κρίνει
 * την απάντηση. Η παραγωγή δίνει την **ίδια** απάντηση στον **προσαρμογέα του Edge**,
 * και **εκείνος** πετά. *Εκτελούσαμε τον παραγωγό, ποτέ τον καταναλωτή.*
 *
 * ## Τι ακριβώς κάνει ο καταναλωτής
 *
 * `next/dist/server/web/adapter.js:340` — για **κάθε** απόκριση με `Location`:
 *
 * ```js
 * const redirectURL = new NextURL(redirect, { forceLocale: false, headers, nextConfig });
 * ```
 *
 * και ο `parseURL` (`next-url.js:17`) είναι σκέτο `new URL(input, base)` με
 * `base === undefined`. **Σχετικό `Location` ⇒ `TypeError: Invalid URL` ⇒ 500.**
 * Upstream: **vercel/next.js#73989** (ανοιχτό).
 *
 * ⛔ **ΜΗΝ εισαγάγεις εδώ `next/dist/...`**: θα ήταν το **πρώτο** deep import του repo
 * και θα έδενε την άγκυρα σε εσωτερικό μονοπάτι. Αντιγράφουμε την **πράξη**, όχι το
 * μονοπάτι — το αναλλοίωτο («απόλυτο `Location`») ισχύει ακόμη κι αν το #73989 κλείσει.
 */
describe('Η — το Location του middleware επιβιώνει της ανάλυσης που κάνει το Edge', () => {
  /** Ακριβώς η πράξη του `parseURL`: `new URL(input)` **χωρίς base**. */
  function survivesEdgeParse(location: string): boolean {
    try {
      new URL(location);
      return true;
    } catch {
      return false;
    }
  }

  /** Κάθε απόκριση του middleware που φέρει `Location`, από τους δύο δρόμους του. */
  async function middlewareLocations(): Promise<readonly string[]> {
    const { NextRequest } = await import('next/server');
    const { middleware } = await import('@/middleware');

    const paths = [
      'http://0.0.0.0:3000/properties/%5Bid%5D/edit', // φρουρός [id]
      'http://0.0.0.0:3000/o/me/projects', // ιδιωτικός χώρος — το ζωντανό 500
      'http://0.0.0.0:3000/o/me',
      'http://0.0.0.0:3000/o/ME/projects', // ψευδώνυμο σε κεφαλαία
    ];

    const found: string[] = [];
    for (const url of paths) {
      const response = middleware(
        new NextRequest(url, { headers: { host: 'nestorconstruct.gr' } }),
      );
      const location = response?.headers.get('Location');
      if (location !== null && location !== undefined) found.push(location);
    }
    return found;
  }

  it('και οι ΤΕΣΣΕΡΙΣ διαδρομές ανακατευθύνουν — καμία δεν πετά', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';
    expect(await middlewareLocations()).toHaveLength(4);
  });

  it('🔴 ΤΟ 500: κάθε Location περνά την ανάλυση του Edge χωρίς base', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';

    for (const location of await middlewareLocations()) {
      expect({ location, survives: survivesEdgeParse(location) }).toEqual({
        location,
        survives: true,
      });
    }
  });

  it('αντίστροφα: ο redirectTo μένει ΣΧΕΤΙΚΟΣ — και άρα ΔΕΝ επιβιώνει εκεί', () => {
    // 🔑 Αυτό το test είναι ο **λόγος ύπαρξης** των δύο εξόδων. Το ADR-819 δεν
    //    ακυρώνεται: στο Node το σχετικό `Location` παραμένει η ασφαλέστερη γραφή.
    const location = redirectTo('/offers').headers.get('Location') ?? '';

    expect(location).toBe('/offers');
    expect(survivesEdgeParse(location)).toBe(false);
  });
});

// ============================================================================
// Θ — ΤΟ ΣΥΝΟΡΟ ΕΙΝΑΙ ΕΝΑ ΑΡΧΕΙΟ, ΚΑΙ ΤΟ ΛΕΕΙ Ο ΚΩΔΙΚΑΣ
// ============================================================================

/**
 * 🔑 **Γιατί άγκυρα και όχι πύλη**: απογραφή 2026-09-12 — το `src/middleware.ts` είναι
 * το **μοναδικό** Edge surface του repo (μηδέν `export const runtime = 'edge'` σε όλο
 * το `src/`). Πύλη για πληθυσμό **ενός** αρχείου είναι μηχανή χωρίς πληθυσμό· άγκυρα
 * στο ένα αρχείο είναι **πλήρης**, όχι δείγμα.
 *
 * ⚠️ Διαβάζει **κώδικα χωρίς σχόλια** (`readRepoCode`) — αλλιώς κοκκινίζει πάνω στο
 * ίδιο το σχόλιο που εξηγεί τον κανόνα (μάθημα CHECK 3.50 `Κ7β`).
 */
describe('Θ — το middleware ζητά την έξοδο του Edge, όχι του Node', () => {
  const middlewareCode = readRepoCode('src/middleware.ts');

  it('ΔΕΝ καλεί τον redirectTo — αυτός γράφει σχετικό Location και ρίχνει το Edge', () => {
    expect(/\bredirectTo\s*\(/.test(middlewareCode)).toBe(false);
  });

  it('καλεί τον redirectFromMiddleware ΜΕ το αίτημα — η κλήση, όχι η εισαγωγή', () => {
    // ⚠️ Ένα `toContain('redirectFromMiddleware')` θα περνούσε με **σκέτη εισαγωγή**.
    //    Ζητάμε την **κλήση** με το αίτημα — χωρίς αυτό δεν υπάρχει origin να ρωτηθεί.
    const calls = middlewareCode.match(/\bredirectFromMiddleware\s*\(\s*request\s*,/g);
    expect(calls).toHaveLength(2);
  });
});
