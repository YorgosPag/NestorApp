/**
 * =============================================================================
 * NEXT.JS EDGE MIDDLEWARE — Request Optimization & Bot Protection
 * =============================================================================
 *
 * Runs at the Edge BEFORE any page/API route is invoked.
 * Primary goals:
 *   1. Block known bots/crawlers that waste Edge Requests
 *   2. Block common vulnerability scanners (wp-admin, .env, etc.)
 *   3. Add security headers to all responses
 *   4. Cache-Control for static public assets
 *
 * @module middleware
 * @see ADR-217 Vercel Edge Request Optimization
 *
 * IMPORTANT: This file runs on Vercel Edge Runtime — keep it lightweight.
 * No Node.js APIs, no heavy imports, no Firestore/Firebase.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 🔴 **ΟΧΙ `redirectTo` ΕΔΩ** — αυτό είναι Edge. Ο προσαρμογέας του middleware περνά
//    κάθε `Location` μέσα από `new NextURL(loc)` **χωρίς base** (`adapter.js:340`) και
//    **πετά** στο σχετικό ⇒ 500 σε κάθε `/o/me/*` (μετρημένο στην παραγωγή 2026-09-12).
//    Ο `redirectFromMiddleware` ονομάζει το σπίτι μας από τη **δηλωμένη** ταυτότητα —
//    ποτέ από το `request.url`, που πίσω από τον proxy είναι `0.0.0.0:3000` (ADR-819).
import { redirectFromMiddleware } from '@/lib/http/request-origin';
// 🔑 ADR-787 §5.3 ζ (όριο 1) — το κλειστό σύνολο «τι προσφέρει ο ιδιωτικός χώρος» και η
//    προσγείωσή του. Καθαρές σταθερές, μηδέν I/O: εκτελέσιμο στο Edge (το middleware
//    δηλώνει ρητά «no Firestore/Firebase»).
import { personalWorkspaceLanding } from '@/lib/workspace/personal-workspace-surface';
import { EMAIL_SUBSCRIPTION_API } from '@/lib/notifications/email-subscription-routes';
import { withRequestPath } from '@/lib/http/request-path';

// ============================================================================
// BOT & SCANNER DETECTION
// ============================================================================

/**
 * User-Agent substrings for known bots that waste Edge Requests.
 * Google/Bing bots are handled by robots.txt but some ignore it.
 * Vulnerability scanners always ignore robots.txt.
 */
const BLOCKED_BOT_PATTERNS: readonly string[] = [
  // Search engine crawlers (robots.txt should handle, but double-check)
  'googlebot',
  'bingbot',
  'yandexbot',
  'baiduspider',
  'duckduckbot',
  'slurp',        // Yahoo
  'ia_archiver',  // Alexa
  'sogou',
  'exabot',
  'facebot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'applebot',

  // SEO/Marketing crawlers
  'semrushbot',
  'ahrefsbot',
  'mj12bot',      // Majestic
  'dotbot',       // Moz
  'rogerbot',
  'screaming frog',
  'seokicks',
  'sistrix',
  'blexbot',
  'petalbot',     // Huawei
  'bytespider',   // TikTok/ByteDance

  // Vulnerability scanners
  'nmap',
  'nikto',
  'sqlmap',
  'masscan',
  'zgrab',
  'censys',
  'shodan',

  // Generic bot patterns
  'crawl',
  'spider',
  'bot/',
  'headlesschrome',
  'phantomjs',
  'python-requests',
  'python-urllib',
  'java/',
  'libwww-perl',
  'wget',
  'curl/',
  'httpie',
  'go-http-client',
  'axios/',
  'node-fetch',
];

/**
 * Paths targeted by vulnerability scanners — immediate 404.
 * These paths NEVER exist in our app but generate thousands of requests.
 */
const SCANNER_PATHS: readonly string[] = [
  '/wp-admin',
  '/wp-login',
  '/wp-content',
  '/wp-includes',
  '/wordpress',
  '/.env',
  '/.git',
  '/.svn',
  '/phpmyadmin',
  '/pma',
  '/admin.php',
  '/xmlrpc.php',
  '/config.php',
  '/install.php',
  '/setup.php',
  '/administrator',
  '/joomla',
  '/drupal',
  '/magento',
  '/cgi-bin',
  '/shell',
  '/cmd',
  '/eval',
  '/phpinfo',
  '/test.php',
  '/info.php',
  '/debug',
  '/.well-known/security.txt',
  '/.DS_Store',
  '/backup',
  '/db',
  '/database',
  '/dump',
  '/sql',
  '/mysql',
];

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/** Security headers applied to all responses (Google/OWASP best practices) */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=()',
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = (request.headers.get('user-agent') ?? '').toLowerCase();

  // ── 0. Routing safety guard: literal Next.js template placeholders ──
  // Catches stale browser tabs / Turbopack hot-reload edge cases where the URL
  // contains a literal [id], [rfqId], etc. (URL-encoded as %5Bxxx%5D).
  // Server Component redirect() returns 200 in dev/Turbopack — middleware 307
  // is the only guarantee that fetches never fire with id='[id]'.
  const decodedPath = decodeURIComponent(pathname);
  if (/\/\[[^/\]]+\]/.test(decodedPath)) {
    const parentPath = decodedPath.replace(/\/\[[^/\]]+\].*$/, '') || '/';
    // 🔴 **ΤΟ `Location` ΧΤΙΖΕΤΑΙ ΑΠΟ ΤΗ ΔΗΛΩΜΕΝΗ ΤΑΥΤΟΤΗΤΑ** — δες
    //    `lib/http/request-origin.ts`: **ποτέ** από το `request.url`, που πίσω από τον
    //    proxy του Netcup φέρει το `HOSTNAME` του container (`0.0.0.0:3000`), όχι το
    //    `nestorconstruct.gr`. Στο Edge το απόλυτο είναι **υποχρεωτικό** (ο adapter
    //    αναλύει το `Location`)· το σχετικό εδώ έδινε **500**, όχι ανακατεύθυνση.
    return redirectFromMiddleware(request, parentPath, 307);
  }

  // ── 0β. Ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΔΕΝ ΦΟΡΑ ΤΟ ΚΕΛΥΦΟΣ ΤΟΥ ΓΡΑΦΕΙΟΥ ──
  //
  // 🔴 ADR-787 §5.3 ζ (όριο 1): το `/o/me/<τομέας>` απέδιδε σελίδα γραφείου μέσα στον
  //    **ιδιωτικό** χώρο — μετρημένο ζωντανά, το `/o/me/projects` έδειξε «Έργα (7)». Το
  //    σύνορο του API αρνείται πλέον fail-closed, αλλά **66 αρχεία** του πελάτη καλούν ωμό
  //    `fetch('/api/…')` χωρίς να δηλώνουν χώρο (Φάση Β) — άρα η σελίδα **δεν πρέπει να
  //    ανοίξει καθόλου**. Η απόφαση ζει σε **ένα** σημείο, με κλειστό σύνολο εξαιρέσεων.
  //
  // ⚠️ **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ LAYOUT**: το `o/[workspace]/layout.tsx` **δεν γνωρίζει τη
  //    διαδρομή** του αιτήματος (δηλωμένο όριο, ADR-848 §9 #3) — ξέρει μόνο το ψευδώνυμο.
  //    Και ένα συστατικό πελάτη μέσα στο layout θα έβαζε **νέα οικογένεια κειμένου στο
  //    κέλυφος**: ο γεννήτορας του CHECK 3.34 το μπλόκαρε, μετρημένα, ως «9 key-sliced
  //    namespaces έναντι σφραγισμένων 8 — μόνο συρρικνώνεται», δηλαδή κόστος σε ~150
  //    διαδρομές για οθόνη που σχεδόν κανείς δεν βλέπει.
  //
  // ⚠️ **307 και όχι 308**, ίδιος λόγος με το δίχτυ του §5.3 ιβ: ο προορισμός εξαρτάται από
  //    το **ποιος** ρωτά (και το σύνολο αλλάζει), άρα cacheable μόνιμη ανακατεύθυνση θα
  //    κλείδωνε την απάντηση στον φυλλομετρητή.
  //
  // ⛔ **ΔΕΝ κρίνεται εδώ καμία ιδιότητα μέλους** — δες τον γραμμένο λόγο στο
  //    `personal-workspace-surface.ts`: το `me` δεν αντιστοιχεί σε εταιρεία, και η μόνη
  //    απάντηση αυτού του κανόνα είναι **άρνηση**. Την ταυτότητα τη φυλά το layout.
  const personalLanding = personalWorkspaceLanding(pathname);
  if (personalLanding !== null) {
    return redirectFromMiddleware(request, personalLanding, 307);
  }

  // ── 1. Block vulnerability scanner paths (immediate 404) ──
  const isScanner = SCANNER_PATHS.some((scanPath) =>
    pathname.toLowerCase().startsWith(scanPath)
  );
  if (isScanner) {
    return new NextResponse(null, { status: 404 });
  }

  // ── 2. Block known bots (403 Forbidden) ──
  // Exception: Allow webhook callbacks (Mailgun, Telegram, etc.)
  //
  // ⚠️ ADR-738: **και** τα μηχανικά σύνορα (MCP transport + OAuth). Η λίστα
  // BLOCKED_BOT_PATTERNS περιέχει `node-fetch`, `axios/`, `go-http-client`,
  // `python-requests` και `curl/` — δηλαδή ακριβώς τους user-agents που στέλνει
  // κάθε MCP client και κάθε δοκιμή με curl. Χωρίς αυτή την εξαίρεση το
  // endpoint θα επέστρεφε **403 από το Edge**, πριν καν τρέξει ο κώδικάς του:
  // ένα σφάλμα που μοιάζει με «λάθος διαπιστευτήρια» και δεν είναι.
  // Δεν χαλαρώνει τίποτα — αυτά τα paths έχουν δική τους ταυτοποίηση
  // (Bearer token + audience) και δικό τους rate limit.
  // ⚠️ Το `/api/cron/oauth-cleanup` μπαίνει **ονομαστικά**, όχι ως `/api/cron` — και
  // ΠΑΡΑΜΕΝΕΙ έτσι σκόπιμα (ADR-740). Τα cron **δεν** χρειάζονται εξαίρεση εδώ: ο
  // χρονοπρογραμματιστής χτυπά μόνο το `/api/cron/dispatch` με **ρητό** user-agent
  // (`nestor-scheduler/…`) που δεν ταιριάζει σε κανένα BLOCKED_BOT_PATTERN, και από εκεί
  // τα jobs καλούνται **ως συναρτήσεις** — δεν ξαναπερνούν ποτέ από HTTP, άρα ούτε από
  // αυτόν τον έλεγχο. Άνοιγμα του `/api/cron` συνολικά θα εξέθετε δημόσια endpoints
  // οριστικής διαγραφής με μόνη άμυνα το `CRON_SECRET`· δεν υπάρχει λόγος να γίνει.
  // (Το `oauth-cleanup` κρατά την ονομαστική εξαίρεση για χειροκίνητη δοκιμή — ADR-738 §10.)
  //
  // 🔴 ADR-848 — **και η διαγραφή ενός κλικ (RFC 8058)**. Το POST του «Κατάργηση
  // εγγραφής» το στέλνει η **υποδομή** του Gmail/Outlook/Yahoo, όχι φυλλομετρητής, με
  // user-agent που μπορεί να ταιριάξει σε BLOCKED_BOT_PATTERNS. Χωρίς την εξαίρεση: 403
  // από το Edge, ο άνθρωπος πιστεύει ότι διαγράφηκε, τα email **συνεχίζουν** — και η
  // επόμενη κίνησή του είναι «Αναφορά ως ανεπιθύμητο», μετρημένη εναντίον του domain.
  // Δεν χαλαρώνει τίποτα: το endpoint δέχεται μόνο POST με υπογεγραμμένο token και έχει
  // δικό του όριο ρυθμού (`WEBHOOK`).
  //
  // 🔴 ADR-835 §22 — **ΚΑΙ ΤΟ FEED ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ (iCal)**. Αυτό το endpoint το
  // διαβάζουν **μηχανές καναλιών** (Airbnb · Vrbo · Google Calendar · PMS), και οι
  // δημοσκόποι τους στέλνουν ακριβώς τους user-agents της λίστας (`python-requests`,
  // `go-http-client`, `axios/`, `java/`, `curl/`).
  //
  // ⚠️ **ΜΕΤΡΗΜΕΝΟ ΣΕ ΖΩΝΤΑΝΗ ΔΟΚΙΜΗ (2026-09-17)**: χωρίς αυτή τη γραμμή το feed
  // απαντούσε **403 από το Edge** — πριν καν τρέξει ο κώδικάς του. Και η βλάβη είναι
  // **ασύμμετρη**: το κανάλι δεν δείχνει «403» στον οικοδεσπότη· δείχνει «δεν
  // συγχρονίστηκε», ή σιωπά — δηλαδή οι κρατήσεις μας **δεν** φτάνουν εκεί και το
  // κανάλι πουλά τις **ίδιες** νύχτες. Καμία δοκιμή jest δεν μπορούσε να το δει: το
  // middleware δεν τρέχει σε jest.
  //
  // Δεν χαλαρώνει τίποτα: η διαδρομή έχει **δική της** ταυτοποίηση (υπογραφή HMAC με
  // την εμβέλεια και τη γενιά μέσα της — πλαστό token απορρίπτεται χωρίς καμία
  // ανάγνωση βάσης) και **δικό της** όριο ρυθμού (`HIGH`).
  const isMachineEndpoint =
    pathname.startsWith('/api/communications/webhooks') ||
    pathname.startsWith('/api/mcp') ||
    pathname.startsWith('/api/oauth') ||
    pathname.startsWith('/api/cron/oauth-cleanup') ||
    pathname.startsWith('/api/stay-ical') ||
    pathname.startsWith(EMAIL_SUBSCRIPTION_API) ||
    pathname.startsWith('/.well-known/oauth-');

  if (!isMachineEndpoint && userAgent) {
    const isBot = BLOCKED_BOT_PATTERNS.some((pattern) =>
      userAgent.includes(pattern)
    );
    if (isBot) {
      return new NextResponse(null, { status: 403 });
    }
  }

  // ── 3. Apply security headers + continue ──
  // 🔑 ADR-848 §9 #3 · ADR-875 §14 — η διαδρομή ταξιδεύει ως κεφαλίδα ΑΙΤΗΜΑΤΟΣ, γιατί
  //    το layout του `/o/[workspace]` δεν τη βλέπει και χωρίς αυτήν ο ανώνυμος χάνει
  //    την επιστροφή του (`server/auth/login-return.ts`). `set` ⇒ πλαστή τιμή από έξω
  //    δεν επιβιώνει.
  const response = NextResponse.next({ request: { headers: withRequestPath(request) } });

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // ── 4. Cache headers for public static assets ──
  if (pathname.startsWith('/images/') || pathname.startsWith('/fonts/')) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=31536000, immutable'
    );
  }

  return response;
}

// ============================================================================
// MATCHER — Only run middleware on relevant paths
// ============================================================================

/**
 * Matcher config — skip middleware for paths that don't need it.
 * This REDUCES Edge Request overhead by not running middleware on static files.
 *
 * Pattern: Run on everything EXCEPT Next.js internals and static files.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization API)
     * - favicon.ico
     * - Static file extensions (.svg, .png, .jpg, .ico, .txt, .xml, .json, .mjs)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|mjs|js|css|woff|woff2|ttf|eot)$).*)',
  ],
};
