// Jest Setup File
import '@testing-library/jest-dom';

// Add custom Jest matchers
expect.extend({
  toBeOneOf(received, expectedArray) {
    const pass = expectedArray.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expectedArray.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expectedArray.join(', ')}`,
        pass: false,
      };
    }
  },
});

// Mock για localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

global.localStorage = localStorageMock;

// Mock για requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  setTimeout(callback, 0);
  return 0;
};

global.cancelAnimationFrame = jest.fn();

// TextEncoder / TextDecoder — available in Node but not always exposed in jsdom
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Compression/DecompressionStream + Blob — υπάρχουν στον Node 18+, ΔΕΝ τα εκθέτει το jsdom.
// Ίδιο μοτίβο με το TextEncoder από πάνω: δανείζονται από τον Node, μόνο όταν λείπουν.
// Χρειάζονται από τον `zip-unpack` (ADR-736 Φ3, `deflate-raw`) και από κάθε κώδικα που
// διαβάζει bytes από Blob — το jsdom Blob δεν έχει καν `arrayBuffer()`.
if (typeof global.DecompressionStream === 'undefined') {
  const { CompressionStream, DecompressionStream } = require('stream/web');
  global.CompressionStream = CompressionStream;
  global.DecompressionStream = DecompressionStream;
}
// Το `Blob`/`File` του jsdom έχει `name`/`size` αλλά **ΟΥΤΕ** `arrayBuffer()` **ΟΥΤΕ** `text()` —
// δηλαδή κάθε κώδικας που διαβάζει τα bytes ενός αρχείου χρήστη (hash, unzip, decode) «αποτυγχάνει»
// στα τεστ για λόγο που **δεν υπάρχει στον browser**.
//
// ⚠️ ΣΥΜΠΛΗΡΩΝΟΥΜΕ τα πρωτότυπα — ΔΕΝ αντικαθιστούμε τις κλάσεις με του Node. Το `Blob` του Node
// είναι ΑΛΛΟΣ τύπος: το jsdom `FileReader.readAsArrayBuffer` κάνει brand-check και πετά
// «parameter 1 is not of type 'Blob'» (μετρημένο: 19 τεστ κόκκινα σε GLTFExporter/three).
// Το `File` του jsdom κληρονομεί από το `Blob`, οπότε ένα patch καλύπτει και τα δύο.
if (typeof global.Blob !== 'undefined' && typeof global.Blob.prototype.arrayBuffer !== 'function') {
  const readWith = (method) => function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader[method](this);
    });
  };
  global.Blob.prototype.arrayBuffer = readWith('readAsArrayBuffer');
  global.Blob.prototype.text = readWith('readAsText');
}

// ---------------------------------------------------------------------------
// fetch / Request / Response — ο Node 20 τα ΕΧΕΙ, το jsdom ΔΕΝ τα εκθέτει.
// ---------------------------------------------------------------------------
// Ίδιο μοτίβο με TextEncoder / CompressionStream / Blob από πάνω: δανείζονται από τον
// Node, **μόνο όταν λείπουν**. Μετρημένο σε καθαρό jsdom (2026-09-02): λείπουν
// `fetch`, `Request`, `Response` — το `Headers` **υπάρχει**, γι' αυτό δεν το αγγίζουμε
// (μάθημα του `Blob` από πάνω: αντικατάσταση υπάρχουσας κλάσης jsdom με του Node σπάει
// brand-checks).
//
// 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΤΟ ΕΠΙΒΑΛΛΕΙ, ΜΕ ΓΡΑΜΜΗ: το **node** build του `@firebase/auth`
// εκτελεί στο ΑΝΩΤΑΤΟ επίπεδο του module
//     FetchProvider.initialize(fetch, Headers, Response)     // dist/node/totp-*.js:7335
// — **γυμνά αναγνωριστικά, τη στιγμή της ΕΙΣΑΓΩΓΗΣ**. Άρα κάθε suite που εισάγει έστω
// **μεταβατικά** το `AuthContext` πέθαινε με `ReferenceError: fetch is not defined`
// **πριν** προλάβει να τρέξει οποιοδήποτε `jest.mock`. Αλυσίδα που το αποκάλυψε:
// `PublicSiteHeader → ShellUtilities → language-switcher → useLanguagePreference →
// AuthContext → firebase/auth`.
//
// ⚠️ ΓΙΑΤΙ ΟΧΙ `customExportConditions: ['browser']` — **ΔΟΚΙΜΑΣΤΗΚΕ, ΑΠΕΤΥΧΕ**: το
// `browser-cjs` build **δεν** έχει την top-level κλήση (0 εμφανίσεις, μετρημένο), αλλά
// ο resolver του jest δεν το διαλέγει· πέφτει στο `main: dist/node/index.js`. Ίδιο
// σφάλμα, byte προς byte.
//
// ⚠️ ΓΙΑΤΙ ΟΧΙ custom `testEnvironment`: **20 αρχεία** δηλώνουν `@jest-environment jsdom`
// σε docblock και **παρακάμπτουν** το `jest.config.js`. Το `setupFilesAfterEach` τρέχει
// για **όλα** — αυτό είναι το μόνο σημείο χωρίς τρύπα.
//
// ⚠️ ΓΙΑΤΙ ΟΧΙ `jest.mock('firebase/auth')` καθολικά: **75 suites** το γράφουν ήδη
// χειρόγραφα. Αυτό είναι το σύμπτωμα (N.18), όχι η θεραπεία — και ένα καθολικό mock θα
// έκρυβε τα πραγματικά exports από τις 6 suites που δοκιμάζουν τον ίδιο τον auth.
if (typeof global.fetch === 'undefined') {
  // Το realm του Node — από εκεί δανειζόμαστε. Το `undici` **δεν** είναι εγκατεστημένο
  // (μετρημένο: MODULE_NOT_FOUND), και δεν προσθέτουμε εξάρτηση για κάτι που ο Node
  // έχει ήδη.
  const nodeRealm = require('node:vm').runInThisContext('globalThis');

  // 🔑 ΤΟ `fetch` ΥΠΑΡΧΕΙ ΑΛΛΑ **ΑΡΝΕΙΤΑΙ** — και αυτό είναι ΣΚΟΠΙΜΟ, όχι ημιτελές.
  //
  // Η συνήθης απάντηση της βιομηχανίας («βάλε `cross-fetch` / `whatwg-fetch`») δίνει στα
  // unit tests **αληθινό δίκτυο**: αργά, ασταθή, και στο CI μπορούν να χτυπήσουν
  // πραγματικό endpoint. Το MSW το πολεμά, αλλά απαιτεί πειθαρχία **ανά suite** — δηλαδή
  // εξαρτάται από το να μην ξεχάσει κανείς. Εδώ η προεπιλογή είναι **άρνηση**: το `fetch`
  // ικανοποιεί κάθε έλεγχο δυνατότητας (`typeof fetch !== 'undefined'`) και κάθε
  // top-level capture, αλλά η **κλήση** του πετά με μήνυμα που λέει τι να κάνεις. Suite
  // που όντως χρειάζεται δίκτυο ορίζει το δικό της (27 το κάνουν ήδη) και **υπερισχύει**.
  global.fetch = function fetchRefusedInTests(input) {
    const target = typeof input === 'string' ? input : String(input && input.url);
    throw new Error(
      `[jest.setup] Το unit test προσπάθησε να κάνει ΠΡΑΓΜΑΤΙΚΟ δικτυακό αίτημα: ${target}
Τα unit tests δεν βγαίνουν στο δίκτυο. Όρισε τη δική σου απάντηση μέσα στη suite:
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });`,
    );
  };
  // Οι κλάσεις είναι **αληθινές** (του Node) — ένα ψεύτικο `Response` θα ήταν ψέμα που
  // περνά σιωπηλά. Μόνο η ΠΡΑΞΗ του δικτύου απαγορεύεται, όχι ο τύπος.
  if (typeof global.Response === 'undefined') global.Response = nodeRealm.Response;
  if (typeof global.Request === 'undefined') global.Request = nodeRealm.Request;
}

// Mock για Path2D (Canvas 2D API — not in jsdom)
class Path2DMock {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  closePath() {}
  addPath() {}
  rect() {}
  arc() {}
  ellipse() {}
}
global.Path2D = Path2DMock;

// Mock για ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock για IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock για performance.now
global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now())
};

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock Firebase για tests.
// `auth` exposes a no-op `onAuthStateChanged` (v8-compat method): modules that
// instantiate a singleton at import time (e.g. EnterpriseApiClient via
// dxf-level-mutation-gateway) call `auth.onAuthStateChanged(cb)` in their
// constructor under jsdom (window defined). Without it, importing any renderer
// that transitively pulls drawing-scale-store crashes the suite at load.
jest.mock('./src/lib/firebase', () => ({
  db: {},
  auth: {
    currentUser: null,
    onAuthStateChanged: () => () => {},
  },
  functions: {},
  storage: {},
  default: {}
}));

// Mock Firebase environment variables
process.env.FIREBASE_API_KEY = 'test-api-key';
process.env.FIREBASE_AUTH_DOMAIN = 'test-project.firebaseapp.com';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_STORAGE_BUCKET = 'test-project.appspot.com';
process.env.FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.FIREBASE_APP_ID = '1:123456789:web:abcdef123456';

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});