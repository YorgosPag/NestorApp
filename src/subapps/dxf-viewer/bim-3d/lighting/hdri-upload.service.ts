'use client';

/**
 * ADR-366 Group B — Custom HDRI Upload Service.
 *
 * Validates a user-supplied .hdr / .exr environment map and uploads it to
 * Firebase Storage under a tenant-scoped path. Mirrors the upload pattern
 * used by `animation-queue-processor.ts` (ADR-366 §C.1.c).
 */

import { ref as makeStorageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { buildBimEnvironmentHdriPath } from '@/services/upload/utils/storage-path';
import { generateBimEnvironmentId } from '@/services/enterprise-id.service';

export const HDRI_MAX_BYTES = 50 * 1024 * 1024;

export type HdriExtension = 'hdr' | 'exr';

export interface HdriUploadInput {
  readonly file: File;
  readonly companyId: string;
}

export interface HdriUploadResult {
  readonly storagePath: string;
  readonly downloadUrl: string;
  readonly fileName: string;
  readonly ext: HdriExtension;
}

export type HdriUploadErrorCode =
  | 'format'
  | 'size'
  | 'missing-company'
  | 'upload-failed';

export class HdriUploadError extends Error {
  readonly code: HdriUploadErrorCode;
  constructor(code: HdriUploadErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'HdriUploadError';
  }
}

function detectExtension(file: File): HdriExtension | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.hdr')) return 'hdr';
  if (lower.endsWith('.exr')) return 'exr';
  return null;
}

function contentTypeFor(ext: HdriExtension): string {
  return ext === 'hdr' ? 'image/vnd.radiance' : 'application/octet-stream';
}

export function validateHdriFile(file: File): HdriExtension {
  const ext = detectExtension(file);
  if (!ext) throw new HdriUploadError('format');
  if (file.size > HDRI_MAX_BYTES) throw new HdriUploadError('size');
  return ext;
}

export async function uploadCustomHdri(input: HdriUploadInput): Promise<HdriUploadResult> {
  const { file, companyId } = input;
  if (!companyId) throw new HdriUploadError('missing-company');

  const ext = validateHdriFile(file);
  const envId = generateBimEnvironmentId();
  const storagePath = buildBimEnvironmentHdriPath({ companyId, envId, ext });
  const fileRef = makeStorageRef(storage, storagePath);

  try {
    await uploadBytes(fileRef, file, { contentType: contentTypeFor(ext) });
    const downloadUrl = await getDownloadURL(fileRef);
    return { storagePath, downloadUrl, fileName: file.name, ext };
  } catch (err) {
    throw new HdriUploadError(
      'upload-failed',
      err instanceof Error ? err.message : String(err),
    );
  }
}
