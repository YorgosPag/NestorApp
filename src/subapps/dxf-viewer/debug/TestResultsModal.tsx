/**
 * 🧪 TEST RESULTS MODAL
 *
 * Enterprise-grade modal component για εμφάνιση unified test results
 * με copy button για εύκολο debugging.
 *
 * @module TestResultsModal
 * @category Debug
 */

'use client';

import * as React from 'react';
import type { UnifiedTestReport } from './unified-test-runner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';
import { layoutUtilities } from '@/styles/design-tokens';
import {
  getTestResultsInteractiveAutoStyles
} from '../ui/DxfViewerComponents.styles';

// ============================================================================
// TYPES
// ============================================================================

interface TestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: UnifiedTestReport | null;
  formattedReport: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const TestResultsModal: React.FC<TestResultsModalProps> = ({
  isOpen,
  onClose,
  report,
  formattedReport
}) => {
  const iconSizes = useIconSizes();
  const { getStatusBorder, getDirectionalBorder, getMultiDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'summary' | 'details' | 'raw'>('summary');

  // ✅ ENTERPRISE: Tab borders με CSS variables
  const getTabBorder = (tabName: string) => {
    return activeTab === tabName
      ? `${colors.bg.secondary} text-white ${getStatusBorder('info')}`
      : `${colors.bg.hover} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} ${HOVER_BACKGROUND_EFFECTS.GRAY_750}`;
  };

  // ✅ ENTERPRISE: Status borders με CSS variables
  const getTestStatusBorder = (status: 'passed' | 'failed' | 'warning' | 'info') => {
    switch (status) {
      case 'passed': return `${colors.bg.success} ${getStatusBorder('success')}`;
      case 'failed': return `${colors.bg.error} ${getStatusBorder('error')}`;
      case 'warning': return `${colors.bg.warning} ${getStatusBorder('warning')}`;
      case 'info': return `${colors.bg.info} ${getStatusBorder('info')}`;
    }
  };

  // Reset copied state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setActiveTab('summary'); // Reset to summary when opening
      console.log('🧪 TestResultsModal opened');
    }
  }, [isOpen]);

  // Debug: Log active tab changes
  React.useEffect(() => {
    console.log('🔄 Active tab changed to:', activeTab);
  }, [activeTab]);

  // 🔍 DEBUG: Check what's blocking pointer events
  React.useEffect(() => {
    if (isOpen) {
      console.log('🧪 Modal opened - checking pointer-events blockers...');

      // Find all elements with pointer-events: none
      const allElements = document.querySelectorAll('*');
      const blockers: HTMLElement[] = [];

      allElements.forEach((el) => {
        const style = window.getComputedStyle(el as HTMLElement);
        if (style.pointerEvents === 'none') {
          blockers.push(el as HTMLElement);
        }
      });

      console.log('🚫 Found', blockers.length, 'elements with pointer-events: none');

      // Check if any blocker has high z-index
      blockers.forEach((el, index) => {
        const zIndex = window.getComputedStyle(el).zIndex;
        if (zIndex !== 'auto' && parseInt(zIndex) > 1000) {
          console.warn(`⚠️ High z-index blocker #${index}:`, {
            element: el,
            zIndex,
            className: el.className,
            id: el.id
          });
        }
      });
    }
  }, [isOpen]);

  if (!isOpen || !report) return null;

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Handle download as JSON
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unified-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculate pass rate
  const passRate = ((report.passed / report.totalTests) * 100).toFixed(0);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75"
      style={canvasUI.positioning.floatingPanel.testModal.backdrop}
      onClick={onClose}
    >
      <div
        className={`relative ${colors.bg.secondary} rounded-lg shadow-2xl flex flex-col ${getStatusBorder('default')}`}
        style={canvasUI.positioning.floatingPanel.testModal.content}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className={`flex items-center justify-between px-6 py-4 ${colors.bg.secondary} rounded-t-lg ${getStatusBorder('default')} ${getDirectionalBorder('default', 'bottom')}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧪</span>
            <div>
              <h2 className="text-xl font-bold text-white">Ενιαίο Σύστημα Εκτέλεσης Τεστ - Αποτελέσματα</h2>
              <p className={`text-xs ${colors.text.muted} mt-1`}>
                {new Date(report.timestamp).toLocaleString()} • {report.totalDuration.toFixed(0)}ms σύνολο
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} text-2xl leading-none ${iconSizes.xl2} flex items-center justify-center rounded ${HOVER_BACKGROUND_EFFECTS.GRAY_BUTTON} transition-colors`}
          >
            ✕
          </button>
        </div>

        {/* STATS BAR */}
        <div className={`flex items-center justify-between px-6 py-3 ${colors.bg.secondary} ${getStatusBorder('default')} ${getDirectionalBorder('default', 'bottom')}`}>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className={`${colors.text.success} text-lg font-bold`}>{report.passed}</span>
              <span className={`text-xs ${colors.text.muted}`}>Επιτυχία</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`${colors.text.danger} text-lg font-bold`}>{report.failed}</span>
              <span className={`text-xs ${colors.text.muted}`}>Αποτυχία</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`${colors.text.warning} text-lg font-bold`}>{report.warnings}</span>
              <span className={`text-xs ${colors.text.muted}`}>Προειδοποιήσεις</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`${colors.text.info} text-lg font-bold`}>{passRate}%</span>
              <span className={`text-xs ${colors.text.muted}`}>Ποσοστό Επιτυχίας</span>
            </div>
          </div>

          <div className="flex gap-2" style={getTestResultsInteractiveAutoStyles()}>
            <button
              onClick={handleCopy}
              className={`px-4 py-2 text-sm font-medium rounded transition-all ${
                copied
                  ? `${colors.bg.success} text-white`
                  : `${colors.bg.info} text-white ${HOVER_BACKGROUND_EFFECTS.BLUE_LIGHT}`
              }`}
              style={getTestResultsInteractiveAutoStyles()}
            >
              {copied ? '✅ Αντιγράφηκε!' : '📋 Αντιγραφή Όλων'}
            </button>
            <button
              onClick={handleDownload}
              className={`px-4 py-2 text-sm font-medium rounded ${colors.bg.info} text-white ${HOVER_BACKGROUND_EFFECTS.PURPLE_LIGHT} transition-all`}
              style={getTestResultsInteractiveAutoStyles()}
            >
              💾 Λήψη JSON
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className={`flex gap-1 px-6 pt-4 ${colors.bg.secondary}`} style={getTestResultsInteractiveAutoStyles()}>
          <button
            onClick={() => {
              console.log('🔘 Summary tab clicked');
              setActiveTab('summary');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-all ${getTabBorder('summary')}`}
            style={getTestResultsInteractiveAutoStyles()}
          >
            📊 Περίληψη
          </button>
          <button
            onClick={() => {
              console.log('🔘 Details tab clicked');
              setActiveTab('details');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-all ${getTabBorder('details')}`}
            style={getTestResultsInteractiveAutoStyles()}
          >
            🔍 Λεπτομέρειες
          </button>
          <button
            onClick={() => {
              console.log('🔘 Raw tab clicked');
              setActiveTab('raw');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-all ${getTabBorder('raw')}`}
            style={getTestResultsInteractiveAutoStyles()}
          >
            📝 Ακατέργαστη Έξοδος
          </button>
        </div>

        {/* CONTENT */}
        <div className={`flex-1 overflow-y-auto ${colors.bg.secondary} px-6 py-4`}>
          {activeTab === 'summary' && <SummaryTab report={report} />}
          {activeTab === 'details' && <DetailsTab report={report} />}
          {activeTab === 'raw' && <RawTab formattedReport={formattedReport} />}
        </div>

        {/* FOOTER */}
        <div className={`flex items-center justify-between px-6 py-3 ${colors.bg.secondary} rounded-b-lg ${getStatusBorder('default')} ${getDirectionalBorder('default', 'top')}`}>
          <div className={`text-xs ${colors.text.disabled}`}>
            🖥️ Viewport: {report.systemInfo.viewport.width}×{report.systemInfo.viewport.height}
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded ${colors.bg.hover} text-white ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL} transition-all`}
          >
            Κλείσιμο
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUMMARY TAB
// ============================================================================

const SummaryTab: React.FC<{ report: UnifiedTestReport }> = ({ report }) => {
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES

  // ✅ ENTERPRISE: Test status borders με CSS variables
  const getTestStatusBorder = (status: 'success' | 'error' | 'warning' | 'info') => {
    switch (status) {
      case 'success': return `${colors.bg.success} ${getStatusBorder('success')}`;
      case 'error': return `${colors.bg.error} ${getStatusBorder('error')}`;
      case 'warning': return `${colors.bg.warning} ${getStatusBorder('warning')}`;
      default: return `${colors.bg.info} ${getStatusBorder('info')}`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {report.tests.map((test, index) => {
          const statusColor = getTestStatusBorder(test.status as 'success' | 'error' | 'warning' | 'info');

          const icon =
            test.status === 'success'
              ? '✅'
              : test.status === 'error'
              ? '❌'
              : test.status === 'warning'
              ? '⚠️'
              : 'ℹ️';

          return (
            <div
              key={index}
              className={`p-4 rounded border ${statusColor}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{icon}</span>
                  <span className="font-medium text-white text-sm">{test.name}</span>
                </div>
                <span className={`text-xs ${colors.text.muted}`}>{test.duration.toFixed(0)}ms</span>
              </div>
              <p className="text-xs ${colors.text.tertiary} leading-relaxed">{test.summary}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// DETAILS TAB
// ============================================================================

const DetailsTab: React.FC<{ report: UnifiedTestReport }> = ({ report }) => {
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
  const [expandedTests, setExpandedTests] = React.useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2" style={getTestResultsInteractiveAutoStyles()}>
      {report.tests.map((test, index) => {
        const isExpanded = expandedTests.has(index);
        const statusColor =
          test.status === 'success'
            ? colors.text.success
            : test.status === 'error'
            ? colors.text.danger
            : test.status === 'warning'
            ? colors.text.warning
            : colors.text.info;

        const icon =
          test.status === 'success'
            ? '✅'
            : test.status === 'error'
            ? '❌'
            : test.status === 'warning'
            ? '⚠️'
            : 'ℹ️';

        return (
          <div key={index} className={`rounded ${colors.bg.secondary} ${getStatusBorder('default')}`} style={getTestResultsInteractiveAutoStyles()}>
            <button
              onClick={() => {
                console.log(`🔽 Toggling test ${index}: ${test.name}`);
                toggleExpand(index);
              }}
              className={`w-full px-4 py-3 flex items-center justify-between ${HOVER_BACKGROUND_EFFECTS.GRAY_DARK} transition-colors`}
              style={getTestResultsInteractiveAutoStyles()}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{icon}</span>
                <span className={`font-medium ${statusColor}`}>{test.name}</span>
                <span className={`text-xs ${colors.text.disabled}`}>({test.duration.toFixed(0)}ms)</span>
              </div>
              <span className={`${colors.text.disabled}`}>{isExpanded ? '▼' : '▶'}</span>
            </button>

            {isExpanded && (
              <div className={`px-4 pb-4 pt-2 ${getStatusBorder('default')} ${getDirectionalBorder('default', 'top')}`}>
                <div className="space-y-2">
                  <div>
                    <span className={`text-xs ${colors.text.disabled}`}>Περίληψη:</span>
                    <p className={`text-sm ${colors.text.tertiary} mt-1`}>{test.summary}</p>
                  </div>
                  {test.details && (
                    <div>
                      <span className={`text-xs ${colors.text.disabled}`}>Λεπτομέρειες:</span>
                      <pre className={`text-xs ${colors.text.tertiary} mt-1 p-3 ${colors.bg.secondary} rounded overflow-x-auto`}>
                        {JSON.stringify(test.details, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <span className={`text-xs ${colors.text.disabled}`}>Χρονοσήμανση:</span>
                    <p className={`text-xs ${colors.text.muted} mt-1`}>{new Date(test.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// RAW TAB
// ============================================================================

const RawTab: React.FC<{ formattedReport: string }> = ({ formattedReport }) => {
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES

  return (
    <div className="h-full">
      <pre className={`text-xs ${colors.text.tertiary} font-mono whitespace-pre-wrap break-words p-4 ${colors.bg.secondary} rounded h-full overflow-y-auto`}>
        {formattedReport}
      </pre>
    </div>
  );
};
