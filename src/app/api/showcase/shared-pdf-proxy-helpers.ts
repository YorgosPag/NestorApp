import { NextResponse } from 'next/server';
import { getAdminBucket } from '@/lib/firebaseAdmin';

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function streamPdfFromStorage(
  storagePath: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size?: number }> {
  const bucket = getAdminBucket();
  if (!bucket) throw new Error('Storage not available');
  const fileRef = bucket.file(storagePath);
  const [exists] = await fileRef.exists();
  if (!exists) throw new Error(`PDF object missing at ${bucket.name}/${storagePath}`);
  const [metadata] = await fileRef.getMetadata();
  const sizeRaw = metadata.size;
  const size = typeof sizeRaw === 'string' ? Number(sizeRaw) : (sizeRaw as number | undefined);
  const nodeStream = fileRef.createReadStream();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
  return { stream, size: Number.isFinite(size) ? size : undefined };
}
