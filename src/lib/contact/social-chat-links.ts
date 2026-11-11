/**
 * 💬 SSoT: **«άνοιξε συνομιλία με τον λογαριασμό, με έτοιμο κείμενο»** για τα κανάλια μηνυμάτων.
 *
 * Υπάρχει επειδή το έργο είχε δύο **άλλες** οικογένειες συνδέσμων, καμία από τις οποίες δεν απαντά στο «γράψε στον
 * εκδότη»:
 *   - **προφίλ** (`social-platform-profiles.ts`): ανοίγει τη σελίδα του λογαριασμού, χωρίς κείμενο.
 *   - **κοινοποίηση** (`social-platform-system`, `share-utils.ts`): `wa.me/?text=` · `t.me/share/url`, όπου ο
 *     χρήστης **διαλέγει** παραλήπτη. Εδώ ο παραλήπτης είναι **γνωστός**.
 *
 * Κάθε κανάλι **προκύπτει** από έναν λογαριασμό της ρίζας `SOCIAL_PLATFORMS` (το Messenger από τη σελίδα Facebook,
 * το Instagram Direct από το Instagram). Έτσι δεν υπάρχει δεύτερο σημείο δήλωσης. Τα πρότυπα είναι τα **επίσημα**
 * (επαληθευμένα 2026-11-11):
 *   - WhatsApp `wa.me/<E164>?text=` (faq.whatsapp.com, click to chat)
 *   - Viber `viber.me/<E164>?draft=` (help.viber.com, chat link λογαριασμού Business· δωρεάν)
 *   - Messenger `m.me/<σελίδα>?text=` (developers.facebook.com, m.me links)
 *   - Telegram `t.me/<χρήστης>?text=` (core.telegram.org/api/links)
 *   - Instagram `ig.me/m/<χρήστης>`: το Instagram **δεν** δέχεται έτοιμο κείμενο.
 *
 * Καθαρά δεδομένα, χωρίς React. Ο server βγάζει τα κανάλια (`chatChannelsOf`) και ο client χτίζει τον σύνδεσμο
 * (`buildChatLink`) με το κείμενο **στη γλώσσα του επισκέπτη**.
 *
 * @module lib/contact/social-chat-links
 */

import type { SocialPlatform } from './social-media-type-vocabulary';
import {
  SOCIAL_PLATFORM_PROFILES, detectPlatformFromUrl, normaliseSocialHandle, type NamedSocialPlatform,
} from './social-platform-profiles';

/** Τα κανάλια συνομιλίας, με τη σειρά εμφάνισης (στην Ελλάδα κυριαρχεί το Viber). */
export const CHAT_CHANNELS = ['viber', 'whatsapp', 'messenger', 'telegram', 'instagram'] as const;

export type ChatChannel = (typeof CHAT_CHANNELS)[number];

/** Ένα κανάλι έτοιμο για σύνδεσμο: το κανάλι και ο **επικυρωμένος** δείκτης του λογαριασμού. */
export interface ChatChannelRef {
  readonly channel: ChatChannel;
  readonly handle: string;
}

/** Ό,τι χρειάζεται από έναν λογαριασμό social. Δομικός τύπος, ώστε να τον δίνει κάθε πηγή (branding, επαφή). */
export interface SocialAccountLike {
  readonly platform: SocialPlatform;
  readonly url?: string;
  readonly username?: string;
}

interface ChatChannelSpec {
  /** Ο λογαριασμός της ρίζας από τον οποίο προκύπτει το κανάλι. */
  readonly source: NamedSocialPlatform;
  readonly brandName: string;
  /** Ο **επιτρεπτός** δείκτης. Ό,τι δεν ταιριάζει απορρίπτεται, ώστε να μη χτιστεί ποτέ σύνδεσμος από σκουπίδια. */
  readonly handlePattern: RegExp;
  /** `null` όταν το κανάλι δεν δέχεται έτοιμο κείμενο. */
  readonly draftParam: string | null;
  readonly base: (handle: string) => string;
}

// E.164: έως 15 ψηφία, χωρίς `+`. Ο ελάχιστος αριθμός ψηφίων αποκλείει προφανή λάθη, όχι κάθε άκυρο αριθμό.
const E164_DIGITS = /^\d{8,15}$/;

const CHAT_CHANNEL_SPECS = {
  viber: {
    source: 'viber', brandName: SOCIAL_PLATFORM_PROFILES.viber.brandName,
    handlePattern: E164_DIGITS, draftParam: 'draft', base: (h) => `https://viber.me/${h}`,
  },
  whatsapp: {
    source: 'whatsapp', brandName: SOCIAL_PLATFORM_PROFILES.whatsapp.brandName,
    handlePattern: E164_DIGITS, draftParam: 'text', base: (h) => `https://wa.me/${h}`,
  },
  messenger: {
    // Όνομα σελίδας Facebook ή αριθμητικό id σελίδας.
    source: 'facebook', brandName: 'Messenger',
    handlePattern: /^[A-Za-z0-9.-]{1,100}$/, draftParam: 'text', base: (h) => `https://m.me/${h}`,
  },
  telegram: {
    source: 'telegram', brandName: SOCIAL_PLATFORM_PROFILES.telegram.brandName,
    handlePattern: /^[A-Za-z][A-Za-z0-9_]{3,31}$/, draftParam: 'text', base: (h) => `https://t.me/${h}`,
  },
  instagram: {
    source: 'instagram', brandName: SOCIAL_PLATFORM_PROFILES.instagram.brandName,
    handlePattern: /^[A-Za-z0-9._]{1,30}$/, draftParam: null, base: (h) => `https://ig.me/m/${h}`,
  },
} as const satisfies Readonly<Record<ChatChannel, ChatChannelSpec>>;

// Τμήματα διαδρομής που ΔΕΝ είναι λογαριασμός (`facebook.com/profile.php?id=…`, `facebook.com/pages/…`).
const NON_HANDLE_SEGMENTS: ReadonlySet<string> = new Set(['profile.php', 'pages', 'people', 'groups', 'share']);

/** Ο δείκτης από το URL του λογαριασμού: το πρώτο τμήμα της διαδρομής, μόνο αν το URL ανήκει στην πλατφόρμα. */
function handleFromUrl(platform: NamedSocialPlatform, url: string): string | undefined {
  if (detectPlatformFromUrl(url) !== platform) return undefined;
  try {
    const first = new URL(url.trim()).pathname.split('/').find((segment) => segment.length > 0);
    return first && !NON_HANDLE_SEGMENTS.has(first.toLowerCase()) ? decodeURIComponent(first) : undefined;
  } catch {
    return undefined;
  }
}

function handleOf(account: SocialAccountLike, spec: ChatChannelSpec): string | undefined {
  const raw = account.username ?? (account.url ? handleFromUrl(spec.source, account.url) : undefined);
  const handle = raw ? normaliseSocialHandle(spec.source, raw) : '';
  return spec.handlePattern.test(handle) ? handle : undefined;
}

/**
 * Τα κανάλια συνομιλίας ενός συνόλου λογαριασμών: **ένα** ανά κανάλι (ο πρώτος έγκυρος λογαριασμός νικά, οπότε
 * ο καλών δίνει πρώτο τον κύριο), με τη σειρά του `CHAT_CHANNELS`.
 */
export function chatChannelsOf(accounts: readonly SocialAccountLike[]): ChatChannelRef[] {
  return CHAT_CHANNELS.flatMap((channel) => {
    const spec: ChatChannelSpec = CHAT_CHANNEL_SPECS[channel];
    for (const account of accounts) {
      if (account.platform !== spec.source) continue;
      const handle = handleOf(account, spec);
      if (handle) return [{ channel, handle }];
    }
    return [];
  });
}

/** Ο σύνδεσμος συνομιλίας. Το `draft` μπαίνει μόνο όπου το δέχεται το κανάλι, κωδικοποιημένο. */
export function buildChatLink(ref: ChatChannelRef, draft: string): string {
  const spec: ChatChannelSpec = CHAT_CHANNEL_SPECS[ref.channel];
  const base = spec.base(ref.handle);
  const text = draft.trim();
  return spec.draftParam && text ? `${base}?${spec.draftParam}=${encodeURIComponent(text)}` : base;
}

export function chatChannelBrandName(channel: ChatChannel): string {
  return CHAT_CHANNEL_SPECS[channel].brandName;
}

/** Αν το κανάλι προσυμπληρώνει το μήνυμα. Όπου όχι (Instagram), η σελίδα αντιγράφει το κείμενο πριν ανοίξει. */
export function chatChannelPrefillsDraft(channel: ChatChannel): boolean {
  return CHAT_CHANNEL_SPECS[channel].draftParam !== null;
}

