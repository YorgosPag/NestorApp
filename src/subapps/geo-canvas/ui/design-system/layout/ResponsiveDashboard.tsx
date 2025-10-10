/**
 * RESPONSIVE DASHBOARD LAYOUT
 * Geo-Alert System - Phase 6: Enterprise Responsive Layout System
 *
 * Advanced responsive dashboard με adaptive layout, collapsible sidebar,
 * και intelligent component placement. Implements modern layout patterns.
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { useTheme, useBreakpoint } from '../theme/ThemeProvider';

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

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: `var(--spacing-${gapValue})`,
    width: '100%'
  };

  return (
    <div
      className={`responsive-grid ${className}`}
      style={gridStyle}
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

  const itemStyle: React.CSSProperties = {
    gridColumn: offsetValue > 0
      ? `${offsetValue + 1} / span ${spanValue}`
      : `span ${spanValue}`,
    order: orderValue
  };

  return (
    <div
      className={`grid-item ${className}`}
      style={itemStyle}
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

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, ${maxCardWidth}px))`,
    gap: `var(--spacing-${gap})`,
    justifyContent: 'center',
    width: '100%'
  };

  return (
    <div
      className={`card-grid ${className}`}
      style={cardGridStyle}
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

  const sidebarStyle: React.CSSProperties = {
    width: isCollapsed ? `${collapsedWidth}px` : `${width}px`,
    height: '100vh',
    backgroundColor: 'var(--color-bg-secondary)',
    borderRight: '1px solid var(--color-border-primary)',
    transition: 'width var(--duration-base) var(--easing-ease-in-out)',
    position: 'fixed',
    left: 0,
    top: 0,
    zIndex: 1000,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  };

  const toggleButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    right: isCollapsed ? '8px' : '16px',
    padding: '8px',
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border-primary)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'all var(--duration-fast) var(--easing-ease-in-out)',
    zIndex: 1001,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px'
  };

  return (
    <aside
      className={`dashboard-sidebar ${className}`}
      style={sidebarStyle}
    >
      <button
        onClick={onToggle}
        style={toggleButtonStyle}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '→' : '←'}
      </button>

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: isCollapsed ? '48px 8px 16px' : '48px 16px 16px'
      }}>
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

  const headerStyle: React.CSSProperties = {
    height: `${height}px`,
    backgroundColor: 'var(--color-bg-primary)',
    borderBottom: '1px solid var(--color-border-primary)',
    position: 'fixed',
    top: 0,
    left: sidebarCollapsed ? '64px' : `${sidebarWidth}px`,
    right: 0,
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--spacing-6)',
    transition: 'left var(--duration-base) var(--easing-ease-in-out)'
  };

  return (
    <header
      className={`dashboard-header ${className}`}
      style={headerStyle}
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

  const footerStyle: React.CSSProperties = {
    height: `${height}px`,
    backgroundColor: 'var(--color-bg-secondary)',
    borderTop: '1px solid var(--color-border-primary)',
    position: 'fixed',
    bottom: 0,
    left: sidebarCollapsed ? '64px' : `${sidebarWidth}px`,
    right: 0,
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--spacing-6)',
    transition: 'left var(--duration-base) var(--easing-ease-in-out)'
  };

  return (
    <footer
      className={`dashboard-footer ${className}`}
      style={footerStyle}
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

  const mainStyle: React.CSSProperties = {
    marginLeft: sidebarCollapsed ? '64px' : `${sidebarWidth}px`,
    marginTop: `${headerHeight}px`,
    marginBottom: footerHeight > 0 ? `${footerHeight}px` : 0,
    minHeight: `calc(100vh - ${headerHeight}px - ${footerHeight}px)`,
    backgroundColor: 'var(--color-bg-tertiary)',
    transition: 'margin-left var(--duration-base) var(--easing-ease-in-out)',
    overflow: 'auto'
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: fluid ? '100%' : 'var(--container-max-width, 1280px)',
    margin: centered ? '0 auto' : '0',
    padding: 'var(--spacing-6)',
    width: '100%'
  };

  return (
    <main
      className={`dashboard-main ${className}`}
      style={mainStyle}
    >
      <div style={containerStyle}>
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
  // LAYOUT STYLES
  // ========================================================================

  const layoutStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: 'var(--color-bg-tertiary)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-text-primary)',
    position: 'relative',
    overflow: 'hidden'
  };

  // ========================================================================
  // OVERLAY για MOBILE
  // ========================================================================

  const showMobileOverlay = ['xs', 'sm'].includes(breakpoint) && !sidebarCollapsed;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--color-bg-overlay)',
    zIndex: 999,
    opacity: showMobileOverlay ? 1 : 0,
    visibility: showMobileOverlay ? 'visible' : 'hidden',
    transition: prefersReducedMotion
      ? 'none'
      : 'opacity var(--duration-base) var(--easing-ease-in-out), visibility var(--duration-base) var(--easing-ease-in-out)'
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div
      className={`responsive-dashboard ${className}`}
      style={layoutStyle}
      data-sidebar-collapsed={sidebarCollapsed}
      data-breakpoint={breakpoint}
    >
      {/* Mobile Overlay */}
      {showMobileOverlay && (
        <div
          style={overlayStyle}
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
        <div style={{ marginBottom: `var(--spacing-${gap})` }}>
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
        <div style={{ marginBottom: `var(--spacing-${gap})` }}>
          {leftColumn}
        </div>
        <div style={{ marginBottom: `var(--spacing-${gap})` }}>
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
  const maxWidths = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    full: '100%'
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: maxWidths[size],
    margin: '0 auto',
    padding: '0 var(--spacing-4)',
    width: '100%'
  };

  return (
    <div
      className={`container container-${size} ${className}`}
      style={containerStyle}
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

  const spacerStyle: React.CSSProperties = {
    [direction === 'horizontal' ? 'width' : 'height']: `var(--spacing-${spacingValue})`,
    [direction === 'horizontal' ? 'height' : 'width']: direction === 'horizontal' ? '1px' : '100%',
    flexShrink: 0
  };

  return <div className={`spacer spacer-${direction}`} style={spacerStyle} />;
};

export default ResponsiveDashboard;