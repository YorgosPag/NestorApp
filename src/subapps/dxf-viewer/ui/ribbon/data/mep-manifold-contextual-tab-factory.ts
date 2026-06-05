/**
 * ADR-408 Φ12 / Φ14 — Factory for the point-based manifold contextual ribbon tab.
 *
 * A `mep-manifold` entity has two kinds that share ONE entity type (for code
 * reuse) but read as DIFFERENT families in the property palette, exactly as Revit
 * shows a distribution manifold and a catch basin with their own type properties:
 *
 *   - `floor-manifold`     → συλλέκτης ύδρευσης/θέρμανσης (1 inlet + N outlets)
 *   - `drainage-collector` → φρεάτιο αποχέτευσης        (N inlets + 1 outlet)
 *
 * This factory is the SINGLE source of the tab STRUCTURE (panels, rows, command
 * keys, network fold-in, actions). The two kinds differ only in a small config
 * (`ManifoldContextualTabConfig`): the display labels and the combobox PRESETS.
 * Because both tabs reuse the same `MEP_MANIFOLD_RIBBON_KEYS` command keys, the
 * SAME `useRibbonMepManifoldBridge` drives both — no behavioural fork.
 *
 * @see contextual-mep-manifold-tab.ts          (water manifold config)
 * @see contextual-drainage-collector-tab.ts     (φρεάτιο config)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab, RibbonComboboxOption } from '../types/ribbon-types';
import {
  MEP_MANIFOLD_RIBBON_KEYS,
  MEP_MANIFOLD_RIBBON_KEYS_ACTIONS,
  MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/mep-manifold-command-keys';
import { MEP_PIPE_NETWORK_RIBBON_ACTIONS } from '../hooks/bridge/mep-pipe-network-command-keys';

/** Build an mm-preset option whose label is the literal number (no t()). */
function mmOption(value: number): RibbonComboboxOption {
  return { value: String(value), labelKey: String(value), isLiteralLabel: true };
}

/** Build a list of literal mm presets. */
export function mmOptions(values: readonly number[]): readonly RibbonComboboxOption[] {
  return values.map(mmOption);
}

/** Build a list of literal integer presets (outlet/inlet count). */
export function countOptions(values: readonly number[]): readonly RibbonComboboxOption[] {
  return values.map((v) => ({ value: String(v), labelKey: String(v), isLiteralLabel: true }));
}

/**
 * System (hydraulic) classification options — shared. Translated labels (pass
 * through t()). Mirrors `PlumbingSystemClassification`; the manifold owns it and
 * a network created from it inherits it. Only shown when `includeSystemPanel`.
 */
const CLASSIFICATION_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: 'domestic-cold-water', labelKey: 'ribbon.commands.mepClassification.domestic-cold-water' },
  { value: 'domestic-hot-water', labelKey: 'ribbon.commands.mepClassification.domestic-hot-water' },
  { value: 'sanitary-drainage', labelKey: 'ribbon.commands.mepClassification.sanitary-drainage' },
  { value: 'hydronic-supply', labelKey: 'ribbon.commands.mepClassification.hydronic-supply' },
  { value: 'hydronic-return', labelKey: 'ribbon.commands.mepClassification.hydronic-return' },
];

/** The kind-specific bits that distinguish a water-manifold tab from a φρεάτιο tab. */
export interface ManifoldContextualTabConfig {
  /** Stable tab id (e.g. `mep-manifold-editor`). */
  readonly tabId: string;
  /** Panel-id prefix, kept distinct per kind to avoid React key collisions. */
  readonly panelIdPrefix: string;
  /** Contextual trigger string this tab listens for. */
  readonly trigger: string;
  /** Tab button label (i18n key). */
  readonly tabLabelKey: string;
  /**
   * Show the System/classification panel? Water manifold: yes (it distributes
   * any of 5 hydraulic types). φρεάτιο: no — a catch basin is always sanitary.
   */
  readonly includeSystemPanel: boolean;
  /** Panel titles (i18n keys). */
  readonly panelLabelKeys: {
    readonly geometry: string;
    /** "Outlets" for a water manifold; "Inlets" for a φρεάτιο. */
    readonly connections: string;
    readonly actions: string;
  };
  /** Per-field command labels (i18n keys). Command KEYS stay shared (the bridge). */
  readonly fieldLabelKeys: {
    readonly width: string;
    readonly length: string;
    readonly bodyHeight: string;
    readonly mountingElevation: string;
    /** Counts outlets (water) or inlets (φρεάτιο). */
    readonly count: string;
    readonly inletDiameter: string;
    readonly outletDiameter: string;
    readonly close: string;
    readonly delete: string;
  };
  /** Combobox presets, kind-tuned (square catch-basin vs thin distribution bar). */
  readonly presets: {
    readonly width: readonly RibbonComboboxOption[];
    readonly length: readonly RibbonComboboxOption[];
    readonly bodyHeight: readonly RibbonComboboxOption[];
    readonly mountingElevation: readonly RibbonComboboxOption[];
    readonly count: readonly RibbonComboboxOption[];
    readonly inletDiameter: readonly RibbonComboboxOption[];
    readonly outletDiameter: readonly RibbonComboboxOption[];
  };
}

/**
 * Build a manifold contextual `RibbonTab` from a kind config. Structure is fixed;
 * only labels + presets vary. Panels: [System?] → Geometry → Connections →
 * Δίκτυο (self-hiding) → Actions.
 */
export function buildMepManifoldContextualTab(config: ManifoldContextualTabConfig): RibbonTab {
  const { tabId, panelIdPrefix, trigger, tabLabelKey, fieldLabelKeys, panelLabelKeys, presets } = config;

  const systemPanel: RibbonTab['panels'][number] = {
    id: `${panelIdPrefix}-system`,
    labelKey: 'ribbon.panels.mepManifoldSystem',
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: 'mepManifold.classification',
              labelKey: 'ribbon.commands.mepClassification.label',
              commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.classification,
              comboboxWidthPx: 150,
              options: CLASSIFICATION_OPTIONS,
            },
          },
        ],
      },
    ],
  };

  const geometryPanel: RibbonTab['panels'][number] = {
    id: `${panelIdPrefix}-geometry`,
    labelKey: panelLabelKeys.geometry,
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: 'mepManifold.width',
              labelKey: fieldLabelKeys.width,
              commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.width,
              comboboxWidthPx: 90,
              options: presets.width,
            },
          },
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: 'mepManifold.length',
              labelKey: fieldLabelKeys.length,
              commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.length,
              comboboxWidthPx: 80,
              options: presets.length,
            },
          },
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: 'mepManifold.bodyHeight',
              labelKey: fieldLabelKeys.bodyHeight,
              commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.bodyHeight,
              comboboxWidthPx: 80,
              options: presets.bodyHeight,
            },
          },
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: 'mepManifold.mountingElevation',
              labelKey: fieldLabelKeys.mountingElevation,
              commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.mountingElevation,
              comboboxWidthPx: 90,
              options: presets.mountingElevation,
            },
          },
        ],
      },
    ],
  };

  const connectionsPanel: RibbonTab['panels'][number] = {
    id: `${panelIdPrefix}-connections`,
    labelKey: panelLabelKeys.connections,
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: 'mepManifold.outletCount',
              labelKey: fieldLabelKeys.count,
              commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.outletCount,
              comboboxWidthPx: 70,
              options: presets.count,
            },
          },
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: 'mepManifold.inletDiameter',
              labelKey: fieldLabelKeys.inletDiameter,
              commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.inletDiameter,
              comboboxWidthPx: 80,
              options: presets.inletDiameter,
            },
          },
          {
            type: 'combobox',
            size: 'small',
            command: {
              id: 'mepManifold.outletDiameter',
              labelKey: fieldLabelKeys.outletDiameter,
              commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.outletDiameter,
              comboboxWidthPx: 80,
              options: presets.outletDiameter,
            },
          },
        ],
      },
    ],
  };

  // ADR-408 Φ13 fold-in — manage the pipe network this manifold sources (Revit
  // "System Properties" from the equipment). Self-hides when no network is sourced.
  // Reuses the domain-agnostic `mep-circuit-*` widgets + pipe-network actions.
  const networkPanel: RibbonTab['panels'][number] = {
    id: `${panelIdPrefix}-network`,
    labelKey: 'ribbon.panels.mepPipeNetworkProperties',
    visibilityKey: MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS.hasNetwork,
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'widget',
            size: 'small',
            widgetId: 'mep-circuit-picker',
            command: {
              id: 'mepManifold.network.picker',
              labelKey: 'ribbon.commands.mepCircuit.networkPicker',
              commandKey: 'mepManifold.network.picker',
            },
          },
        ],
      },
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'widget',
            size: 'small',
            widgetId: 'mep-circuit-name',
            command: {
              id: 'mepManifold.network.name',
              labelKey: 'ribbon.commands.mepCircuit.name',
              commandKey: 'mepManifold.network.name',
            },
          },
          {
            type: 'simple',
            size: 'small',
            command: {
              id: 'mepManifold.network.addMembers',
              labelKey: 'ribbon.commands.mepPipeNetwork.addMembers',
              tooltipKey: 'ribbon.commands.mepPipeNetwork.addMembersTooltip',
              icon: 'bim-pipe',
              commandKey: MEP_PIPE_NETWORK_RIBBON_ACTIONS.addMembers,
              action: MEP_PIPE_NETWORK_RIBBON_ACTIONS.addMembers,
            },
          },
        ],
      },
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'widget',
            size: 'small',
            widgetId: 'mep-circuit-color',
            command: {
              id: 'mepManifold.network.color',
              labelKey: 'ribbon.commands.mepCircuit.color',
              commandKey: 'mepManifold.network.color',
            },
          },
          {
            type: 'simple',
            size: 'small',
            command: {
              id: 'mepManifold.network.removeMembers',
              labelKey: 'ribbon.commands.mepPipeNetwork.removeMembers',
              tooltipKey: 'ribbon.commands.mepPipeNetwork.removeMembersTooltip',
              icon: 'trash',
              commandKey: MEP_PIPE_NETWORK_RIBBON_ACTIONS.removeMembers,
              action: MEP_PIPE_NETWORK_RIBBON_ACTIONS.removeMembers,
            },
          },
        ],
      },
    ],
  };

  const actionsPanel: RibbonTab['panels'][number] = {
    id: `${panelIdPrefix}-actions`,
    labelKey: panelLabelKeys.actions,
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'simple',
            size: 'small',
            command: {
              id: 'mepManifold.close',
              labelKey: fieldLabelKeys.close,
              icon: 'select',
              commandKey: MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.close,
              action: MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.close,
            },
          },
          {
            type: 'simple',
            size: 'small',
            command: {
              id: 'mepManifold.delete',
              labelKey: fieldLabelKeys.delete,
              icon: 'trash',
              commandKey: MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.delete,
              action: MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.delete,
            },
          },
        ],
      },
    ],
  };

  return {
    id: tabId,
    labelKey: tabLabelKey,
    isContextual: true,
    contextualTrigger: trigger,
    panels: [
      ...(config.includeSystemPanel ? [systemPanel] : []),
      geometryPanel,
      connectionsPanel,
      networkPanel,
      actionsPanel,
    ],
  };
}
