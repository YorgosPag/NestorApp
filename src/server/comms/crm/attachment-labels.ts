/**
 * =============================================================================
 * ATTACHMENT LABELS — SSoT FOR MEDIA PLACEHOLDER TEXT
 * =============================================================================
 *
 * A message whose payload is media rather than text still needs a one-line
 * preview for the conversation list. Meta channels share the same media
 * vocabulary (image / audio / video / file), so the labels live here once;
 * per-channel adapters handle only the attachment types unique to them
 * (Instagram stories, Messenger locations).
 *
 * These are internal preview markers, not translated UI copy — they are
 * written into the Firestore message content and rendered verbatim.
 *
 * @module server/comms/crm/attachment-labels
 * @enterprise ADR-174 - Meta Omnichannel Integration (conversation model SSoT)
 */

/** Media types every Meta channel reports identically. */
const ATTACHMENT_LABELS: Readonly<Record<string, string>> = {
  image: '[Image]',
  audio: '[Audio]',
  video: '[Video]',
  file: '[File]',
} as const;

/**
 * Preview label for an attachment type.
 *
 * Unknown types degrade to `[<type>]` rather than an empty string, so an
 * unrecognized attachment still shows something in the conversation list.
 */
export function resolveAttachmentLabel(type: string): string {
  return ATTACHMENT_LABELS[type] ?? `[${type}]`;
}
