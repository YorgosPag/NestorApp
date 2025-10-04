import React from 'react';

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

function BaseSvgWrapper({ className = "", size = 24, children }: {
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
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function createIcon(config: BaseIconConfig) {
  return ({ className = "", size = 24 }: BaseIconProps & { variant?: string }) => {
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
  return ({ className = "", size = 24, variant }: BaseIconProps & { variant: string }) => {
    const selectedVariant = config.variants.find(v => v.name === variant) || config.variants[0];
    
    return (
      <BaseSvgWrapper className={className} size={size}>
        {selectedVariant.element}
      </BaseSvgWrapper>
    );
  };
}