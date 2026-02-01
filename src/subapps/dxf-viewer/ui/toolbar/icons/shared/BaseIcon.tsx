import React from 'react';
// 🏢 ENTERPRISE: Centralized icon sizes - Zero hardcoded values (ADR-002)
import { componentSizes } from '../../../../../../styles/design-tokens';
// 🏢 ADR-133: Centralized SVG stroke width tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

// 🏢 ENTERPRISE: Default icon size from centralized design tokens
const DEFAULT_ICON_SIZE_LG = componentSizes.icon.numeric.lg; // 24px

export interface BaseIconProps {
  className?: string;
  size?: number;
}

export interface IconVariant {
  name: string;
  element: React.ReactElement;
}

export interface BaseIconConfig {
  defaultVariant: string;
  variants: IconVariant[];
}

function BaseSvgWrapper({ className = "", size = DEFAULT_ICON_SIZE_LG, children }: {
  className?: string;
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={PANEL_LAYOUT.SVG_ICON.STROKE_WIDTH.STANDARD}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function createIcon(config: BaseIconConfig) {
  return ({ className = "", size = DEFAULT_ICON_SIZE_LG }: BaseIconProps & { variant?: string }) => {
    // For backward compatibility, default to the first variant if no variant specified
    const variant = config.defaultVariant;
    const selectedVariant = config.variants.find(v => v.name === variant) || config.variants[0];
    
    return (
      <BaseSvgWrapper className={className} size={size}>
        {selectedVariant.element}
      </BaseSvgWrapper>
    );
  };
}

export function createVariantIcon(config: BaseIconConfig) {
  return ({ className = "", size = DEFAULT_ICON_SIZE_LG, variant }: BaseIconProps & { variant: string }) => {
    const selectedVariant = config.variants.find(v => v.name === variant) || config.variants[0];
    
    return (
      <BaseSvgWrapper className={className} size={size}>
        {selectedVariant.element}
      </BaseSvgWrapper>
    );
  };
}