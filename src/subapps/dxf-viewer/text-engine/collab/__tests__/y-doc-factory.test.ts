/**
 * ADR-344 Phase 4 — y-doc-factory unit tests.
 *
 * Verifies Y.Doc creation, named-structure access, and snapshot/restore
 * roundtrip — the foundation for both live collab (y-websocket) and
 * crash-recovery drafts (IndexedDB, Q15).
 */

import * as Y from 'yjs';
import {
  createDxfTextYDoc,
  getDxfTextFragment,
  getDxfMetadataMap,
  snapshotYDoc,
  restoreYDoc,
  DXF_TEXT_FRAGMENT_NAME,
  DXF_METADATA_MAP_NAME,
} from '../y-doc-factory';

describe('createDxfTextYDoc', () => {
  it('returns a Y.Doc instance', () => {
    const doc = createDxfTextYDoc({ entityId: 'mtxt_001' });
    expect(doc).toBeInstanceOf(Y.Doc);
  });

  it('assigns the entityId as the Y.Doc guid', () => {
    const doc = createDxfTextYDoc({ entityId: 'mtxt_abc' });
    expect(doc.guid).toBe('mtxt_abc');
  });

  it('pre-allocates the canonical XML fragment', () => {
    const doc = createDxfTextYDoc({ entityId: 'e' });
    const frag = doc.share.get(DXF_TEXT_FRAGMENT_NAME);
    expect(frag).toBeDefined();
    expect(frag).toBeInstanceOf(Y.XmlFragment);
  });

  it('pre-allocates the canonical metadata map', () => {
    const doc = createDxfTextYDoc({ entityId: 'e' });
    const meta = doc.share.get(DXF_METADATA_MAP_NAME);
    expect(meta).toBeDefined();
    expect(meta).toBeInstanceOf(Y.Map);
  });
});

describe('accessor helpers', () => {
  it('getDxfTextFragment returns the same instance on repeated calls', () => {
    const doc = createDxfTextYDoc({ entityId: 'e' });
    const a = getDxfTextFragment(doc);
    const b = getDxfTextFragment(doc);
    expect(a).toBe(b);
  });

  it('getDxfMetadataMap returns the same instance on repeated calls', () => {
    const doc = createDxfTextYDoc({ entityId: 'e' });
    const a = getDxfMetadataMap(doc);
    const b = getDxfMetadataMap(doc);
    expect(a).toBe(b);
  });
});

describe('snapshot / restore roundtrip', () => {
  it('snapshotYDoc returns a non-empty Uint8Array', () => {
    const doc = createDxfTextYDoc({ entityId: 'e' });
    const map = getDxfMetadataMap(doc);
    map.set('attachment', 'MC');
    const snap = snapshotYDoc(doc);
    expect(snap).toBeInstanceOf(Uint8Array);
    expect(snap.byteLength).toBeGreaterThan(0);
  });

  it('restoreYDoc reproduces the metadata map contents', () => {
    const original = createDxfTextYDoc({ entityId: 'e' });
    getDxfMetadataMap(original).set('attachment', 'BR');
    getDxfMetadataMap(original).set('rotation', 45);

    const snap = snapshotYDoc(original);

    const fresh = createDxfTextYDoc({ entityId: 'e' });
    restoreYDoc(fresh, snap);

    const meta = getDxfMetadataMap(fresh);
    expect(meta.get('attachment')).toBe('BR');
    expect(meta.get('rotation')).toBe(45);
  });

  it('multiple snapshots merge via applyUpdate (CRDT property)', () => {
    const a = createDxfTextYDoc({ entityId: 'e' });
    const b = createDxfTextYDoc({ entityId: 'e' });

    getDxfMetadataMap(a).set('rotation', 30);
    getDxfMetadataMap(b).set('attachment', 'TL');

    // exchange updates both ways
    Y.applyUpdate(a, snapshotYDoc(b));
    Y.applyUpdate(b, snapshotYDoc(a));

    expect(getDxfMetadataMap(a).get('attachment')).toBe('TL');
    expect(getDxfMetadataMap(a).get('rotation')).toBe(30);
    expect(getDxfMetadataMap(b).get('attachment')).toBe('TL');
    expect(getDxfMetadataMap(b).get('rotation')).toBe(30);
  });
});
