/**
 * ADR-726 §5 — η μηχαναγνώσιμη όψη του ΕΝΟΣ perf aggregator.
 *
 * Ό,τι κλειδώνεται εδώ είναι προϋπόθεση για να υπάρχει αυτοματοποιημένο benchmark:
 *
 *  1. **Το παράθυρο μέτρησης δεν αυτοκαταστρέφεται.** Ο aggregator καθαρίζει κυλιόμενα ανά 60
 *     δείγματα· ένα benchmark 20΄΄ θα κρατούσε μόνο την ουρά του. Το `reset()` σταματά αυτή τη
 *     συμπεριφορά — αν σπάσει, κάθε μέτρηση γίνεται σιωπηλά λάθος.
 *  2. **Κατανομή, όχι μόνο p95.** Τα κριτήρια του §5 θέλουν p90 ΚΑΙ p99 ΚΑΙ ποσοστό >70ms.
 *  3. **Το `window.__dxfPerf` υπάρχει ακόμη και με κλειστό flag** — αλλιώς το benchmark δεν έχει
 *     πώς να ανάψει τη μέτρηση χωρίς reload.
 */

type PerfModule = typeof import('../mouse-handler-perf');

async function loadPerf(flag: '0' | '1'): Promise<PerfModule> {
  jest.resetModules();
  window.localStorage.setItem('dxf-perf-trace', flag);
  return import('../mouse-handler-perf');
}

describe('snapshotPerfDistribution (ADR-726 §5)', () => {
  let perf: PerfModule;

  beforeEach(async () => {
    perf = await loadPerf('1');
    perf.resetPerf();
  });

  it('χωρίς δείγματα επιστρέφει κενό — καμία γραμμή με μηδενικά', () => {
    expect(perf.snapshotPerfDistribution()).toEqual([]);
  });

  it('δίνει p50/p90/p99 για ένα stage, εκεί που το snapshotPerfRows δίνει μόνο p95', () => {
    for (let i = 1; i <= 100; i++) perf.recordSample('frame:INTERVAL', i);

    const [row] = perf.snapshotPerfDistribution();
    expect(row.stage).toBe('frame:INTERVAL');
    expect(row).toMatchObject({ count: 100, min: 1, max: 100, p50: 50, p90: 90, p99: 99 });

    // Το υπάρχον API δεν αντικαταστάθηκε — απλώς δεν απαντά στην ίδια ερώτηση.
    expect(perf.snapshotPerfRows()[0]).not.toHaveProperty('p90');
  });

  it('υπολογίζει το κριτήριο «καρέ > 70ms» ως ποσοστό, με τα προεπιλεγμένα κατώφλια', () => {
    for (let i = 0; i < 84; i++) perf.recordSample('frame:INTERVAL', 120);
    for (let i = 0; i < 441; i++) perf.recordSample('frame:INTERVAL', 16);

    const over70 = perf
      .snapshotPerfDistribution()[0]
      .exceedance.find((e) => e.thresholdMs === 70);
    expect(over70?.count).toBe(84);
    expect(over70?.share).toBeCloseTo(0.16, 2);
  });

  it('τα προεπιλεγμένα κατώφλια είναι τα τρία του frame budget', () => {
    perf.recordSample('frame:INTERVAL', 1);
    expect(perf.snapshotPerfDistribution()[0].exceedance.map((e) => e.thresholdMs)).toEqual([
      ...perf.FRAME_BUDGET_THRESHOLDS_MS,
    ]);
  });

  it('δέχεται δικά σου κατώφλια', () => {
    perf.recordSample('frame:INTERVAL', 50);
    const rows = perf.snapshotPerfDistribution([40]);
    expect(rows[0].exceedance).toEqual([{ thresholdMs: 40, count: 1, share: 1 }]);
  });

  it('ταξινομεί κατά συνολικό χρόνο φθίνουσα — ο ένοχος πρώτος', () => {
    perf.recordSample('cheap', 1);
    perf.recordSample('expensive', 500);
    perf.recordSample('middle', 50);
    expect(perf.snapshotPerfDistribution().map((r) => r.stage)).toEqual([
      'expensive',
      'middle',
      'cheap',
    ]);
  });

  it('δεν καταναλώνει το παράθυρο — δύο κλήσεις δίνουν το ίδιο', () => {
    perf.recordSample('frame:INTERVAL', 10);
    expect(perf.snapshotPerfDistribution()).toEqual(perf.snapshotPerfDistribution());
  });
});

describe('🔴 παράθυρο μέτρησης — δεν αυτοκαταστρέφεται μετά το reset()', () => {
  let perf: PerfModule;

  beforeEach(async () => {
    perf = await loadPerf('1');
  });

  it('ΧΩΡΙΣ reset(), ο κυλιόμενος καθαρισμός ανά 60 δείγματα σβήνει το παράθυρο', () => {
    perf.recordSample('frame:INTERVAL', 42);
    for (let i = 0; i < 60; i++) perf.perfTick();
    expect(perf.snapshotPerfDistribution()).toEqual([]);
  });

  it('ΜΕΤΑ το reset(), τα ίδια 60 tick αφήνουν το παράθυρο άθικτο', () => {
    perf.resetPerf();
    perf.recordSample('frame:INTERVAL', 42);
    for (let i = 0; i < 60; i++) perf.perfTick();
    expect(perf.snapshotPerfDistribution()[0]).toMatchObject({ count: 1, max: 42 });
  });

  it('το reset() μηδενίζει τα δείγματα του προηγούμενου παραθύρου', () => {
    perf.recordSample('frame:INTERVAL', 999);
    perf.resetPerf();
    expect(perf.snapshotPerfDistribution()).toEqual([]);
  });
});

describe('window.__dxfPerf — το συμβόλαιο του benchmark', () => {
  it('εγκαθίσταται ΚΑΙ με κλειστό flag, ώστε να μπορεί να το ανάψει χωρίς reload', async () => {
    const perf = await loadPerf('0');
    const api = (window as unknown as { __dxfPerf: import('../mouse-handler-perf').DxfPerfWindowApi })
      .__dxfPerf;

    expect(api).toBeDefined();
    expect(api.enabled()).toBe(false);

    window.localStorage.setItem('dxf-perf-trace', '1');
    expect(api.refresh()).toBe(true);
    expect(perf.isPerfEnabled()).toBe(true);
  });

  it('με κλειστό flag το recordSample είναι no-op — μηδέν κόστος, μηδέν δείγματα', async () => {
    const perf = await loadPerf('0');
    perf.recordSample('frame:INTERVAL', 42);
    expect(perf.snapshotPerfDistribution()).toEqual([]);
  });

  it('rows() και distribution() βλέπουν τους ΙΔΙΟΥΣ accumulators', async () => {
    const perf = await loadPerf('1');
    const api = (window as unknown as { __dxfPerf: import('../mouse-handler-perf').DxfPerfWindowApi })
      .__dxfPerf;
    api.reset();
    perf.recordSample('frame:dxf-canvas', 39);

    expect(api.rows()[0].stage).toBe('frame:dxf-canvas');
    expect(api.distribution()[0].stage).toBe('frame:dxf-canvas');
    expect(api.rows()[0].count).toBe(api.distribution()[0].count);
  });

  it('τα παλιά επίπεδα globals επιβιώνουν ως delegates (χειροκίνητη χρήση + ADR-726 Φ1)', async () => {
    await loadPerf('1');
    const w = window as unknown as { __dxfPerfReport?: () => void; __dxfPerfRefresh?: () => void };
    expect(typeof w.__dxfPerfReport).toBe('function');
    expect(typeof w.__dxfPerfRefresh).toBe('function');
  });
});
