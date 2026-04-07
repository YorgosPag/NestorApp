/**
 * RESPONSIVE DASHBOARD - SPECIALIZED LAYOUT COMPONENTS
 * Extracted from ResponsiveDashboard.tsx (ADR-065 file split)
 *
 * Contains: TwoColumnLayout, ThreeColumnLayout, Container, Spacer
 */

import React, { ReactNode } from 'react';
import { useBreakpoint } from '../theme/ThemeProvider';
import { canvasUI } from '../../../../../styles/design-tokens/canvas';
import { Grid, GridItem } from './ResponsiveDashboard';
import { getResponsiveValue } from './ResponsiveDashboard';

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
 * Three-column layout with adaptive behavior
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
 * Responsive container with max-width constraints
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
