/**
 * Άγκυρα του αναγνώστη tar.gz (ADR-891 §9): ustar + pax μακριά ονόματα + **symlinks ως αντίγραφα** — ό,τι
 * χρειάζεται το tarball του basemaps-assets, με ίδιο αποτέλεσμα σε Windows και Linux.
 */

import { gzipSync } from 'node:zlib';

import { readTarGz } from '../tar-extract';

const BLOCK = 512;

function header(name: string, size: number, typeflag: string, linkname = ''): Buffer {
  const block = Buffer.alloc(BLOCK);
  block.write(name.slice(0, 100), 0, 'utf8');
  block.write('0000644\0', 100);
  block.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
  block.write(typeflag, 156);
  block.write(linkname, 157);
  block.write('ustar\0', 257);
  return block;
}

function pad(data: Buffer): Buffer {
  const rest = data.length % BLOCK;
  return rest === 0 ? data : Buffer.concat([data, Buffer.alloc(BLOCK - rest)]);
}

function file(name: string, content: string): Buffer {
  const data = Buffer.from(content);
  return Buffer.concat([header(name, data.length, '0'), pad(data)]);
}

/** Το μήκος μιας εγγραφής pax μετριέται σε **bytes** UTF-8, όχι σε χαρακτήρες (το «Π» πιάνει δύο). */
function paxRecord(key: string, value: string): string {
  const body = ` ${key}=${value}\n`;
  let length = Buffer.byteLength(body) + 1;
  while (Buffer.byteLength(`${length}${body}`) !== length) length += 1;
  return `${length}${body}`;
}

function archive(...entries: Buffer[]): Buffer {
  return gzipSync(Buffer.concat([...entries, Buffer.alloc(BLOCK * 2)]));
}

describe('readTarGz', () => {
  const longName = `root-abc/fonts/${'Π'.repeat(60)}/0-255.pbf`;
  const pax = Buffer.from(paxRecord('path', longName));
  const tar = archive(
    Buffer.concat([header('pax_global_header', 0, 'g')]),
    file('root-abc/fonts/Regular/0-255.pbf', 'REGULAR'),
    header('root-abc/fonts/Deva/0-255.pbf', 0, '2', '../Regular/0-255.pbf'),
    Buffer.concat([header('PaxHeader', pax.length, 'x'), pad(pax)]),
    file('ignored-short-name', 'LONG'),
    file('root-abc/README.md', 'readme'),
  );

  it('αφαιρεί τον ριζικό φάκελο και σέβεται το φίλτρο', () => {
    const paths = readTarGz(tar, (p) => p.startsWith('fonts/')).map((e) => e.path);
    expect(paths).toEqual(['fonts/Regular/0-255.pbf', 'fonts/Deva/0-255.pbf', longName.slice('root-abc/'.length)]);
  });

  it('το symlink γίνεται ΑΝΤΙΓΡΑΦΟ του στόχου του', () => {
    const deva = readTarGz(tar, (p) => p === 'fonts/Deva/0-255.pbf')[0];
    expect(deva.data.toString()).toBe('REGULAR');
  });

  it('pax `path` νικά το κουτσουρεμένο όνομα του ustar', () => {
    const long = readTarGz(tar, (p) => p.endsWith('0-255.pbf') && p.includes('Π'))[0];
    expect(long.data.toString()).toBe('LONG');
  });

  it('symlink προς κάτι που λείπει ⇒ σφάλμα, όχι κενό αρχείο', () => {
    const broken = archive(header('root/x.pbf', 0, '2', 'missing.pbf'));
    expect(() => readTarGz(broken, () => true)).toThrow(/δεν υπάρχει/);
  });
});
