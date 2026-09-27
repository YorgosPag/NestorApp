/**
 * @jest-environment node
 */
/**
 * ADR-891 Φ2 — η ΜΙΑ λήψη πηγής των γεννητόρων: προέλευση δίπλα, καρφωμένο αποτύπωμα, ατομική εγγραφή.
 * Εκτελείται απέναντι σε **πραγματικό** τοπικό διακομιστή HTTP — όχι σε mock του `fetch`.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fileSha256, loadCachedSource } from '../cached-download';

const BODY = Buffer.from('πλακίδια'.repeat(1000));
const SHA = createHash('sha256').update(BODY).digest('hex');

let server: Server;
let base: string;
let hits = 0;
let dir: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    hits += 1;
    if (request.url === '/missing') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Last-Modified': 'Sat, 26 Sep 2026 08:54:23 GMT' }).end(BODY);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  hits = 0;
  dir = mkdtempSync(join(tmpdir(), 'cached-download-'));
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

const request = (extra: Partial<Parameters<typeof loadCachedSource>[0]> = {}) => ({
  url: `${base}/file`,
  path: join(dir, 'nested', 'file.bin'),
  label: 'test',
  ...extra,
});

describe('loadCachedSource', () => {
  it('κατεβάζει και γράφει την προέλευση δίπλα: sha256 + Last-Modified + bytes', async () => {
    const source = await loadCachedSource(request());
    expect(readFileSync(source.path)).toEqual(BODY);
    expect(source.meta).toEqual({ url: `${base}/file`, lastModified: 'Sat, 26 Sep 2026 08:54:23 GMT', bytes: BODY.length, sha256: SHA });
    expect(JSON.parse(readFileSync(`${source.path}.meta.json`, 'utf8'))).toEqual(source.meta);
  });

  it('δεύτερη κλήση = από την cache, κανένα αίτημα', async () => {
    await loadCachedSource(request());
    await loadCachedSource(request());
    expect(hits).toBe(1);
  });

  it('refresh = ξανά από την πηγή', async () => {
    await loadCachedSource(request());
    await loadCachedSource(request({ refresh: true }));
    expect(hits).toBe(2);
  });

  it('αρχείο χωρίς .meta.json ξανακατεβαίνει — χωρίς προέλευση δεν ξέρουμε ποια έκδοση είναι', async () => {
    const source = await loadCachedSource(request());
    rmSync(`${source.path}.meta.json`);
    await loadCachedSource(request());
    expect(hits).toBe(2);
  });

  it('καρφωμένο αποτύπωμα που ταιριάζει = δεκτό', async () => {
    await expect(loadCachedSource(request({ expectedSha256: SHA }))).resolves.toMatchObject({ meta: { sha256: SHA } });
  });

  it('καρφωμένο αποτύπωμα που ΔΕΝ ταιριάζει = σφάλμα και ΚΑΝΕΝΑ αρχείο στον δίσκο (ούτε μισό)', async () => {
    const path = request().path;
    await expect(loadCachedSource(request({ expectedSha256: '0'.repeat(64) }))).rejects.toThrow(/ΔΕΝ γίνεται δεκτό/);
    expect(existsSync(path)).toBe(false);
    expect(existsSync(`${path}.part`)).toBe(false);
  });

  it('αλλαγή καρφώματος: η παλιά cache ΔΕΝ γίνεται δεκτή', async () => {
    await loadCachedSource(request());
    writeFileSync(`${request().path}.meta.json`, JSON.stringify({ url: '', lastModified: null, bytes: 0, sha256: 'παλιό' }));
    await loadCachedSource(request({ expectedSha256: SHA }));
    expect(hits).toBe(2);
  });

  it('HTTP σφάλμα = σφάλμα με τον κωδικό', async () => {
    await expect(loadCachedSource(request({ url: `${base}/missing` }))).rejects.toThrow(/HTTP 404/);
  });
});

describe('fileSha256', () => {
  it('ίδιο αποτύπωμα με το crypto σε ολόκληρο το buffer', async () => {
    const path = join(dir, 'x.bin');
    writeFileSync(path, BODY);
    await expect(fileSha256(path)).resolves.toBe(SHA);
  });
});
