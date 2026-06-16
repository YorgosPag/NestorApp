/**
 * Tests — Cross-Floor Floorplan Duplicate pure core (ADR-465).
 */

import {
  downloadFileRecordAsFile,
  buildFloorDuplicateConfig,
} from '../floorplan-duplicate-core';

describe('buildFloorDuplicateConfig', () => {
  const base = {
    companyId: 'comp_1',
    projectId: 'proj_1',
    userId: 'user_1',
    destFloorId: 'flr_dest',
    destFloorName: 'Ισόγειο',
    buildingId: 'bldg_1',
  };

  it('builds a floor-level construction/floorplans config', () => {
    const cfg = buildFloorDuplicateConfig(base);
    expect(cfg.entityType).toBe('floor');
    expect(cfg.entityId).toBe('flr_dest');
    expect(cfg.domain).toBe('construction');
    expect(cfg.category).toBe('floorplans');
    expect(cfg.purpose).toBe('floor-floorplan');
    expect(cfg.companyId).toBe('comp_1');
    expect(cfg.projectId).toBe('proj_1');
    expect(cfg.userId).toBe('user_1');
    expect(cfg.entityLabel).toBe('Ισόγειο');
  });

  it('wires building as a linkedTo cross-entity link', () => {
    expect(buildFloorDuplicateConfig(base).linkedTo).toEqual(['building:bldg_1']);
  });

  it('omits linkedTo when no building is given', () => {
    const { buildingId: _omit, ...noBuilding } = base;
    expect(buildFloorDuplicateConfig(noBuilding).linkedTo).toBeUndefined();
  });
});

describe('downloadFileRecordAsFile', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('throws NO_DOWNLOAD_URL when the record has no url', async () => {
    await expect(
      downloadFileRecordAsFile({ originalFilename: 'a.dxf', ext: 'dxf' }),
    ).rejects.toThrow('NO_DOWNLOAD_URL');
  });

  it('throws DOWNLOAD_FAILED_<status> on a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    await expect(
      downloadFileRecordAsFile({ downloadUrl: 'https://x/y.dxf', ext: 'dxf' }),
    ).rejects.toThrow('DOWNLOAD_FAILED_404');
  });

  it('returns a File carrying the original filename + blob type', async () => {
    const blob = new Blob(['DXF DATA'], { type: 'application/dxf' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => blob,
    }) as unknown as typeof fetch;

    const file = await downloadFileRecordAsFile({
      downloadUrl: 'https://x/y.dxf',
      originalFilename: 'Ισόγειο 1.dxf',
      ext: 'dxf',
    });
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('Ισόγειο 1.dxf');
    expect(file.type).toBe('application/dxf');
  });

  it('synthesizes a name from ext when originalFilename is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob([''], { type: '' }),
    }) as unknown as typeof fetch;

    const file = await downloadFileRecordAsFile({ downloadUrl: 'https://x/y.dxf', ext: 'dxf' });
    expect(file.name).toBe('floorplan.dxf');
    expect(file.type).toBe('application/dxf');
  });
});
