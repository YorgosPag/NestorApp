/**
 * 🛠️ Debug Tools Definitions
 *
 * Περιέχει όλα τα debug tool definitions για το TestsModal
 * Factory function που δέχεται το showCopyableNotification callback και React/ReactDOM
 *
 * 🏢 ENTERPRISE: Uses Lucide icons instead of emoji (centralized icon system)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import type { TestDefinition, NotificationFn } from '../types/tests.types';
import {
  Triangle,
  Target,
  Ruler,
  Crosshair,
  Move
} from 'lucide-react';

export function getDebugTools(showCopyableNotification: NotificationFn): TestDefinition[] {
  return [
    {
      id: 'corner-markers-toggle',
      name: 'Toggle Corner Markers',
      description: 'Κόκκινες γωνίες + περιμετρικές γραμμές + info panel',
      icon: Triangle,
      action: async () => {
        try {
          const existingDebug = document.getElementById('full-layout-debug');

          if (existingDebug) {
            existingDebug.remove();
            showCopyableNotification('Corner Markers: DISABLED ❌\n\n🔴 Κόκκινες γωνίες OFF\n🌈 Περιμετρικές γραμμές OFF', 'info');
          } else {
            const CornerMarkersModule = await import('../../../../debug/layout-debug/CornerMarkers');
            const CornerMarkersComponent = CornerMarkersModule.default;

            const container = document.createElement('div');
            container.id = 'full-layout-debug';
            document.body.appendChild(container);

            const root = ReactDOM.createRoot(container);
            root.render(React.createElement(CornerMarkersComponent));

            showCopyableNotification(
              'Corner Markers: ENABLED ✅\n\n' +
              '🔴 Κόκκινες γωνίες (30px × 30px)\n' +
              '🟡 Κίτρινη (πάνω) | 🔴 Κόκκινη (κάτω)\n' +
              '🟢 Πράσινη (αριστερά) | 🔵 Μπλε (δεξιά)\n' +
              'ℹ️ Info panel (κάτω αριστερά)',
              'success'
            );
          }
        } catch (error) {
          console.error('❌ Error toggling Corner Markers:', error);
          showCopyableNotification(`Corner Markers Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck console for details`, 'error');
        }
      }
    },
    {
      id: 'origin-markers-toggle',
      name: 'Toggle Origin (0,0) Markers',
      description: 'Εναλλαγή δεικτών προέλευσης',
      icon: Target,
      action: async () => {
        const module = await import('../../../../debug/OriginMarkersDebugOverlay');
        const { originMarkersDebug } = module;
        const enabled = originMarkersDebug.toggle();

        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('origin-markers-toggle', {
              detail: { enabled }
            }));
          }, 50);
        }

        showCopyableNotification(`Origin Markers: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`, enabled ? 'success' : 'info');
      }
    },
    {
      id: 'ruler-debug-toggle',
      name: 'Toggle Ruler Debug',
      description: 'Εναλλαγή αποσφαλμάτωσης χαράκων',
      icon: Ruler,
      action: async () => {
        const module = await import('../../../../debug/RulerDebugOverlay');
        const { rulerDebugOverlay } = module;
        const enabled = rulerDebugOverlay.toggle();

        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('ruler-debug-toggle', {
              detail: { enabled }
            }));
          }, 50);
        }

        const shortMessage = `Ruler Debug: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}\n\n${enabled ? '🎯 Tick Markers: RED (major) / GREEN (minor)\n📐 Calibration Grid: CYAN 100mm grid\n🔍 Auto-verification: ACTIVE' : 'All debug overlays hidden'}`;
        showCopyableNotification(shortMessage, enabled ? 'success' : 'info');
      }
    },
    {
      id: 'alignment-debug-toggle',
      name: 'Toggle Cursor-Snap Alignment',
      description: 'Εναλλαγή debug alignment overlay',
      icon: Crosshair,
      action: async () => {
        const module = await import('../../../../debug/CursorSnapAlignmentDebugOverlay');
        const { cursorSnapAlignmentDebug } = module;
        const enabled = cursorSnapAlignmentDebug.toggle();

        const message = enabled
          ? '🎯 Alignment Debug: ENABLED\n\n🔵 Blue = Cursor\n🟢 Green = Crosshair\n🔴 Red = Snap Marker\n\nΜετακίνησε τον cursor κοντά σε entity για snap,\nμετά ΚΑΝΕ CLICK για να καταγράψεις μετρήσεις!'
          : '🎯 Alignment Debug: DISABLED';

        showCopyableNotification(message, enabled ? 'success' : 'info');
      }
    },
    {
      id: 'live-coordinates-toggle',
      name: 'Toggle Live Coordinates',
      description: 'Live συντεταγμένες + κόκκινο crosshair με κίτρινη βουλίτσα',
      icon: Move,
      action: async () => {
        try {
          const existingCoords = document.getElementById('live-coords-debug');

          if (existingCoords) {
            existingCoords.remove();
            showCopyableNotification('Live Coordinates: DISABLED ❌', 'info');
          } else {
            // ADR-040 Phase XXII.C: TransformContext duplicate SSoT removed.
            // CoordinateDebugOverlay now reads transform from the singleton
            // ImmediateTransformStore — no provider wrap required.
            const CoordinateModule = await import('../../../../debug/layout-debug/CoordinateDebugOverlay');

            const container = document.createElement('div');
            container.id = 'live-coords-debug';
            document.body.appendChild(container);

            const root = ReactDOM.createRoot(container);
            root.render(React.createElement(CoordinateModule.default));

            showCopyableNotification(
              'Live Coordinates: ENABLED ✅\n\n' +
              '🎯 Live panel (top-left)\n' +
              '🔴 Red crosshair follows mouse\n' +
              '🟡 Yellow center dot\n' +
              '📋 F1-F4 shortcuts for copy',
              'success'
            );
          }
        } catch (error) {
          console.error('❌ Error toggling Live Coordinates:', error);
          showCopyableNotification(`Live Coordinates Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck console for details`, 'error');
        }
      }
    }
  ];
}
