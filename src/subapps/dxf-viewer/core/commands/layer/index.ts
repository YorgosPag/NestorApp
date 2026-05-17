/**
 * Layer commands barrel — ADR-358 §5.6.bis (Phase 10).
 *
 * Re-exports the 9 layer commands + shared utilities. Import from this barrel
 * in keyboard-shortcut handlers, context menus, ribbon dispatchers, and tests.
 */

export { LayerIsolateCommand, type LayerIsolateInput } from './LayerIsolateCommand';
export { LayerIsolateInverseCommand, type LayerIsolateInverseInput } from './LayerIsolateInverseCommand';
export { LayerUnisolateCommand } from './LayerUnisolateCommand';
export { LayerDimCommand, type LayerDimInput } from './LayerDimCommand';
export { LayerOffCommand, type LayerOffInput } from './LayerOffCommand';
export { LayerFreezeCommand, type LayerFreezeInput } from './LayerFreezeCommand';
export { LayerLockCommand, type LayerLockInput } from './LayerLockCommand';
export { LayerThawAllCommand } from './LayerThawAllCommand';
export { LayerOnAllCommand } from './LayerOnAllCommand';

export {
  captureAllLayersSnapshot,
  captureLayerSnapshot,
  restoreLayersSnapshot,
  restoreLayerEntry,
  makeLayerCommandKey,
  type UnisolateSnapshot,
  type UnisolateSnapshotEntry
} from './layer-command-utils';
