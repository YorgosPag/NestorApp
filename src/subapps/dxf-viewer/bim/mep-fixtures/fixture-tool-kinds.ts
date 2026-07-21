/**
 * Fixture tool-kind barrel — SSoT re-export of every `*FixtureToolKind` string
 * predicate defined per fixture spec module.
 *
 * ADR-584 / N.18: extracted so consumers (click-dispatch + placement-tools hook)
 * import the whole set from ONE place instead of copy-pasting the same 9-line
 * import block — which token-clone-tripped CHECK 3.28.
 */
export { plumbingFixtureToolKind } from './plumbing-fixture-spec';
export { socketFixtureToolKind } from './socket-symbol-spec';
export { dataOutletFixtureToolKind } from './data-outlet-symbol-spec';
export { airTerminalFixtureToolKind } from './air-terminal-symbol-spec';
export { ahuFixtureToolKind } from './ahu-symbol-spec';
export { sprinklerFixtureToolKind } from './sprinkler-symbol-spec';
export { fireRiserFixtureToolKind } from './fire-riser-symbol-spec';
export { gasMeterFixtureToolKind } from './gas-meter-symbol-spec';
export { gasCookerFixtureToolKind } from './gas-cooker-symbol-spec';
