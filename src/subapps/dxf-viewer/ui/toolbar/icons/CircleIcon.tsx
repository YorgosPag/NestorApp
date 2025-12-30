import * as React from 'react';

export type CircleVariant = 
  | 'radius'
  | 'diameter' 
  | '3point'
  | '2point-radius'
  | '2point-diameter'
  | 'best-fit'
  | 'chord-sagitta';

interface CircleIconProps {
  variant: CircleVariant;
  className?: string;
}

export const CircleIcon: React.FC<CircleIconProps> = ({ 
  variant, 
  className = "w-5 h-5" 
}) => {
  const renderCenterDot = () => (
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  );

  const renderVariantContent = () => {
    switch (variant) {
      case 'radius':
        return (
          <>
            {/* Radius line from center to edge */}
            <line x1="12" y1="12" x2="20" y2="12" />
            {renderCenterDot()}
          </>
        );

      case 'diameter':
        return (
          <>
            {/* Diameter line from edge to edge through center */}
            <line x1="4" y1="12" x2="20" y2="12" />
            {renderCenterDot()}
          </>
        );

      case '3point':
        return (
          <>
            {/* Three points on the circumference */}
            <circle cx="12" cy="4" r="1.5" fill="currentColor" />
            <circle cx="19.46" cy="16" r="1.5" fill="currentColor" />
            <circle cx="4.54" cy="16" r="1.5" fill="currentColor" />
            {/* Small "3P" label */}
            <text x="12" y="12" fontSize="4" textAnchor="middle" fill="currentColor">3P</text>
          </>
        );

      case '2point-radius':
        return (
          <>
            {/* Two points for 2-point radius */}
            <circle cx="8" cy="12" r="1.5" fill="currentColor" />
            <circle cx="16" cy="12" r="1.5" fill="currentColor" />
            {/* Radius line */}
            <line x1="12" y1="12" x2="20" y2="12" />
            {renderCenterDot()}
          </>
        );

      case '2point-diameter':
        return (
          <>
            {/* Two points for 2-point diameter */}
            <circle cx="6" cy="12" r="1.5" fill="currentColor" />
            <circle cx="18" cy="12" r="1.5" fill="currentColor" />
            {/* Diameter line */}
            <line x1="4" y1="12" x2="20" y2="12" />
          </>
        );

      case 'best-fit':
        return (
          <>
            {/* Multiple points scattered around */}
            <circle cx="12" cy="4" r="1" fill="currentColor" />
            <circle cx="19" cy="8" r="1" fill="currentColor" />
            <circle cx="20" cy="16" r="1" fill="currentColor" />
            <circle cx="12" cy="20" r="1" fill="currentColor" />
            <circle cx="4" cy="16" r="1" fill="currentColor" />
            <circle cx="5" cy="8" r="1" fill="currentColor" />
            {renderCenterDot()}
          </>
        );

      case 'chord-sagitta':
        return (
          <>
            {/* Chord line */}
            <line x1="7" y1="16" x2="17" y2="16" />
            {/* Sagitta (perpendicular from chord to arc) */}
            <line x1="12" y1="16" x2="12" y2="8" />
            {/* Arrow on sagitta */}
            <path d="M 11 9 L 12 8 L 13 9" fill="none" stroke="currentColor" strokeWidth="1" />
            {renderCenterDot()}
          </>
        );

      default:
        return renderCenterDot();
    }
  };

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Main circle - common to all variants */}
      <circle cx="12" cy="12" r="8" />
      {/* Variant-specific content */}
      {renderVariantContent()}
    </svg>
  );
};

// Convenience exports for backward compatibility
export const CircleRadiusIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="radius" {...props} />;

export const CircleDiameterIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="diameter" {...props} />;

export const Circle3PIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="3point" {...props} />;

export const Circle2PRadiusIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="2point-radius" {...props} />;

export const Circle2PDiameterIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="2point-diameter" {...props} />;

export const CircleBestFitIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="best-fit" {...props} />;

export const CircleChordSagittaIcon: React.FC<{className?: string}> = (props) => 
  <CircleIcon variant="chord-sagitta" {...props} />;