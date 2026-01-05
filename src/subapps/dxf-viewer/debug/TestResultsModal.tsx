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
import { PANEL_LAYOUT } from '../config/panel-tokens';

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
      ? `${colors.bg.secondary} ${colors.text.WHITE} ${getStatusBorder('info')}`
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
      setTimeout(() => setCopied(false), PANEL_LAYOUT.TIMING.COPY_FEEDBACK_RESET);
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
      className={`fixed ${PANEL_LAYOUT.INSET['0']} flex items-center justify-center ${colors.bg.modalBackdropDark}`}
      style={canvasUI.positioning.floatingPanel.testModal.backdrop}
      onClick={onClose}
    >
      <div
        className={`relative ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.LG} ${PANEL_LAYOUT.SHADOW['2XL']} flex flex-col ${getStatusBorder('default')}`}
        style={canvasUI.positioning.floatingPanel.testModal.content}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <header className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.XXL} ${PANEL_LAYOUT.PADDING.TOP_LG} ${PANEL_LAYOUT.PADDING.BOTTOM_LG} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.TOP_LG} ${getStatusBorder('default')} ${getDirectionalBorder('default', 'bottom')}`}>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD}`}>
            <span className={PANEL_LAYOUT.TYPOGRAPHY['2XL']}>🧪</span>
            <div>
              <h2 className={`${PANEL_LAYOUT.TYPOGRAPHY.XL} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${colors.text.WHITE}`}>Ενιαίο Σύστημα Εκτέλεσης Τεστ - Αποτελέσματα</h2>
              <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
                {new Date(report.timestamp).toLocaleString()} • {report.totalDuration.toFixed(0)}ms σύνολο
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} ${PANEL_LAYOUT.TYPOGRAPHY['2XL']} ${PANEL_LAYOUT.LEADING.NONE} ${iconSizes.xl2} flex items-center justify-center ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${HOVER_BACKGROUND_EFFECTS.GRAY_BUTTON} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
          >
            ✕
          </button>
        </header>

        {/* STATS BAR */}
        <section className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.XXL} ${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${getStatusBorder('default')} ${getDirectionalBorder('default', 'bottom')}`}>
          <div className={`flex ${PANEL_LAYOUT.GAP.XL}`}>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <span className={`${colors.text.success} ${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>{report.passed}</span>
              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>Επιτυχία</span>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <span className={`${colors.text.danger} ${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>{report.failed}</span>
              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>Αποτυχία</span>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <span className={`${colors.text.warning} ${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>{report.warnings}</span>
              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>Προειδοποιήσεις</span>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <span className={`${colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>{passRate}%</span>
              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>Ποσοστό Επιτυχίας</span>
            </div>
          </div>

          <div className={`flex ${PANEL_LAYOUT.GAP.SM}`} style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}>
            <button
              onClick={handleCopy}
              className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.TRANSITION.ALL} ${
                copied
                  ? `${colors.bg.success} ${colors.text.WHITE}`
                  : `${colors.bg.info} ${colors.text.WHITE} ${HOVER_BACKGROUND_EFFECTS.BLUE_LIGHT}`
              }`}
              style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}
            >
              {copied ? 'Αντιγράφηκε!' : 'Αντιγραφή Όλων'}
            </button>
            <button
              onClick={handleDownload}
              className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${colors.bg.info} ${colors.text.WHITE} ${HOVER_BACKGROUND_EFFECTS.PURPLE_LIGHT} ${PANEL_LAYOUT.TRANSITION.ALL}`}
              style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}
            >
              Λήψη JSON
            </button>
          </div>
        </section>

        {/* TABS */}
        <nav className={`flex ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.XXL} ${PANEL_LAYOUT.PADDING.TOP_LG} ${colors.bg.secondary}`} style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}>
          <button
            onClick={() => {
              console.log('Summary tab clicked');
              setActiveTab('summary');
            }}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.ROUNDED.TOP} ${PANEL_LAYOUT.TRANSITION.ALL} ${getTabBorder('summary')}`}
            style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}
          >
            Περίληψη
          </button>
          <button
            onClick={() => {
              console.log('Details tab clicked');
              setActiveTab('details');
            }}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.ROUNDED.TOP} ${PANEL_LAYOUT.TRANSITION.ALL} ${getTabBorder('details')}`}
            style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}
          >
            Λεπτομέρειες
          </button>
          <button
            onClick={() => {
              console.log('Raw tab clicked');
              setActiveTab('raw');
            }}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.ROUNDED.TOP} ${PANEL_LAYOUT.TRANSITION.ALL} ${getTabBorder('raw')}`}
            style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}
          >
            Ακατέργαστη Έξοδος
          </button>
        </nav>

        {/* CONTENT */}
        <main className={`flex-1 ${PANEL_LAYOUT.OVERFLOW.Y_AUTO} ${colors.bg.secondary} ${PANEL_LAYOUT.SPACING.XXL} ${PANEL_LAYOUT.SPACING.LG}`}>
          {activeTab === 'summary' && <SummaryTab report={report} />}
          {activeTab === 'details' && <DetailsTab report={report} />}
          {activeTab === 'raw' && <RawTab formattedReport={formattedReport} />}
        </main>

        {/* FOOTER */}
        <footer className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.XXL} ${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.BOTTOM_LG} ${getStatusBorder('default')} ${getDirectionalBorder('default', 'top')}`}>
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.disabled}`}>
            🖥️ Viewport: {report.systemInfo.viewport.width}×{report.systemInfo.viewport.height}
          </div>
          <button
            onClick={onClose}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${colors.bg.hover} ${colors.text.WHITE} ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL} ${PANEL_LAYOUT.TRANSITION.ALL}`}
          >
            Κλείσιμο
          </button>
        </footer>
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
    <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
      <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.LG}`}>
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
            <article
              key={index}
              className={`${PANEL_LAYOUT.SPACING.LG} ${PANEL_LAYOUT.ROUNDED.DEFAULT} border ${statusColor}`}
            >
              <div className={`flex items-start justify-between ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
                <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                  <span className={PANEL_LAYOUT.TYPOGRAPHY.XL}>{icon}</span>
                  <span className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.WHITE} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>{test.name}</span>
                </div>
                <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{test.duration.toFixed(0)}ms</span>
              </div>
              <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.tertiary} ${PANEL_LAYOUT.LEADING.RELAXED}`}>{test.summary}</p>
            </article>
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
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens(); // ✅ ENTERPRISE FIX: Add missing border tokens
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
    <div className={PANEL_LAYOUT.SPACING.GAP_SM} style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}>
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
          <div key={index} className={`${PANEL_LAYOUT.ROUNDED.DEFAULT} ${colors.bg.secondary} ${getStatusBorder('default')}`} style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}>
            <button
              onClick={() => {
                console.log(`🔽 Toggling test ${index}: ${test.name}`);
                toggleExpand(index);
              }}
              className={`w-full ${PANEL_LAYOUT.SPACING.COMFORTABLE} flex items-center justify-between ${HOVER_BACKGROUND_EFFECTS.GRAY_DARK} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
              style={(getTestResultsInteractiveAutoStyles?.() || {}) as React.CSSProperties}
            >
              <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD}`}>
                <span className={PANEL_LAYOUT.TYPOGRAPHY.LG}>{icon}</span>
                <span className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${statusColor}`}>{test.name}</span>
                <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.disabled}`}>({test.duration.toFixed(0)}ms)</span>
              </div>
              <span className={`${colors.text.disabled}`}>{isExpanded ? '▼' : '▶'}</span>
            </button>

            {isExpanded && (
              <div className={`${PANEL_LAYOUT.SPACING.COMFORTABLE} ${PANEL_LAYOUT.PADDING.TOP_SM} ${getStatusBorder('default')} ${getDirectionalBorder('default', 'top')}`}>
                <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
                  <div>
                    <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.disabled}`}>Περίληψη:</span>
                    <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.tertiary} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>{test.summary}</p>
                  </div>
                  {test.details && (
                    <div>
                      <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.disabled}`}>Λεπτομέρειες:</span>
                      <pre className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.tertiary} ${PANEL_LAYOUT.MARGIN.TOP_XS} ${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.OVERFLOW.X_AUTO}`}>
                        {JSON.stringify(test.details, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.disabled}`}>Χρονοσήμανση:</span>
                    <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>{new Date(test.timestamp).toLocaleString()}</p>
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
    <div className={PANEL_LAYOUT.HEIGHT.FULL}>
      <pre className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.tertiary} font-mono whitespace-pre-wrap break-words ${PANEL_LAYOUT.SPACING.LG} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.HEIGHT.FULL} ${PANEL_LAYOUT.OVERFLOW.Y_AUTO}`}>
        {formattedReport}
      </pre>
    </div>
  );
};
