/**
 * @fileoverview **ΜΙΑ ανίχνευση πλατφόρμας social από URL** (ADR-327 §8.5.4).
 * @related lib/contact/social-platform-profiles.ts · lib/social-platform-system/platform-utils.ts
 *
 * 🔴 Ζούσε σε ΔΥΟ σώματα (`socialUrlGenerator` 7 πλατφόρμες · `platform-utils` 9) — συν τρίτο, νεκρό, στο catch του
 * `findPlatformFromPartialUrl` — όλα με `hostname.includes(…)` ⇒ `wix.com` / `dropbox.com` = Twitter, `chat.me` =
 * Telegram. Και ΤΡΙΑ `export type SocialPlatform =` με τρία σύνολα (ρίζα · κανάλια κοινοποίησης με `email` · κλειδιά hover).
 *
 * | # | Άγκυρα | Μετάλλαξη που τη ρίχνει |
 * |---|---|---|
 * | Δ1 | το URL προφίλ ΚΑΘΕ πλατφόρμας του μητρώου ανιχνεύεται ως αυτή | χειρόγραφη λίστα που ξεχνά πλατφόρμα |
 * | Δ2 | υποτομείς + σύντομοι τομείς ανιχνεύονται | `host === domain` χωρίς `.endsWith` |
 * | Δ3 | host που απλώς ΠΕΡΙΕΧΕΙ τομέα ⇒ `null` (η κλάση) | `host.includes(domain)` |
 * | Δ4 | κάθε host ανήκει σε ΜΙΑ πλατφόρμα · ο κανονικός = host του προτύπου | διπλή δήλωση τομέα |
 * | Δ5 | ΕΝΑΣ ορισμός `detectPlatformFromUrl` · ΕΝΑ `export type SocialPlatform =` στο `src/` | δεύτερο σώμα / ομώνυμο |
 */

import * as fs from 'fs';
import * as path from 'path';
import { SOCIAL_PLATFORMS } from '@/lib/contact/social-media-type-vocabulary';
import { SOCIAL_PLATFORM_PROFILES, buildSocialProfileUrl, detectPlatformFromUrl } from '@/lib/contact/social-platform-profiles';
import { detectPlatformFromUrl as detectViaPlatformSystem } from '@/lib/social-platform-system/platform-utils';
import { ProfileService } from '@/lib/social-platform-system/profile-service';

const NAMED = SOCIAL_PLATFORMS.filter((p): p is Exclude<typeof p, 'other'> => p !== 'other');

describe('Δ1 — το URL προφίλ κάθε πλατφόρμας του μητρώου ανιχνεύεται ως αυτή', () => {
  it.each(NAMED.map(p => [p]))('🔴 %s', (platform) => {
    const url = buildSocialProfileUrl(platform, '12345');
    expect(url).toBeDefined();
    expect(detectPlatformFromUrl(url ?? '')).toBe(platform);
  });

  it('🔑 το σύστημα κοινοποίησης ζητά την ΙΔΙΑ συνάρτηση (όχι αντίγραφο)', () => {
    expect(detectViaPlatformSystem).toBe(detectPlatformFromUrl);
  });

  it('🔑 μερικό URL χωρίς σχήμα (ProfileService) περνά από την ίδια ανίχνευση', () => {
    expect(ProfileService.findPlatformFromPartialUrl('www.linkedin.com/in/jane')).toBe('linkedin');
    expect(ProfileService.findPlatformFromPartialUrl('wix.com/site')).toBeNull();
  });
});

describe('Δ2 — υποτομείς και σύντομοι τομείς', () => {
  it.each([
    ['https://www.linkedin.com/in/jane', 'linkedin'],
    ['https://gr.linkedin.com/in/jane', 'linkedin'],
    ['https://lnkd.in/abc', 'linkedin'],
    ['https://m.facebook.com/jane', 'facebook'],
    ['https://fb.me/jane', 'facebook'],
    ['https://twitter.com/jane', 'twitter'],
    ['https://mobile.x.com/jane', 'twitter'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.youtube.com/@jane', 'youtube'],
    ['https://api.whatsapp.com/send?phone=30', 'whatsapp'],
    ['https://telegram.me/jane', 'telegram'],
    ['HTTPS://WWW.GITHUB.COM/Jane', 'github'],
    ['https://github.com./jane', 'github'],
  ])('🔴 %s ⇒ %s', (url, platform) => {
    expect(detectPlatformFromUrl(url)).toBe(platform);
  });
});

describe('Δ3 — η ΚΛΑΣΗ: host που απλώς περιέχει τομέα ΔΕΝ είναι η πλατφόρμα', () => {
  it.each([
    'https://wix.com/site',
    'https://www.dropbox.com/s/abc',
    'https://box.com/file',
    'https://chat.me/room',
    'https://notlinkedin.com/in/jane',
    'https://linkedin.com.evil.io/in/jane',
    'https://fakegithub.com/jane',
    'https://example.com/?u=https://facebook.com/jane',
  ])('🔴 %s ⇒ null', (url) => {
    expect(detectPlatformFromUrl(url)).toBeNull();
  });

  it.each(['', '   ', 'not a url', 'linkedin.com/in/jane'])('🔑 μη URL «%s» ⇒ null', (value) => {
    expect(detectPlatformFromUrl(value)).toBeNull();
  });
});

describe('Δ4 — το μητρώο τομέων είναι συνεπές', () => {
  it('🔴 κάθε host ανήκει σε ΜΙΑ πλατφόρμα', () => {
    const owners = new Map<string, string[]>();
    for (const platform of NAMED) {
      for (const host of SOCIAL_PLATFORM_PROFILES[platform].hosts) owners.set(host, [...(owners.get(host) ?? []), platform]);
    }
    expect([...owners].filter(([, list]) => list.length > 1)).toEqual([]);
  });

  it.each(NAMED.map(p => [p]))('🔴 %s: ο πρώτος (κανονικός) host είναι ο host του προτύπου προφίλ', (platform) => {
    const profile = SOCIAL_PLATFORM_PROFILES[platform];
    expect(new URL(profile.profileTemplate.replace('{username}', 'u')).hostname).toBe(profile.hosts[0]);
  });
});

// ============================================================================
// Δ5 — ΔΟΜΙΚΗ: δεύτερο σώμα / δεύτερο ομώνυμο = ΜΗ ΕΚΦΡΑΣΙΜΟ χωρίς κόκκινο
// ============================================================================

const SRC_ROOT = path.join(process.cwd(), 'src');
const DETECTOR_HOME = 'lib/contact/social-platform-profiles.ts';
const PLATFORM_TYPE_HOME = 'lib/contact/social-media-type-vocabulary.ts';
/** Ορισμός (όχι κλήση, όχι re-export): `function detectPlatformFromUrl` ή `const detectPlatformFromUrl =`. */
const DEFINES_DETECTOR = /\b(?:function\s+detectPlatformFromUrl\b|(?:const|let|var)\s+detectPlatformFromUrl\s*[:=])/;
const DECLARES_PLATFORM_TYPE = /\bexport\s+type\s+SocialPlatform\s*=/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const relOf = (full: string): string => path.relative(SRC_ROOT, full).split(path.sep).join('/');

describe('Δ5 — ΕΝΑ σώμα ανίχνευσης, ΕΝΑ όνομα τύπου πλατφόρμας', () => {
  const files = sourceFiles(SRC_ROOT);
  const matching = (pattern: RegExp): string[] =>
    files.filter(f => pattern.test(fs.readFileSync(f, 'utf8'))).map(relOf).sort();

  it('🔑 μη-κενότητα: η σάρωση είδε το δέντρο (άδεια σάρωση ≠ «καθαρό»)', () => {
    expect(files.length).toBeGreaterThan(1000);
    expect(files.map(relOf)).toEqual(expect.arrayContaining([DETECTOR_HOME, PLATFORM_TYPE_HOME]));
  });

  it('🔴 ΕΝΑΣ ορισμός `detectPlatformFromUrl`, στο μητρώο ταυτότητας', () => {
    expect(matching(DEFINES_DETECTOR)).toEqual([DETECTOR_HOME]);
  });

  it('🔴 ΕΝΑ `export type SocialPlatform =`, στη ρίζα του λεξιλογίου', () => {
    expect(matching(DECLARES_PLATFORM_TYPE)).toEqual([PLATFORM_TYPE_HOME]);
  });
});
