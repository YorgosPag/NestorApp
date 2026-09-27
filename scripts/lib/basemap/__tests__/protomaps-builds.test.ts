/**
 * @jest-environment node
 */
/**
 * ADR-891 Φ2 — επιλογή build του Protomaps: κατά σχήμα, όχι κατά ημερομηνία. Κι η καρφωμένη έκδοση του `pmtiles`.
 */

import { PMTILES_CLI_VERSION, pmtilesAssetFor } from '../pmtiles-cli';
import { PROTOMAPS_TILES_SCHEMA_MAJOR, parseBuildsIndex, selectBuild, type ProtomapsBuild } from '../protomaps-builds';

const build = (key: string, version: string): ProtomapsBuild => ({ key: `${key}.pmtiles`, version, size: 1, uploaded: '2026-01-01T00:00:00Z' });

const BUILDS = [build('20260920', '4.15.1'), build('20260926', '4.15.2'), build('20261001', '5.0.0'), build('20240101', '3.9.0')];

describe('selectBuild', () => {
  it('χωρίς ζητημένο: το νεότερο της καρφωμένης κύριας έκδοσης — ΟΧΙ το νεότερο γενικά', () => {
    expect(selectBuild(BUILDS, null, 4).key).toBe('20260926.pmtiles');
  });

  it('η καρφωμένη κύρια έκδοση είναι 4 (το σχήμα που διαβάζει το στυλ)', () => {
    expect(PROTOMAPS_TILES_SCHEMA_MAJOR).toBe(4);
  });

  it('ζητημένο build συμβατού σχήματος γίνεται δεκτό', () => {
    expect(selectBuild(BUILDS, '20260920', 4).version).toBe('4.15.1');
  });

  it('ζητημένο build άλλης κύριας έκδοσης απορρίπτεται — ο χάρτης θα έβγαινε άδειος χωρίς σφάλμα', () => {
    expect(() => selectBuild(BUILDS, '20261001', 4)).toThrow(/σχήμα 5\.0\.0/);
  });

  it('ζητημένο build που δεν υπάρχει (το Protomaps κρατά ~1 εβδομάδα) = σφάλμα', () => {
    expect(() => selectBuild(BUILDS, '20250101', 4)).toThrow(/δεν υπάρχει/);
  });

  it('κανένα build της κύριας έκδοσης = σφάλμα, όχι σιωπηλή αναβάθμιση', () => {
    expect(() => selectBuild(BUILDS, null, 6)).toThrow();
  });
});

describe('parseBuildsIndex', () => {
  it('κρατά μόνο γραμμές με σχήμα build — τα υπόλοιπα πετιούνται, δεν μαντεύονται', () => {
    const rows = parseBuildsIndex([build('20260926', '4.15.2'), { key: 'notes.txt', size: 1, version: '4', uploaded: 'x' }, null, 'x']);
    expect(rows.map((r) => r.key)).toEqual(['20260926.pmtiles']);
  });

  it('ό,τι δεν είναι πίνακας = σφάλμα', () => {
    expect(() => parseBuildsIndex({})).toThrow();
  });
});

describe('pmtiles CLI', () => {
  it.each([
    ['win32', 'x64'],
    ['linux', 'x64'],
    ['linux', 'arm64'],
    ['darwin', 'arm64'],
  ])('%s-%s: αρχείο της καρφωμένης έκδοσης με sha256 64 hex', (platform, arch) => {
    const asset = pmtilesAssetFor(platform, arch);
    expect(asset.file).toContain(PMTILES_CLI_VERSION);
    expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('άγνωστη πλατφόρμα = σφάλμα, ποτέ «κατέβασε ό,τι βρεις»', () => {
    expect(() => pmtilesAssetFor('aix', 'ppc64')).toThrow();
  });
});
