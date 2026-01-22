/**
 * RESPONSIVE DASHBOARD LAYOUT
 * Geo-Alert System - Phase 6: Enterprise Responsive Layout System
 *
 * Advanced responsive dashboard με adaptive layout, collapsible sidebar,
 * και intelligent component placement. Implements modern layout patterns.
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { useTheme, useBreakpoint } from '../theme/ThemeProvider';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '../../../../../styles/design-tokens/canvas';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================================================
// LAYOUT TYPES
// ============================================================================

export interface DashboardLayoutProps {
  children: ReactNode;
  header?: ReactNode;
  sidebar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  sidebarCollapsible?: boolean;
  sidebarDefaultCollapsed?: boolean;
  headerHeight?: number;
  footerHeight?: number;
  sidebarWidth?: number;
  sidebarCollapsedWidth?: number;
  fluid?: boolean;
  centered?: boolean;
}

export interface GridItemProps {
  children: ReactNode;
  span?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; '2xl'?: number };
  offset?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; '2xl'?: number };
  order?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; '2xl'?: number };
  className?: string;
}

export interface GridProps {
  children: ReactNode;
  columns?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; '2xl'?: number };
  gap?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; '2xl'?: number };
  className?: string;
}

export interface CardGridProps {
  children: ReactNode;
  minCardWidth?: number;
  maxCardWidth?: number;
  gap?: number;
  className?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getResponsiveValue = (
  value: number | Record<string, number> | undefined,
  breakpoint: string,
  defaultValue: number = 1
): number => {
  if (typeof value === 'number') return value;
  if (!value) return defaultValue;

  const breakpointOrder = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  const currentIndex = breakpointOrder.indexOf(breakpoint);

  // Find the closest smaller or equal breakpoint value
  for (let i = currentIndex; i >= 0; i--) {
    const bp = breakpointOrder[i];
    if (value[bp] !== undefined) {
      return value[bp];
    }
  }

  return defaultValue;
};

const generateGridClass = (
  property: string,
  value: number | Record<string, number> | undefined,
  breakpoint: string
): string => {
  const resolvedValue = getResponsiveValue(value, breakpoint);
  return `${property}-${resolvedValue}`;
};

// ============================================================================
// GRID SYSTEM COMPONENTS
// ============================================================================

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 12,
  gap = 4,
  className = ''
}) => {
  const breakpoint = useBreakpoint();
  const { theme } = useTheme();

  const cols = getResponsiveValue(columns, breakpoint, 12);
  const gapValue = getResponsiveValue(gap, breakpoint, 4);

  return (
    <div
      className={`responsive-grid ${className}`}
      style={canvasUI.positioning.responsive.responsiveGrid(cols, gapValue)}
    >
      {children}
    </div>
  );
};

export const GridItem: React.FC<GridItemProps> = ({
  children,
  span = 1,
  offset = 0,
  order,
  className = ''
}) => {
  const breakpoint = useBreakpoint();

  const spanValue = getResponsiveValue(span, breakpoint, 1);
  const offsetValue = getResponsiveValue(offset, breakpoint, 0);
  const orderValue = order ? getResponsiveValue(order, breakpoint, 0) : undefined;

  return (
    <div
      className={`grid-item ${className}`}
      style={canvasUI.positioning.responsive.responsiveGridItem(spanValue, offsetValue, orderValue)}
    >
      {children}
    </div>
  );
};

export const CardGrid: React.FC<CardGridProps> = ({
  children,
  minCardWidth = 280,
  maxCardWidth = 400,
  gap = 6,
  className = ''
}) => {
  const { theme } = useTheme();

  return (
    <div
      className={`card-grid ${className}`}
      style={canvasUI.positioning.responsive.responsiveCardGrid(minCardWidth, maxCardWidth, gap)}
    >
      {children}
    </div>
  );
};

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

interface SidebarProps {
  children: ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  width: number;
  collapsedWidth: number;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  children,
  isCollapsed,
  onToggle,
  width,
  collapsedWidth,
  className = ''
}) => {
  const { theme, isDark } = useTheme();
  const breakpoint = useBreakpoint();

  // Auto-collapse on mobile
  const isMobile = ['xs', 'sm'].includes(breakpoint);
  const shouldAutoCollapse = isMobile && !isCollapsed;

  useEffect(() => {
    if (shouldAutoCollapse) {
      onToggle();
    }
  }, [isMobile, shouldAutoCollapse, onToggle]);

  return (
    <aside
      className={`dashboard-sidebar ${className}`}
      style={canvasUI.positioning.responsive.dashboardSidebar(isCollapsed, width, collapsedWidth)}
    >
      <button
        onClick={onToggle}
        style={canvasUI.positioning.responsive.sidebarToggleButton(isCollapsed)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '→' : '←'}
      </button>

      <div style={canvasUI.positioning.responsive.sidebarContent(isCollapsed)}>
        {children}
      </div>
    </aside>
  );
};

// ============================================================================
// HEADER COMPONENT
// ============================================================================

interface HeaderProps {
  children: ReactNode;
  height: number;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({
  children,
  height,
  sidebarWidth,
  sidebarCollapsed,
  className = ''
}) => {
  const { theme } = useTheme();

  return (
    <header
      className={`dashboard-header ${className}`}
      style={canvasUI.positioning.responsive.dashboardHeader(height, sidebarWidth, sidebarCollapsed)}
    >
      {children}
    </header>
  );
};

// ============================================================================
// FOOTER COMPONENT
// ============================================================================

interface FooterProps {
  children: ReactNode;
  height: number;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  className?: string;
}

const Footer: React.FC<FooterProps> = ({
  children,
  height,
  sidebarWidth,
  sidebarCollapsed,
  className = ''
}) => {
  const { theme } = useTheme();

  return (
    <footer
      className={`dashboard-footer ${className}`}
      style={canvasUI.positioning.responsive.dashboardFooter(height, sidebarWidth, sidebarCollapsed)}
    >
      {children}
    </footer>
  );
};

// ============================================================================
// MAIN CONTENT AREA
// ============================================================================

interface MainContentProps {
  children: ReactNode;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  headerHeight: number;
  footerHeight: number;
  fluid: boolean;
  centered: boolean;
  className?: string;
}

const MainContent: React.FC<MainContentProps> = ({
  children,
  sidebarWidth,
  sidebarCollapsed,
  headerHeight,
  footerHeight,
  fluid,
  centered,
  className = ''
}) => {
  const { theme } = useTheme();
  const breakpoint = useBreakpoint();

  return (
    <main
      className={`dashboard-main ${className}`}
      style={canvasUI.positioning.responsive.dashboardMainContent(sidebarWidth, sidebarCollapsed, headerHeight, footerHeight)}
    >
      <div style={canvasUI.positioning.responsive.dashboardContentContainer(fluid, centered)}>
        {children}
      </div>
    </main>
  );
};

// ============================================================================
// MAIN DASHBOARD LAYOUT COMPONENT
// ============================================================================

export const ResponsiveDashboard: React.FC<DashboardLayoutProps> = ({
  children,
  header,
  sidebar,
  footer,
  className = '',
  sidebarCollapsible = true,
  sidebarDefaultCollapsed = false,
  headerHeight = 64,
  footerHeight = 0,
  sidebarWidth = 256,
  sidebarCollapsedWidth = 64,
  fluid = false,
  centered = true
}) => {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [sidebarCollapsed, setSidebarCollapsed] = useState(sidebarDefaultCollapsed);
  const { theme, isDark, prefersReducedMotion } = useTheme();
  const breakpoint = useBreakpoint();

  // ========================================================================
  // RESPONSIVE BEHAVIOR
  // ========================================================================

  useEffect(() => {
    const isMobile = ['xs', 'sm'].includes(breakpoint);
    if (isMobile && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [breakpoint, sidebarCollapsed]);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const toggleSidebar = useCallback(() => {
    if (sidebarCollapsible) {
      setSidebarCollapsed(prev => !prev);
    }
  }, [sidebarCollapsible]);

  // ========================================================================
  // KEYBOARD NAVIGATION
  // ========================================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle sidebar με Ctrl/Cmd + B
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // ========================================================================
  // OVERLAY για MOBILE
  // ========================================================================

  const showMobileOverlay = ['xs', 'sm'].includes(breakpoint) && !sidebarCollapsed;

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div
      className={`responsive-dashboard ${className}`}
      style={canvasUI.positioning.responsive.dashboardLayout()}
      data-sidebar-collapsed={sidebarCollapsed}
      data-breakpoint={breakpoint}
    >
      {/* Mobile Overlay */}
      {showMobileOverlay && (
        <div
          style={canvasUI.positioning.responsive.dashboardMobileOverlay(showMobileOverlay, prefersReducedMotion)}
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      {sidebar && (
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          width={sidebarWidth}
          collapsedWidth={sidebarCollapsedWidth}
        >
          {sidebar}
        </Sidebar>
      )}

      {/* Header */}
      {header && (
        <Header
          height={headerHeight}
          sidebarWidth={sidebar ? sidebarWidth : 0}
          sidebarCollapsed={sidebar ? sidebarCollapsed : false}
        >
          {header}
        </Header>
      )}

      {/* Main Content */}
      <MainContent
        sidebarWidth={sidebar ? sidebarWidth : 0}
        sidebarCollapsed={sidebar ? sidebarCollapsed : false}
        headerHeight={header ? headerHeight : 0}
        footerHeight={footer ? footerHeight : 0}
        fluid={fluid}
        centered={centered}
      >
        {children}
      </MainContent>

      {/* Footer */}
      {footer && (
        <Footer
          height={footerHeight}
          sidebarWidth={sidebar ? sidebarWidth : 0}
          sidebarCollapsed={sidebar ? sidebarCollapsed : false}
        >
          {footer}
        </Footer>
      )}
    </div>
  );
};

// ============================================================================
// SPECIALIZED LAYOUT COMPONENTS
// ============================================================================

/**
 * Two-column layout with responsive behavior
 */
export const TwoColumnLayout: React.FC<{
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  leftWidth?: number;
  gap?: number;
  className?: string;
}> = ({
  leftColumn,
  rightColumn,
  leftWidth = 2,
  gap = 6,
  className = ''
}) => {
  const breakpoint = useBreakpoint();
  const isMobile = ['xs', 'sm'].includes(breakpoint);

  if (isMobile) {
    return (
      <div className={`two-column-layout-mobile ${className}`}>
        <div style={canvasUI.positioning.responsive.mobileLayoutSpacing(gap)}>
          {leftColumn}
        </div>
        <div>
          {rightColumn}
        </div>
      </div>
    );
  }

  return (
    <Grid columns={12} gap={gap} className={`two-column-layout ${className}`}>
      <GridItem span={leftWidth}>
        {leftColumn}
      </GridItem>
      <GridItem span={12 - leftWidth}>
        {rightColumn}
      </GridItem>
    </Grid>
  );
};

/**
 * Three-column layout με adaptive behavior
 */
export const ThreeColumnLayout: React.FC<{
  leftColumn: ReactNode;
  centerColumn: ReactNode;
  rightColumn: ReactNode;
  gap?: number;
  className?: string;
}> = ({
  leftColumn,
  centerColumn,
  rightColumn,
  gap = 6,
  className = ''
}) => {
  const breakpoint = useBreakpoint();

  // Responsive column spans
  const getColumnSpans = () => {
    switch (breakpoint) {
      case 'xs':
      case 'sm':
        return { left: 12, center: 12, right: 12 }; // Stack vertically
      case 'md':
        return { left: 12, center: 6, right: 6 }; // Center + Right side by side
      case 'lg':
      case 'xl':
      case '2xl':
      default:
        return { left: 3, center: 6, right: 3 }; // All three columns
    }
  };

  const spans = getColumnSpans();
  const isMobile = ['xs', 'sm'].includes(breakpoint);

  if (isMobile) {
    return (
      <div className={`three-column-layout-mobile ${className}`}>
        <div style={canvasUI.positioning.responsive.mobileLayoutSpacing(gap)}>
          {leftColumn}
        </div>
        <div style={canvasUI.positioning.responsive.mobileLayoutSpacing(gap)}>
          {centerColumn}
        </div>
        <div>
          {rightColumn}
        </div>
      </div>
    );
  }

  return (
    <Grid columns={12} gap={gap} className={`three-column-layout ${className}`}>
      <GridItem span={spans.left}>
        {leftColumn}
      </GridItem>
      <GridItem span={spans.center}>
        {centerColumn}
      </GridItem>
      <GridItem span={spans.right}>
        {rightColumn}
      </GridItem>
    </Grid>
  );
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

/**
 * Responsive container με max-width constraints
 */
export const Container: React.FC<{
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}> = ({
  children,
  size = 'xl',
  className = ''
}) => {
  return (
    <div
      className={`container container-${size} ${className}`}
      style={canvasUI.positioning.responsive.responsiveContainer(size)}
    >
      {children}
    </div>
  );
};

/**
 * Responsive spacer component
 */
export const Spacer: React.FC<{
  size?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; '2xl'?: number };
  direction?: 'horizontal' | 'vertical';
}> = ({
  size = 4,
  direction = 'vertical'
}) => {
  const breakpoint = useBreakpoint();
  const spacingValue = getResponsiveValue(size, breakpoint, 4);

  return <div
    className={`spacer spacer-${direction}`}
    style={canvasUI.positioning.responsive.responsiveSpacer(spacingValue, direction)}
  />;
};

export default ResponsiveDashboard;