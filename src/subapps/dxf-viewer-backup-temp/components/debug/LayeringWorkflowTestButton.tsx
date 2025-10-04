'use client';

import React from 'react';

interface LayeringWorkflowTestButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const LayeringWorkflowTestButton: React.FC<LayeringWorkflowTestButtonProps> = ({ onNotify }) => {
  const handleTest = () => {
    console.log('🎯 LAYERING WORKFLOW TEST TRIGGERED FROM HEADER');
    import('../../debug/layering-workflow-test').then(module => {
      const runLayeringWorkflowTest = module.runLayeringWorkflowTest;
      runLayeringWorkflowTest().then(result => {
        console.log('📊 LAYERING WORKFLOW RESULT:', result);
        const successSteps = result.steps.filter(s => s.status === 'success').length;
        const totalSteps = result.steps.length;
        const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;

        if (result.layerData) {
          console.log('🎨 Layer Display Data:', result.layerData);
        }

        onNotify(summary, result.success ? 'success' : 'error');
      }).catch(err => {
        console.error('Failed to run layering workflow test:', err);
        onNotify('Failed to run workflow test', 'error');
      });
    }).catch(err => {
      console.error('Failed to load layering workflow test:', err);
      onNotify('Failed to load workflow test module', 'error');
    });
  };

  return (
    <button
      onClick={handleTest}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#65A30D', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#84CC16')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#65A30D')}
    >
      🔄 Test Layering (Ctrl+F2)
    </button>
  );
};
