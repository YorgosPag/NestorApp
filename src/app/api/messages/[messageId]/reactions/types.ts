/**
 * @fileoverview Σχήματα της διαδρομής «αντιδράσεις μηνύματος»
 *
 * Εξήχθησαν από το `route.ts` (411 γρ. έναντι ορίου 300 για API route, N.7.1).
 */

import type { ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import type { MessageReactionsMap } from '@/types/conversations';

export interface ReactionRequest {
  emoji: string;
  action: 'add' | 'remove' | 'toggle';
}

export interface ReactionResponse {
  success: boolean;
  reactions: MessageReactionsMap;
  userReactions: string[];
  action: 'added' | 'removed';
  emoji: string;
}

export type ReactionCanonicalResponse = ApiSuccessResponse<ReactionResponse>;

/** Το σχήμα ανάγνωσης: αντιδράσεις + ποιες από αυτές έχει βάλει ο καλών. */
export interface ReactionsReadResponse {
  reactions: MessageReactionsMap;
  userReactions: string[];
}

export interface RouteParams {
  params: Promise<{
    messageId: string;
  }>;
}

/**
 * Τα **μόνα** πεδία του εγγράφου μηνύματος που χρειάζεται ο συγχρονισμός με
 * Telegram — δηλωμένα στενά ώστε ο συγχρονισμός να μη μπορεί να διαβάσει άλλα.
 */
export interface TelegramMessageData {
  channel?: string;
  providerMessageId?: string;
  providerMetadata?: {
    chatId?: string | number;
    [key: string]: unknown;
  };
}
