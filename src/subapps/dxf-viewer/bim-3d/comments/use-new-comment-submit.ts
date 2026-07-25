'use client';

/**
 * ADR-366 Φ9/C.2 — κατάσταση + υποβολή της φόρμας «Νέο Σχόλιο» (wiring 2026-07-26).
 *
 * Ζει χωριστά από το `CommentListPanel` για δύο λόγους: το `NewCommentForm` μένει καθαρά
 * παρουσιαστικό (N.7.1 — 40 γραμμές/συνάρτηση), και **η σειρά upload → create ζει σε ΕΝΑ
 * σημείο** (`persistComment`), όπου διαβάζεται ολόκληρη με μια ματιά αντί να είναι σκορπισμένη
 * μέσα σε JSX.
 *
 * @see ./comment-attachment-upload.service — το σκεπτικό της σειράς (ADR-694 ως δίχτυ)
 */

import { useState } from 'react';
import { generateBimCommentId } from '@/services/enterprise-id.service';
import {
  ImageAssetUploadError,
  type ImageAssetUploadErrorCode,
} from '@/services/upload/image-asset-upload';
import { BimCommentsService } from './bim-comments.service';
import { uploadCommentAttachments } from './comment-attachment-upload.service';
import type { StagedFile } from './CommentAttachmentUploader';
import type { CommentType } from './bim-comment-types';

/** Κάθε αστοχία ανεβάσματος έχει το δικό της μήνυμα — «κάτι πήγε στραβά» δεν βοηθά κανέναν. */
const ERROR_KEY_BY_CODE: Readonly<Record<ImageAssetUploadErrorCode, string>> = {
  format: 'comments.attachment.invalidType',
  size: 'comments.attachment.tooLarge',
  'upload-failed': 'comments.attachment.uploadFailed',
};

function errorKeyOf(err: unknown): string {
  return err instanceof ImageAssetUploadError
    ? ERROR_KEY_BY_CODE[err.code]
    : 'comments.submitFailed';
}

export interface NewCommentSubmitParams {
  readonly companyId: string;
  readonly projectId: string;
  readonly userId: string;
  readonly userName: string;
  readonly onSuccess: () => void;
}

export interface NewCommentSubmitState {
  readonly type: CommentType;
  readonly setType: (type: CommentType) => void;
  readonly content: string;
  readonly setContent: (content: string) => void;
  readonly staged: readonly StagedFile[];
  readonly setStaged: (staged: readonly StagedFile[]) => void;
  readonly submitting: boolean;
  /** i18n key του σφάλματος, ή `null` — ποτέ έτοιμο κείμενο (N.11). */
  readonly errorKey: string | null;
  readonly canSubmit: boolean;
  readonly submit: () => Promise<void>;
}

/**
 * **Ανεβάζει πρώτα, γράφει μετά — ένα write.** Το `commentId` δεσμεύεται εδώ γιατί το storage
 * path το περιέχει· έτσι το σχόλιο δεν υπάρχει ποτέ σε ενδιάμεση κατάσταση «χωρίς τα συνημμένα
 * του». Αν το write αποτύχει μετά από πετυχημένο ανέβασμα, μένουν objects χωρίς ιδιοκτήτη —
 * τα αναγνωρίζει ο custody κανόνας `bim-comment-attachments` και τα ανακτά ο sweeper (ADR-694).
 */
async function persistComment(
  params: NewCommentSubmitParams,
  type: CommentType,
  content: string,
  staged: readonly StagedFile[],
): Promise<void> {
  const commentId = generateBimCommentId();
  const attachments = await uploadCommentAttachments({
    companyId: params.companyId,
    commentId,
    staged,
  });
  await BimCommentsService.createComment({
    id: commentId,
    projectId: params.projectId,
    companyId: params.companyId,
    authorId: params.userId,
    authorName: params.userName,
    type,
    content: content.trim(),
    anchor: { type: 'world', position: { x: 0, y: 0, z: 0 } },
    attachments,
  });
}

export function useNewCommentSubmit(params: NewCommentSubmitParams): NewCommentSubmitState {
  const [type, setType] = useState<CommentType>('issue');
  const [content, setContent] = useState('');
  const [staged, setStaged] = useState<readonly StagedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const canSubmit = content.trim().length > 0 && !submitting;

  async function submit(): Promise<void> {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorKey(null);
    try {
      await persistComment(params, type, content, staged);
      params.onSuccess();
    } catch (err) {
      setErrorKey(errorKeyOf(err));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    type,
    setType,
    content,
    setContent,
    staged,
    setStaged,
    submitting,
    errorKey,
    canSubmit,
    submit,
  };
}
