/**
 * @fileoverview **ΕΝΑ μητρώο προφίλ πλατφόρμας social** (ADR-327 §8.5.4) — όνομα μάρκας + πρότυπο URL.
 * @related lib/contact/social-platform-profiles.ts · contacts/dynamic/communication/utils/socialUrlGenerator.ts
 *
 * 🔴 Το πρότυπο ζούσε σε τρία σημεία που διαφωνούσαν (`x.com` vs `twitter.com`, 7 vs 6 πλατφόρμες). Η φόρμα επαφής
 * προσέφερε `whatsapp`/`telegram`, αλλά ο χτίστης της έδινε κενό URL γι' αυτά.
 *
 * | # | Άγκυρα | Μετάλλαξη που τη ρίχνει |
 * |---|---|---|
 * | Π1 | η φόρμα χτίζει URL για ΚΑΘΕ πλατφόρμα της ρίζας εκτός `other` | ο χτίστης με δικό του πίνακα |
 * | Π2 | `other` / κενό όνομα ⇒ τίποτα | `if (platform === 'other')` αφαιρείται |
 */

import { SOCIAL_PLATFORMS } from '@/lib/contact/social-media-type-vocabulary';
import { buildSocialProfileUrl, socialPlatformBrandName } from '@/lib/contact/social-platform-profiles';
import { generateSocialUrl } from '@/components/contacts/dynamic/communication/utils/socialUrlGenerator';

const NAMED = SOCIAL_PLATFORMS.filter(p => p !== 'other');

describe('Π1 — κάθε πλατφόρμα της ρίζας έχει προφίλ', () => {
  it.each(NAMED.map(p => [p]))('🔴 %s ⇒ η φόρμα χτίζει URL και υπάρχει όνομα μάρκας', (platform) => {
    expect(generateSocialUrl(platform, '12345')).toMatch(/^https:\/\/\S+12345$/);
    expect(socialPlatformBrandName(platform)).toBeTruthy();
  });
});

describe('Π2 — παρονομαστής: τίποτα να χτιστεί', () => {
  it('🔑 `other` ⇒ ούτε URL ούτε όνομα', () => {
    expect(buildSocialProfileUrl('other', 'beta')).toBeUndefined();
    expect(socialPlatformBrandName('other')).toBeUndefined();
    expect(generateSocialUrl('other', 'beta')).toBe('');
  });

  it('🔑 κενό όνομα μετά την κανονικοποίηση ⇒ τίποτα', () => {
    expect(buildSocialProfileUrl('github', '  @ ')).toBeUndefined();
    expect(buildSocialProfileUrl('whatsapp', 'όχι αριθμός')).toBeUndefined();
  });
});
