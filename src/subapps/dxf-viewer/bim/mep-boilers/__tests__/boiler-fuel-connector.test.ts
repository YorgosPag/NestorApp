/**
 * ADR-408 (fuel domain foundation) — `buildBoilerFuelConnector` pure builder.
 *
 * Pins the combustion fuel SUPPLY inlet of a gas/oil boiler (τροφοδοσία καυσίμου): it is
 * a `fuel`-domain connector (NOT pipe — fuel is not water plumbing), `flow:'in'` (fuel
 * FEEDS the boiler), carries the supplied-medium classification (`fuel-gas`/`fuel-oil`)
 * and the nominal line diameter, with the stable host-local id `boiler-fuel`. Mirror of
 * how the flue founded the duct domain (`buildBoilerFlueConnector`).
 */

import {
  buildBoilerFuelConnector,
  BOILER_FUEL_CONNECTOR_ID,
} from '../../types/mep-connector-types';

describe('buildBoilerFuelConnector', () => {
  const pos = { x: 0, y: 175, z: 0 };

  it('is a fuel-domain inlet with the stable host-local id', () => {
    const c = buildBoilerFuelConnector(pos, 20, 'fuel-gas');
    expect(c.connectorId).toBe(BOILER_FUEL_CONNECTOR_ID);
    expect(c.connectorId).toBe('boiler-fuel');
    expect(c.domain).toBe('fuel');
    expect(c.flow).toBe('in'); // fuel feeds the boiler
  });

  it('carries the supplied-medium classification + diameter on the fuel payload', () => {
    const gas = buildBoilerFuelConnector(pos, 20, 'fuel-gas');
    expect(gas.fuel?.systemClassification).toBe('fuel-gas');
    expect(gas.fuel?.diameterMm).toBe(20);

    const oil = buildBoilerFuelConnector(pos, 15, 'fuel-oil');
    expect(oil.fuel?.systemClassification).toBe('fuel-oil');
    expect(oil.fuel?.diameterMm).toBe(15);
  });

  it('carries no pipe/duct/electrical payload (disjoint domain)', () => {
    const c = buildBoilerFuelConnector(pos, 20, 'fuel-gas');
    expect(c.pipe).toBeUndefined();
    expect(c.duct).toBeUndefined();
    expect(c.electrical).toBeUndefined();
  });

  it('stores the local position verbatim (caller resolves world via connectorWorldPosition)', () => {
    const c = buildBoilerFuelConnector(pos, 20, 'fuel-gas');
    expect(c.localPosition).toEqual(pos);
  });
});
