/**
 * @fileoverview **Τοπικός διακομιστής του bundle χάρτη φόντου** — για έλεγχο ΠΡΙΝ ανέβει στον διακομιστή.
 * @related ADR-891 §9 · `infra/basemap/Caddyfile` (η παραγωγή) · `lib/basemap/byte-range.ts`
 *
 * **Εκτέλεση**: `npm run basemap:serve` (θύρα 8787, ή `--port=NNNN`) και στο dev:
 * `NEXT_PUBLIC_BASEMAP_ORIGIN=http://localhost:8787`.
 *
 * Μιμείται **ό,τι υπόσχεται ο Caddy** της παραγωγής: `206` με `Content-Range`, `Accept-Ranges`, `ETag`, CORS για
 * GET/HEAD, **καμία** συμπίεση (τα πλακίδια είναι ήδη gzip). Διαφορά: όχι `immutable`, ώστε ένα νέο build να
 * φαίνεται αμέσως στον έλεγχο.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

import { BASEMAP_BUNDLE_DIR as BUNDLE_DIR } from './lib/basemap/basemap-paths';
import { parseByteRange } from './lib/basemap/byte-range';

const DEFAULT_PORT = 8787;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.pbf': 'application/x-protobuf',
  '.json': 'application/json',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, If-Match, If-None-Match, If-Range',
  'Access-Control-Expose-Headers': 'ETag, Content-Range, Content-Length, Accept-Ranges',
} as const;

/** Διαδρομή URL → αρχείο μέσα στο bundle, ή `null` αν βγαίνει έξω από αυτό. */
function resolveFile(url: string): string | null {
  const pathname = decodeURIComponent(new URL(url, 'http://local').pathname);
  const file = normalize(join(BUNDLE_DIR, pathname));
  return file.startsWith(BUNDLE_DIR + sep) && existsSync(file) && statSync(file).isFile() ? file : null;
}

function handle(request: IncomingMessage, response: ServerResponse): void {
  if (request.method === 'OPTIONS') return void response.writeHead(204, CORS_HEADERS).end();
  const file = request.method === 'GET' || request.method === 'HEAD' ? resolveFile(request.url ?? '/') : null;
  if (file === null) return void response.writeHead(404, CORS_HEADERS).end();

  const { size, mtimeMs } = statSync(file);
  const headers = {
    ...CORS_HEADERS,
    'Accept-Ranges': 'bytes',
    ETag: `"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`,
    'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  };
  const range = parseByteRange(request.headers.range, size);
  if (range.kind === 'unsatisfiable') {
    return void response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end();
  }
  const start = range.kind === 'partial' ? range.start : 0;
  const end = range.kind === 'partial' ? range.end : size - 1;
  const status = range.kind === 'partial' ? 206 : 200;
  const partial = range.kind === 'partial' ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {};
  response.writeHead(status, { ...headers, ...partial, 'Content-Length': String(end - start + 1) });
  if (request.method === 'HEAD' || size === 0) return void response.end();
  createReadStream(file, { start, end }).pipe(response);
}

function main(): void {
  if (!existsSync(BUNDLE_DIR)) throw new Error(`δεν υπάρχει bundle: ${BUNDLE_DIR} — τρέξε npm run build:basemap`);
  const arg = process.argv.find((a) => a.startsWith('--port='));
  const port = arg === undefined ? DEFAULT_PORT : Number(arg.slice('--port='.length));
  createServer(handle).listen(port, () => {
    console.log(`🗺  bundle χάρτη → http://localhost:${port}/  (${BUNDLE_DIR})`);
    console.log(`   dev: NEXT_PUBLIC_BASEMAP_ORIGIN=http://localhost:${port}`);
  });
}

main();
