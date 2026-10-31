/**
 * 💬 SSoT — **ταυτότητα κάθε πλατφόρμας social**: όνομα μάρκας και πρότυπο URL προφίλ από όνομα χρήστη.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-30, ADR-327 §8.5.4)**: το πρότυπο URL προφίλ ζούσε σε **τρία** σημεία που διαφωνούσαν —
 * `socialUrlGenerator` (7 πλατφόρμες, `x.com`), `UNIFIED_SOCIAL_PLATFORMS` (7, `x.com`) και το branding της εταιρείας
 * (6, `twitter.com`) — και το όνομα μάρκας σε άλλα δύο. Το branding δεν ήξερε `tiktok`/`whatsapp`/`telegram` και τα
 * έγραφε `other` ⇒ λογαριασμός με μόνο όνομα χρήστη **χανόταν** από τη βιτρίνα και το email.
 *
 * Καθαρά δεδομένα, χωρίς React — το διαβάζουν και ο server (branding, email) και ο client (φόρμα, κοινοποίηση).
 * Τα **εικονίδια** μένουν στο `UNIFIED_SOCIAL_PLATFORMS` (client).
 *
 * @module lib/contact/social-platform-profiles
 */

import { SOCIAL_PLATFORMS, type SocialPlatform } from './social-media-type-vocabulary';

/** Κάθε πλατφόρμα εκτός του `other`, που από ορισμού δεν έχει ούτε όνομα ούτε πρότυπο. */
export type NamedSocialPlatform = Exclude<SocialPlatform, 'other'>;

interface SocialPlatformProfile {
  /** Το όνομα μάρκας — κύριο όνομα, ίδιο σε κάθε γλώσσα. */
  readonly brandName: string;
  /** URL προφίλ με το σύμβολο `{username}`. */
  readonly profileTemplate: string;
  /**
   * Οι τομείς της πλατφόρμας (ο κανονικός πρώτα, μετά οι σύντομοι/παλαιοί). Ένα URL ανήκει στην πλατφόρμα όταν ο
   * host του **είναι** ένας από αυτούς ή **υποτομέας** του — ΠΟΤΕ υποσυμβολοσειρά (`wix.com` ∌ `x.com`).
   */
  readonly hosts: readonly string[];
}

const USERNAME_TOKEN = '{username}';

/** ΥΠΟΧΡΕΩΤΙΚΑ κάθε πλατφόρμα της ρίζας: νέα πλατφόρμα χωρίς γραμμή εδώ = σφάλμα μεταγλώττισης. */
export const SOCIAL_PLATFORM_PROFILES = {
  linkedin: { brandName: 'LinkedIn', profileTemplate: 'https://linkedin.com/in/{username}', hosts: ['linkedin.com', 'lnkd.in'] },
  facebook: { brandName: 'Facebook', profileTemplate: 'https://facebook.com/{username}', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  instagram: { brandName: 'Instagram', profileTemplate: 'https://instagram.com/{username}', hosts: ['instagram.com', 'instagr.am'] },
  twitter: { brandName: 'Twitter', profileTemplate: 'https://x.com/{username}', hosts: ['x.com', 'twitter.com'] },
  youtube: { brandName: 'YouTube', profileTemplate: 'https://youtube.com/@{username}', hosts: ['youtube.com', 'youtu.be'] },
  github: { brandName: 'GitHub', profileTemplate: 'https://github.com/{username}', hosts: ['github.com'] },
  tiktok: { brandName: 'TikTok', profileTemplate: 'https://tiktok.com/@{username}', hosts: ['tiktok.com'] },
  // Το click-to-chat θέλει τον αριθμό σε διεθνή μορφή, ΜΟΝΟ ψηφία (χωρίς +, κενά, παύλες) — βλ. normaliseSocialHandle.
  whatsapp: { brandName: 'WhatsApp', profileTemplate: 'https://wa.me/{username}', hosts: ['wa.me', 'whatsapp.com'] },
  telegram: { brandName: 'Telegram', profileTemplate: 'https://t.me/{username}', hosts: ['t.me', 'telegram.me', 'telegram.org'] },
} as const satisfies Readonly<Record<NamedSocialPlatform, SocialPlatformProfile>>;

/** Κάθε πλατφόρμα με προφίλ, με τη σειρά της ρίζας — χωρίς τυφλό `as` πάνω στο `Object.keys`. */
const NAMED_SOCIAL_PLATFORMS = SOCIAL_PLATFORMS.filter((p): p is NamedSocialPlatform => p !== 'other');

/** Ο host σε κανονική μορφή (πεζά — το `URL` το κάνει ήδη — χωρίς τελική τελεία FQDN)· `null` αν δεν είναι URL. */
function hostnameOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.replace(/\.$/, '') || null;
  } catch {
    return null;
  }
}

/**
 * 🔍 Η ΜΙΑ ανίχνευση πλατφόρμας από URL (ADR-327 §8.5.4) — από τους `hosts` του μητρώου, όχι από χειρόγραφη λίστα.
 *
 * 🔴 Ζούσε σε ΔΥΟ σώματα (`socialUrlGenerator` 7 πλατφόρμες · `platform-utils` 9) με `hostname.includes(…)` ⇒
 * `wix.com`/`dropbox.com` αναγνωρίζονταν ως Twitter και `chat.me` ως Telegram. Νέα πλατφόρμα στη ρίζα χωρίς `hosts`
 * = σφάλμα μεταγλώττισης, άρα δεν μένει ποτέ αόρατη στην ανίχνευση.
 */
export function detectPlatformFromUrl(url: string): NamedSocialPlatform | null {
  const host = url ? hostnameOf(url) : null;
  if (!host) return null;
  const owns = (domain: string): boolean => host === domain || host.endsWith(`.${domain}`);
  return NAMED_SOCIAL_PLATFORMS.find(platform => SOCIAL_PLATFORM_PROFILES[platform].hosts.some(owns)) ?? null;
}

/** Το όνομα χρήστη όπως μπαίνει στο URL: χωρίς κενά και αρχικό `@`· για WhatsApp μόνο ψηφία. */
export function normaliseSocialHandle(platform: SocialPlatform, handle: string): string {
  const trimmed = handle.trim().replace(/^@+/, '');
  return platform === 'whatsapp' ? trimmed.replace(/\D/g, '') : trimmed;
}

/** URL προφίλ από όνομα χρήστη· `undefined` για `other` ή κενό όνομα (δεν υπάρχει τίποτα να χτιστεί). */
export function buildSocialProfileUrl(platform: SocialPlatform, handle: string): string | undefined {
  if (platform === 'other') return undefined;
  const clean = normaliseSocialHandle(platform, handle);
  return clean ? SOCIAL_PLATFORM_PROFILES[platform].profileTemplate.replace(USERNAME_TOKEN, clean) : undefined;
}

/** Το όνομα μάρκας· `undefined` για `other`, ώστε ο καλών να αποφασίσει τη δική του ετικέτα. */
export function socialPlatformBrandName(platform: SocialPlatform): string | undefined {
  return platform === 'other' ? undefined : SOCIAL_PLATFORM_PROFILES[platform].brandName;
}
