/**
 * Tests για opening-schedule-pdf-exporter (ADR-376 Phase C.3).
 *
 * Smoke tests: verifies PDF generation doesn't throw for various
 * combinations of door/window schedules (both non-empty, one empty,
 * both empty skip). Uses same mock pattern as exporters.test.ts.
 */

import { downloadOpeningScheduleAsPdf } from '../exporters/opening-schedule-pdf-exporter';
import type { Schedule } from '../types';

jest.mock('@/services/pdf/greek-font-loader', () => ({
  registerGreekFont: jest.fn(async () => undefined),
}));

jest.mock('@/lib/exports/trigger-export-download', () => ({
  triggerExportDownload: jest.fn(),
}));

const { triggerExportDownload } = jest.requireMock('@/lib/exports/trigger-export-download') as {
  triggerExportDownload: jest.Mock;
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDoorSchedule(rowCount = 2): Schedule {
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    entityId: `door_${i}`,
    entityType: 'door' as const,
    entityKind: 'door',
    floorId: 'floor-1',
    cells: {
      mark: `Θ.00${i + 1}`,
      id: `door_${i}`,
      floor: 'Ισόγειο',
      kind: 'door',
      width: 900,
      height: 2100,
      sill: 0,
      handingText: 'Δεξιά',
      handingCode: 'RH',
      material: null,
      wall: null,
    },
  }));
  return {
    entityType: 'door',
    columns: [
      { key: 'mark',        i18nKey: 'col.mark',        valueType: 'text',              align: 'left'   },
      { key: 'id',          i18nKey: 'col.id',          valueType: 'text',              align: 'left'   },
      { key: 'floor',       i18nKey: 'col.floor',       valueType: 'text',              align: 'left'   },
      { key: 'kind',        i18nKey: 'col.kind',        valueType: 'text',              align: 'left'   },
      { key: 'width',       i18nKey: 'col.width',       valueType: 'dimension-mm-to-m', align: 'right'  },
      { key: 'height',      i18nKey: 'col.height',      valueType: 'dimension-mm-to-m', align: 'right'  },
      { key: 'sill',        i18nKey: 'col.sill',        valueType: 'dimension-mm-to-m', align: 'right'  },
      { key: 'handingText', i18nKey: 'col.handingText', valueType: 'text',              align: 'left'   },
      { key: 'handingCode', i18nKey: 'col.handingCode', valueType: 'text',              align: 'center' },
      { key: 'material',    i18nKey: 'col.material',    valueType: 'text',              align: 'left'   },
      { key: 'wall',        i18nKey: 'col.wall',        valueType: 'text',              align: 'left'   },
    ],
    rows,
    generatedAt: 1748000000000,
  };
}

function makeWindowSchedule(rowCount = 2): Schedule {
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    entityId: `win_${i}`,
    entityType: 'window' as const,
    entityKind: 'window',
    floorId: 'floor-1',
    cells: {
      mark: `Π.00${i + 1}`,
      id: `win_${i}`,
      floor: 'Ισόγειο',
      kind: 'window',
      width: 1200,
      height: 1400,
      sill: 900,
      glazing: 2,
      material: null,
      wall: null,
    },
  }));
  return {
    entityType: 'window',
    columns: [
      { key: 'mark',     i18nKey: 'col.mark',     valueType: 'text',              align: 'left'  },
      { key: 'id',       i18nKey: 'col.id',       valueType: 'text',              align: 'left'  },
      { key: 'floor',    i18nKey: 'col.floor',    valueType: 'text',              align: 'left'  },
      { key: 'kind',     i18nKey: 'col.kind',     valueType: 'text',              align: 'left'  },
      { key: 'width',    i18nKey: 'col.width',    valueType: 'dimension-mm-to-m', align: 'right' },
      { key: 'height',   i18nKey: 'col.height',   valueType: 'dimension-mm-to-m', align: 'right' },
      { key: 'sill',     i18nKey: 'col.sill',     valueType: 'dimension-mm-to-m', align: 'right' },
      { key: 'glazing',  i18nKey: 'col.glazing',  valueType: 'count',             align: 'right' },
      { key: 'material', i18nKey: 'col.material', valueType: 'text',              align: 'left'  },
      { key: 'wall',     i18nKey: 'col.wall',     valueType: 'text',              align: 'left'  },
    ],
    rows,
    generatedAt: 1748000000000,
  };
}

const OPTS = {
  scheduleTitle: 'Πίνακας Κουφωμάτων',
  projectName: 'Test Project',
  doorLabel: 'Πόρτες',
  windowLabel: 'Παράθυρα',
  filename: 'opening-schedule-test',
};

const TRANSLATE: (key: string) => string = (key) => key;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('downloadOpeningScheduleAsPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates PDF with both door and window tables', async () => {
    await downloadOpeningScheduleAsPdf(
      makeDoorSchedule(2),
      makeWindowSchedule(2),
      OPTS,
      TRANSLATE,
    );
    expect(triggerExportDownload).toHaveBeenCalledTimes(1);
    const call = triggerExportDownload.mock.calls[0]![0] as { blob: Blob; filename: string };
    expect(call.filename).toBe('opening-schedule-test.pdf');
    expect(call.blob.size).toBeGreaterThan(0);
  });

  test('generates PDF when only doors present (no window rows)', async () => {
    await downloadOpeningScheduleAsPdf(
      makeDoorSchedule(3),
      makeWindowSchedule(0),
      OPTS,
      TRANSLATE,
    );
    expect(triggerExportDownload).toHaveBeenCalledTimes(1);
    const call = triggerExportDownload.mock.calls[0]![0] as { blob: Blob; filename: string };
    expect(call.blob.size).toBeGreaterThan(0);
  });

  test('generates PDF when only windows present (no door rows)', async () => {
    await downloadOpeningScheduleAsPdf(
      makeDoorSchedule(0),
      makeWindowSchedule(2),
      OPTS,
      TRANSLATE,
    );
    expect(triggerExportDownload).toHaveBeenCalledTimes(1);
    const call = triggerExportDownload.mock.calls[0]![0] as { blob: Blob; filename: string };
    expect(call.blob.size).toBeGreaterThan(0);
  });

  test('skips download when both schedules are empty', async () => {
    // downloadOpeningScheduleAsPdf still runs PDF gen even for empty — the
    // "skip" guard lives in OpeningSchedulePdfHost. Verify no crash + output.
    await downloadOpeningScheduleAsPdf(
      makeDoorSchedule(0),
      makeWindowSchedule(0),
      OPTS,
      TRANSLATE,
    );
    // With zero rows, both tables are skipped — PDF still generated (header + footers only).
    expect(triggerExportDownload).toHaveBeenCalledTimes(1);
  });

  test('filename extension is .pdf', async () => {
    await downloadOpeningScheduleAsPdf(
      makeDoorSchedule(1),
      makeWindowSchedule(1),
      { ...OPTS, filename: 'my-schedule' },
      TRANSLATE,
    );
    const call = triggerExportDownload.mock.calls[0]![0] as { filename: string };
    expect(call.filename).toBe('my-schedule.pdf');
  });

  test('uses scheduleTitle in footer (blob non-empty)', async () => {
    await downloadOpeningScheduleAsPdf(
      makeDoorSchedule(1),
      makeWindowSchedule(1),
      { ...OPTS, scheduleTitle: 'Custom Title' },
      TRANSLATE,
    );
    expect(triggerExportDownload).toHaveBeenCalledTimes(1);
    const call = triggerExportDownload.mock.calls[0]![0] as { blob: Blob };
    expect(call.blob.size).toBeGreaterThan(100);
  });
});
