/**
 * ADR-415 Φ1 — Floorplan symbol category engine unit tests.
 *
 * The Revit-faithful heart: a sanitary symbol resolves to discipline `plumbing`
 * + IFC class `IfcSanitaryTerminal` + BimCategory `sanitary` — never furniture.
 */

import { resolveSymbolCategoryConfig } from '../floorplan-symbol-categories';

describe('resolveSymbolCategoryConfig', () => {
  it('maps sanitary → plumbing / IfcSanitaryTerminal / sanitary BimCategory', () => {
    const cfg = resolveSymbolCategoryConfig('sanitary');
    expect(cfg.discipline).toBe('plumbing');
    expect(cfg.ifcType).toBe('IfcSanitaryTerminal');
    expect(cfg.bimCategory).toBe('sanitary');
  });

  it('exposes an i18n label key (not a hardcoded literal)', () => {
    expect(resolveSymbolCategoryConfig('sanitary').labelKey).toBe('floorplanSymbol.category.sanitary');
  });
});
