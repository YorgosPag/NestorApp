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
    return NextResponse.redirect(new URL(parentPath, request.url), 307);
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
  const isWebhook = pathname.startsWith('/api/communications/webhooks');
  if (!isWebhook && userAgent) {
    const isBot = BLOCKED_BOT_PATTERNS.some((pattern) =>
      userAgent.includes(pattern)
    );
    if (isBot) {
      return new NextResponse(null, { status: 403 });
    }
  }

  // ── 3. Apply security headers + continue ──
  const response = NextResponse.next();

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
