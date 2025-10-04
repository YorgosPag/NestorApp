'use client';

import React from 'react';

interface GridTestButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const GridTestButton: React.FC<GridTestButtonProps> = ({ onNotify }) => {
  const handleTest = () => {
    console.log('🎯 GRID ENTERPRISE TEST TRIGGERED FROM HEADER');
    import('../../debug/grid-enterprise-test').then(module => {
      const { runGridEnterpriseTests } = module;

      runGridEnterpriseTests().then(report => {
        console.log('📊 GRID ENTERPRISE TEST REPORT:', report);

        const summary = `Grid Enterprise Tests Complete!\n\n` +
          `✅ Passed: ${report.passed}/${report.totalTests}\n` +
          `❌ Failed: ${report.failed}\n` +
          `⚠️ Warnings: ${report.warnings}\n\n` +
          `🏗️ Topological Integrity: ${report.topologicalIntegrity}%\n` +
          `📏 Coordinate Precision: ${report.coordinatePrecision ? '✅ OK' : '❌ FAILED'}\n` +
          `🎨 Grid Pixels Detected: ${report.gridPixels}\n\n` +
          `Check console for detailed report.`;

        onNotify(summary, report.failed === 0 ? 'success' : 'error');
      }).catch(error => {
        console.error('❌ GRID TEST ERROR:', error);
        onNotify(`Grid test failed: ${error.message}`, 'error');
      });
    });
  };

  return (
    <button
      onClick={handleTest}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#14B8A6')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0D9488')}
    >
      📐 Grid TEST
    </button>
  );
};
