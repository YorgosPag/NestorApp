/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΛΑΤΦΟΡΜΑ SOCIAL ΤΗΣ ΕΤΑΙΡΕΙΑΣ ΦΤΑΝΕΙ ΑΥΤΟΥΣΙΑ ΣΤΗ ΒΙΤΡΙΝΑ ΚΑΙ ΣΤΟ EMAIL** (ADR-327 §8.5.4).
 * @related services/company/company-branding-resolver.ts · lib/contact/social-platform-profiles.ts
 *
 * 🔴 **Το σφάλμα (2026-10-30)**: ο resolver κρατούσε δικό του υποσύνολο 7 πλατφορμών και έκανε
 * `tiktok`/`whatsapp`/`telegram` ⇒ `other`. Λογαριασμός με μόνο όνομα χρήστη **χανόταν** (το `other` δεν έχει
 * πρότυπο URL), και με URL έβγαινε με γενικό εικονίδιο. Το Twitter χτιζόταν σε `twitter.com`, οι άλλοι δύο
 * χτίστες σε `x.com`.
 *
 * | # | Άγκυρα | Μετάλλαξη που τη ρίχνει |
 * |---|---|---|
 * | Β1 | κάθε πλατφόρμα της ρίζας κρατιέται αυτούσια | `isSocialPlatform(v)` → τοπικό υποσύνολο |
 * | Β2 | όνομα χρήστη ⇒ URL από το ΕΝΑ μητρώο (x.com · wa.me μόνο ψηφία) | πρότυπο/κανονικοποίηση αλλού |
 * | Β3 | άγνωστη πλατφόρμα ⇒ `other`· χωρίς URL ⇒ εκτός λίστας | `?? 'other'` → πέταγμα |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { SOCIAL_PLATFORMS } from '@/lib/contact/social-media-type-vocabulary';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';

const COMPANY = 'comp_branding_social';

async function socialsOf(socialMedia: ReadonlyArray<Record<string, unknown>>) {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.COMPANIES, COMPANY, { name: 'ΒΗΤΑ ΑΕ', socialMedia });
  const branding = await resolveShowcaseCompanyBranding({
    adminDb: fake as unknown as AdminFirestore,
    propertyData: {},
    companyId: COMPANY,
    brandingSource: 'tenant',
  });
  return branding.socialMedia ?? [];
}

describe('Β1 — κάθε πλατφόρμα της ρίζας κρατιέται αυτούσια', () => {
  it.each(SOCIAL_PLATFORMS.map(p => [p]))('🔴 %s ⇒ η ίδια πλατφόρμα, όχι `other`', async (platform) => {
    const [social] = await socialsOf([{ platform, url: `https://example.com/${platform}` }]);
    expect(social.platform).toBe(platform);
  });

  it('🔑 η κεφαλαιοποίηση της βάσης δεν αλλάζει την πλατφόρμα', async () => {
    const [social] = await socialsOf([{ platform: 'TikTok', url: 'https://tiktok.com/@beta' }]);
    expect(social.platform).toBe('tiktok');
  });
});

describe('Β2 — όνομα χρήστη χωρίς URL ⇒ URL από το ΕΝΑ μητρώο', () => {
  it.each([
    ['tiktok', '@beta.ae', 'https://tiktok.com/@beta.ae', 'beta.ae'],
    ['telegram', 'beta_ae', 'https://t.me/beta_ae', 'beta_ae'],
    ['whatsapp', '+30 690-000 0000', 'https://wa.me/306900000000', '306900000000'],
    ['twitter', 'beta', 'https://x.com/beta', 'beta'],
  ])('🔴 %s «%s» ⇒ %s', async (platform, username, url, handle) => {
    const socials = await socialsOf([{ platform, username }]);
    expect(socials).toEqual([{ platform, url, username: handle }]);
  });
});

describe('Β3 — παρονομαστής: άγνωστο και ανεπαρκές', () => {
  it('🔑 άγνωστη πλατφόρμα με URL ⇒ `other`, με το URL αυτούσιο', async () => {
    const socials = await socialsOf([{ platform: 'mastodon', url: 'https://mastodon.social/@beta' }]);
    expect(socials).toEqual([{ platform: 'other', url: 'https://mastodon.social/@beta' }]);
  });

  it('🔑 `other` με μόνο όνομα χρήστη ⇒ εκτός λίστας (δεν υπάρχει πρότυπο να χτιστεί)', async () => {
    await expect(socialsOf([{ platform: 'other', username: 'beta' }])).resolves.toEqual([]);
  });
});
