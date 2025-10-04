'use client';

import React from 'react';

interface InspectDOMButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const InspectDOMButton: React.FC<InspectDOMButtonProps> = ({ onNotify }) => {
  const handleInspect = () => {
    console.log('🔍 DOM INSPECTOR TRIGGERED FROM HEADER');
    import('../../debug/dom-inspector').then(module => {
      const { inspectDOMElements, findFloatingPanelAdvanced, showDetailedDOMInfo } = module;

      console.log('📋 Running complete DOM inspection...');
      const inspection = inspectDOMElements();

      console.log('🔍 Trying advanced floating panel detection...');
      const panel = findFloatingPanelAdvanced();

      console.log('📊 Showing detailed DOM info...');
      showDetailedDOMInfo();

      const summary = `DOM Inspection Complete!\n\n` +
        `Floating Panels Found: ${inspection.floatingPanels.filter(p => p.found).length}\n` +
        `Tabs Found: ${inspection.tabs.length}\n` +
        `Cards Found: ${inspection.cards.length}\n` +
        `Canvases Found: ${inspection.canvases.length}\n` +
        `Advanced Panel Detection: ${panel ? '✅ SUCCESS' : '❌ FAILED'}\n\n` +
        `Check console for detailed results.`;

      onNotify(summary, 'info');
    }).catch(err => {
      console.error('Failed to load DOM inspector:', err);
      onNotify('Failed to load DOM inspector', 'error');
    });
  };

  return (
    <button
      onClick={handleInspect}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#0284C7', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0EA5E9')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284C7')}
    >
      🔍 Inspect DOM
    </button>
  );
};
