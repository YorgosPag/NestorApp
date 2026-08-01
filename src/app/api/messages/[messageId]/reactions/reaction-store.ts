/**
 * @fileoverview Η ατομική εγγραφή της αντίδρασης στο Firestore + οι δύο βοηθοί της
 *
 * Εξήχθη από το `route.ts` (411 γρ. έναντι ορίου 300 για API route, N.7.1).
 *
 * Το αρχείο κρατά **όλες** τις εντολές `FieldValue` της αντίδρασης σε ένα σημείο:
 * τέσσερις κλάδοι (νέα καταχώριση / αύξηση / διαγραφή / μείωση) που πρέπει να
 * κρατούν το `reactionCount` σύμφωνο με τα `reactions.*.count`. Όσο ήταν σκορπισμένοι
 * μέσα στον χειριστή HTTP, η συμφωνία τους δεν ήταν ελέγξιμη χωρίς αίτημα.
 */

import { FieldValue } from 'firebase-admin/firestore';
import type { MessageReactionsMap } from '@/types/conversations';
import { QUICK_REACTION_EMOJIS } from '@/types/conversations';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MessageReactionsStore');

/**
 * Validate emoji is allowed
 * @enterprise Only allow configured quick reaction emojis + common emojis
 */
export function isValidEmoji(emoji: string): boolean {
  // Allow quick reaction emojis
  if ((QUICK_REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    return true;
  }

  // Allow common emoji patterns (single emoji character)
  // This regex matches most emoji characters
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u;
  return emojiRegex.test(emoji);
}

/** Extract emojis that user has reacted with */
export function extractUserReactions(
  reactions: MessageReactionsMap,
  userId: string,
): string[] {
  const userReactions: string[] = [];
  Object.entries(reactions).forEach(([emoji, reaction]) => {
    if (reaction.userIds?.includes(userId)) {
      userReactions.push(emoji);
    }
  });
  return userReactions;
}

export interface ApplyReactionParams {
  messageRef: FirebaseFirestore.DocumentReference;
  currentReactions: MessageReactionsMap;
  emoji: string;
  finalAction: 'add' | 'remove';
  userId: string;
  userName: string;
  messageId: string;
  operationId: string;
}

/**
 * Εφαρμόζει την αντίδραση. Επιστρέφει `'noop'` όταν η επιθυμητή κατάσταση
 * **ισχύει ήδη** (διπλό «add» ή «remove» χωρίς προηγούμενη αντίδραση): σε αυτή
 * την περίπτωση δεν γίνεται καμία εγγραφή και ο καλών απαντά με την τρέχουσα
 * κατάσταση — ιδιοπαθές, όπως απαιτεί ο N.7.2 §3.
 */
export async function applyReaction({
  messageRef,
  currentReactions,
  emoji,
  finalAction,
  userId,
  userName,
  messageId,
  operationId,
}: ApplyReactionParams): Promise<'applied' | 'noop'> {
  const currentReaction = currentReactions[emoji];
  const userHasReacted = currentReaction?.userIds?.includes(userId) || false;
  const now = new Date();

  if (finalAction === 'add') {
    if (userHasReacted) {
      // Already reacted - caller returns current state
      logger.info('[Reactions] User already reacted', { userId, emoji, operationId });
      return 'noop';
    }

    if (currentReaction) {
      // Update existing reaction
      await messageRef.update({
        [`reactions.${emoji}.userIds`]: FieldValue.arrayUnion(userId),
        [`reactions.${emoji}.userNames`]: FieldValue.arrayUnion(userName),
        [`reactions.${emoji}.count`]: FieldValue.increment(1),
        [`reactions.${emoji}.updatedAt`]: now,
        reactionCount: FieldValue.increment(1),
        updatedAt: now,
      });
    } else {
      // Create new reaction entry
      await messageRef.update({
        [`reactions.${emoji}`]: {
          emoji,
          userIds: [userId],
          userNames: [userName],
          count: 1,
          createdAt: now,
          updatedAt: now,
        },
        reactionCount: FieldValue.increment(1),
        updatedAt: now,
      });
    }

    logger.info('[Reactions] Added reaction', { emoji, userId, messageId, operationId });
    return 'applied';
  }

  // Remove reaction
  if (!userHasReacted) {
    // Not reacted - caller returns current state
    logger.info('[Reactions] User has not reacted', { userId, emoji, operationId });
    return 'noop';
  }

  if (currentReaction && currentReaction.count <= 1) {
    // Remove entire reaction entry
    await messageRef.update({
      [`reactions.${emoji}`]: FieldValue.delete(),
      reactionCount: FieldValue.increment(-1),
      updatedAt: now,
    });
  } else {
    // Decrement count
    await messageRef.update({
      [`reactions.${emoji}.userIds`]: FieldValue.arrayRemove(userId),
      [`reactions.${emoji}.userNames`]: FieldValue.arrayRemove(userName),
      [`reactions.${emoji}.count`]: FieldValue.increment(-1),
      [`reactions.${emoji}.updatedAt`]: now,
      reactionCount: FieldValue.increment(-1),
      updatedAt: now,
    });
  }

  logger.info('[Reactions] Removed reaction', { emoji, userId, messageId, operationId });
  return 'applied';
}
