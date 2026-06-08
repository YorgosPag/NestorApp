/**
 * ADR-408 Εύρος Β — pipe-network SOURCE SSoT tests (pure).
 *
 * Pins the classification-aware source-connector pick that the COMBI boiler needs: a
 * combi boiler carries TWO `flow:'out'` connectors of DISTINCT classification
 * (`hydronic-supply` + `domestic-hot-water`), so "first out" alone would source the
 * wrong network for one of them. `findPipeNetworkSourceConnectorId(source, classif)`
 * must pick BY classification, while the no-classification call stays first-out
 * (single-outlet sources unaffected → regression guard).
 */

import {
  isPipeNetworkSourceEntity,
  findPipeNetworkSourceConnectorId,
  sourceOutConnectorClassifications,
  type PipeNetworkSourceEntity,
} from '../pipe-network-source';
import {
  BOILER_SUPPLY_CONNECTOR_ID,
  BOILER_RETURN_CONNECTOR_ID,
  BOILER_DHW_CONNECTOR_ID,
} from '../../types/mep-connector-types';

/** A boiler entity with supply (+ optional DHW) out connectors. */
function boiler(producesDhw: boolean): PipeNetworkSourceEntity {
  const connectors = [
    { connectorId: BOILER_SUPPLY_CONNECTOR_ID, domain: 'pipe', flow: 'out', localPosition: { x: 225, y: 0, z: 0 }, pipe: { systemClassification: 'hydronic-supply', diameterMm: 22 } },
    { connectorId: BOILER_RETURN_CONNECTOR_ID, domain: 'pipe', flow: 'in', localPosition: { x: -225, y: 0, z: 0 }, pipe: { systemClassification: 'hydronic-return', diameterMm: 22 } },
    ...(producesDhw
      ? [{ connectorId: BOILER_DHW_CONNECTOR_ID, domain: 'pipe', flow: 'out', localPosition: { x: 225, y: 175, z: 0 }, pipe: { systemClassification: 'domestic-hot-water', diameterMm: 22 } }]
      : []),
  ];
  return {
    type: 'mep-boiler',
    id: 'b1',
    params: { kind: 'wall-boiler', position: { x: 0, y: 0, z: 0 }, rotation: 0, systemClassification: 'hydronic-supply', producesDhw, connectors },
  } as unknown as PipeNetworkSourceEntity;
}

describe('isPipeNetworkSourceEntity', () => {
  it('recognises a boiler as a pipe-network source', () => {
    expect(isPipeNetworkSourceEntity(boiler(false) as never)).toBe(true);
  });
});

describe('sourceOutConnectorClassifications', () => {
  it('a plain boiler has ONE outgoing classification', () => {
    const set = sourceOutConnectorClassifications(boiler(false));
    expect(set.size).toBe(1);
    expect(set.has('hydronic-supply')).toBe(true);
  });

  it('a COMBI boiler has TWO outgoing classifications (hydronic + DHW)', () => {
    const set = sourceOutConnectorClassifications(boiler(true));
    expect(set.size).toBe(2);
    expect(set.has('hydronic-supply')).toBe(true);
    expect(set.has('domestic-hot-water')).toBe(true);
  });
});

describe('findPipeNetworkSourceConnectorId', () => {
  it('no classification → first outgoing connector (supply) — legacy/regression', () => {
    expect(findPipeNetworkSourceConnectorId(boiler(true))).toBe(BOILER_SUPPLY_CONNECTOR_ID);
  });

  it('classification-aware: hydronic-supply → boiler-supply', () => {
    expect(findPipeNetworkSourceConnectorId(boiler(true), 'hydronic-supply')).toBe(
      BOILER_SUPPLY_CONNECTOR_ID,
    );
  });

  it('classification-aware: domestic-hot-water → boiler-dhw (the combi DHW outlet)', () => {
    expect(findPipeNetworkSourceConnectorId(boiler(true), 'domestic-hot-water')).toBe(
      BOILER_DHW_CONNECTOR_ID,
    );
  });

  it('falls back to first-out when no connector matches the asked classification', () => {
    // a plain boiler asked for domestic-hot-water has no such outlet → first out.
    expect(findPipeNetworkSourceConnectorId(boiler(false), 'domestic-hot-water')).toBe(
      BOILER_SUPPLY_CONNECTOR_ID,
    );
  });
});
