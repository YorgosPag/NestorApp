/**
 * @fileoverview **Σύνδεσμοι συνομιλίας με έτοιμο κείμενο** (ADR-ACC-018 §16.1). Κανάλια του εκδότη στη σελίδα τιμολογίου.
 * @related lib/contact/social-chat-links.ts · server/accounting/public-invoice/invoice-public-session.ts
 *
 * | # | Άγκυρα | Μετάλλαξη που τη ρίχνει |
 * |---|---|---|
 * | Σ1 | κάθε κανάλι χτίζει τον ΕΠΙΣΗΜΟ σύνδεσμο, με κωδικοποιημένο κείμενο όπου δέχεται | λάθος πρότυπο / παράμετρος |
 * | Σ2 | Instagram ⇒ ΚΑΝΕΝΑ κείμενο (το `ig.me` δεν το δέχεται) | `draftParam` στο Instagram |
 * | Σ3 | Messenger προκύπτει από τη σελίδα Facebook, και από το URL όταν λείπει όνομα | `source: 'messenger'` |
 * | Σ4 | ένα ανά κανάλι, ο πρώτος έγκυρος νικά, σειρά του `CHAT_CHANNELS` | σειρά λογαριασμών |
 * | Σ5 | σκουπίδια / ξένος host / `profile.php` ⇒ κανένα κανάλι | αφαιρείται το `handlePattern` |
 */

import { CHAT_CHANNELS, buildChatLink, chatChannelPrefillsDraft, chatChannelsOf } from '@/lib/contact/social-chat-links';

const DRAFT = 'Καλησπέρα, παραστατικό Α-12 & όροι?';
const ENCODED = encodeURIComponent(DRAFT);

describe('Σ1/Σ2: οι επίσημοι σύνδεσμοι', () => {
  it.each([
    ['viber', '306912345678', `https://viber.me/306912345678?draft=${ENCODED}`],
    ['whatsapp', '306912345678', `https://wa.me/306912345678?text=${ENCODED}`],
    ['messenger', 'nestor.construct', `https://m.me/nestor.construct?text=${ENCODED}`],
    ['telegram', 'nestor_bot', `https://t.me/nestor_bot?text=${ENCODED}`],
    ['instagram', 'nestor.construct', 'https://ig.me/m/nestor.construct'],
  ] as const)('%s', (channel, handle, expected) => {
    expect(buildChatLink({ channel, handle }, DRAFT)).toBe(expected);
  });

  it('μόνο το Instagram δεν προσυμπληρώνει (η σελίδα αντιγράφει το μήνυμα)', () => {
    expect(CHAT_CHANNELS.filter((c) => !chatChannelPrefillsDraft(c))).toEqual(['instagram']);
  });

  it('κενό κείμενο ⇒ σκέτος σύνδεσμος', () => {
    expect(buildChatLink({ channel: 'whatsapp', handle: '306912345678' }, '  ')).toBe('https://wa.me/306912345678');
  });
});

describe('Σ3: από ποιον λογαριασμό προκύπτει κάθε κανάλι', () => {
  it('Messenger από τη σελίδα Facebook (όνομα χρήστη ή URL)', () => {
    expect(chatChannelsOf([{ platform: 'facebook', username: 'nestor.construct' }]))
      .toEqual([{ channel: 'messenger', handle: 'nestor.construct' }]);
    expect(chatChannelsOf([{ platform: 'facebook', url: 'https://www.facebook.com/nestor.construct/' }]))
      .toEqual([{ channel: 'messenger', handle: 'nestor.construct' }]);
  });

  it('τηλέφωνο Viber/WhatsApp ⇒ μόνο ψηφία', () => {
    expect(chatChannelsOf([{ platform: 'viber', username: '+30 691 234 5678' }]))
      .toEqual([{ channel: 'viber', handle: '306912345678' }]);
  });
});

describe('Σ4: ένα ανά κανάλι, με τη σειρά του CHAT_CHANNELS', () => {
  it('ο πρώτος έγκυρος νικά και η σειρά είναι της ρίζας', () => {
    const refs = chatChannelsOf([
      { platform: 'instagram', username: 'nestor' },
      { platform: 'whatsapp', username: 'όχι αριθμός' },
      { platform: 'whatsapp', username: '306900000001' },
      { platform: 'whatsapp', username: '306900000002' },
      { platform: 'viber', username: '306900000003' },
    ]);
    expect(refs).toEqual([
      { channel: 'viber', handle: '306900000003' },
      { channel: 'whatsapp', handle: '306900000001' },
      { channel: 'instagram', handle: 'nestor' },
    ]);
    expect(refs.map((r) => r.channel)).toEqual(CHAT_CHANNELS.filter((c) => refs.some((r) => r.channel === c)));
  });
});

describe('Σ5: ό,τι δεν είναι λογαριασμός δεν γίνεται σύνδεσμος', () => {
  it.each([
    [{ platform: 'facebook', url: 'https://facebook.com/profile.php?id=1' }],
    [{ platform: 'facebook', url: 'https://evil.example/nestor' }],
    [{ platform: 'telegram', username: 'a/../b' }],
    [{ platform: 'whatsapp', username: '123' }],
    [{ platform: 'linkedin', username: 'nestor' }],
    [{ platform: 'other', url: 'https://wa.me/306912345678' }],
  ] as const)('%j', (account) => {
    expect(chatChannelsOf([account])).toEqual([]);
  });
});
