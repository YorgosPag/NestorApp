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

import type { SocialPlatform } from './social-media-type-vocabulary';

/** Κάθε πλατφόρμα εκτός του `other`, που από ορισμού δεν έχει ούτε όνομα ούτε πρότυπο. */
export type NamedSocialPlatform = Exclude<SocialPlatform, 'other'>;

interface SocialPlatformProfile {
  /** Το όνομα μάρκας — κύριο όνομα, ίδιο σε κάθε γλώσσα. */
  readonly brandName: string;
  /** URL προφίλ με το σύμβολο `{username}`. */
  readonly profileTemplate: string;
}

const USERNAME_TOKEN = '{username}';

/** ΥΠΟΧΡΕΩΤΙΚΑ κάθε πλατφόρμα της ρίζας: νέα πλατφόρμα χωρίς γραμμή εδώ = σφάλμα μεταγλώττισης. */
export const SOCIAL_PLATFORM_PROFILES = {
  linkedin: { brandName: 'LinkedIn', profileTemplate: 'https://linkedin.com/in/{username}' },
  facebook: { brandName: 'Facebook', profileTemplate: 'https://facebook.com/{username}' },
  instagram: { brandName: 'Instagram', profileTemplate: 'https://instagram.com/{username}' },
  twitter: { brandName: 'Twitter', profileTemplate: 'https://x.com/{username}' },
  youtube: { brandName: 'YouTube', profileTemplate: 'https://youtube.com/@{username}' },
  github: { brandName: 'GitHub', profileTemplate: 'https://github.com/{username}' },
  tiktok: { brandName: 'TikTok', profileTemplate: 'https://tiktok.com/@{username}' },
  // Το click-to-chat θέλει τον αριθμό σε διεθνή μορφή, ΜΟΝΟ ψηφία (χωρίς +, κενά, παύλες) — βλ. normaliseSocialHandle.
  whatsapp: { brandName: 'WhatsApp', profileTemplate: 'https://wa.me/{username}' },
  telegram: { brandName: 'Telegram', profileTemplate: 'https://t.me/{username}' },
} as const satisfies Readonly<Record<NamedSocialPlatform, SocialPlatformProfile>>;

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
