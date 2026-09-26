import { NextResponse } from 'next/server';
import { openStorageObject } from '@/lib/storage/storage-object-stream';

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function streamPdfFromStorage(
  storagePath: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size?: number }> {
  // Ο ΕΝΑΣ τρόπος ροής αντικειμένου (N.0.2 — `lib/storage/storage-object-stream`).
  const opened = await openStorageObject(storagePath);
  if (opened.kind !== 'found') throw new Error(`PDF object missing at ${storagePath}`);
  return { stream: opened.stream, size: opened.contentLength ?? undefined };
}
