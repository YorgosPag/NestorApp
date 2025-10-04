'use client';

import React from 'react';

interface CursorCrosshairTestButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const CursorCrosshairTestButton: React.FC<CursorCrosshairTestButtonProps> = ({ onNotify }) => {
  const handleTest = () => {
    console.log('🏢 ENTERPRISE CURSOR-CROSSHAIR ALIGNMENT TEST TRIGGERED');
    import('../../debug/enterprise-cursor-crosshair-test').then(module => {
      const { runEnterpriseMouseCrosshairTests, startEnterpriseInteractiveTest } = module.default;

      console.log('🔍 Running enterprise cursor-crosshair alignment tests...');
      const results = runEnterpriseMouseCrosshairTests();

      const summary = `Enterprise Test: ${results.overallStatus}
Scenarios: ${results.passedScenarios}/${results.totalScenarios} passed
Avg Performance: ${results.avgPerformance.toFixed(1)}ms
Max Error: ${results.maxError.toFixed(3)}px
Min Pass Rate: ${(results.minPassRate * 100).toFixed(1)}%

Check console for detailed metrics`;

      console.log('🎮 Starting enterprise interactive test - Move mouse over canvas, press ESC to stop');
      startEnterpriseInteractiveTest();

      onNotify(summary, results.overallStatus === 'PASS' ? 'success' : 'warning');
    }).catch(error => {
      console.error('Failed to load enterprise cursor-crosshair test:', error);
      onNotify('Failed to load enterprise cursor-crosshair test module', 'error');
    });
  };

  return (
    <button
      onClick={handleTest}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#C026D3', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#D946EF')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#C026D3')}
    >
      🏢 Enterprise Test (F3)
    </button>
  );
};
