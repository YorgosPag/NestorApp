import { NextResponse } from 'next/server';
import { getAdminBucket } from '@/lib/firebaseAdmin';
import { openStorageObject } from '@/lib/storage/storage-object-stream';

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function streamPdfFromStorage(
  storagePath: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size?: number }> {
  // Ο ΕΝΑΣ τρόπος ροής αντικειμένου (N.0.2 — `lib/storage/storage-object-stream`).
  // Τα PDF παρουσίασης είναι **παραγόμενα** από τον διακομιστή, όχι πρωτότυπα `FileRecord` ⇒ ρητά ο κανονικός (ADR-895 §2.2).
  const opened = await openStorageObject(storagePath, null, { bucket: getAdminBucket() });
  if (opened.kind !== 'found') throw new Error(`PDF object missing at ${storagePath}`);
  return { stream: opened.stream, size: opened.contentLength ?? undefined };
}
