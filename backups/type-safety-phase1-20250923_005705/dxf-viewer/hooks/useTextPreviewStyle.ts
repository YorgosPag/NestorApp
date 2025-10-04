/**
 * Hook για να διαβάζει τις ρυθμίσεις προσχεδίασης κειμένου
 * χωρίς να χρειάζεται React context στο PhaseManager
 */

import { textStyleStore } from '../stores/TextStyleStore';

export interface TextPreviewStyle {
  enabled: boolean;          // ΝΕΟ! Ενεργοποίηση/απενεργοποίηση κειμένου
  fontFamily: string;
  fontSize: string; // CSS format (e.g., "12px")
  color: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  opacity: number;
  isSuperscript: boolean;
  isSubscript: boolean;
}

// Global function που μπορεί να κληθεί από οπουδήποτε (ΓΕΝΙΚΕΣ ΡΥΘΜΙΣΕΙΣ)
export function getTextPreviewStyle(): TextPreviewStyle {
  const textStyle = textStyleStore.get();

  // Helper function για text decoration
  const getTextDecoration = (style: typeof textStyle): string => {
    const decorations: string[] = [];
    if (style.textDecoration.includes('underline')) decorations.push('underline');
    if (style.textDecoration.includes('line-through')) decorations.push('line-through');
    return decorations.join(' ') || 'none';
  };

  return {
    enabled: textStyle.enabled !== undefined ? textStyle.enabled : true, // Default: enabled
    fontFamily: textStyle.fontFamily || 'Arial, sans-serif',
    fontSize: `${textStyle.fontSize || 12}px`,
    color: textStyle.color || '#ffffff', // Λευκό default (συνεπές με DXF ρυθμίσεις)
    fontWeight: textStyle.fontWeight || 'normal',
    fontStyle: textStyle.fontStyle || 'normal',
    textDecoration: getTextDecoration(textStyle),
    opacity: textStyle.opacity || 1,
    isSuperscript: textStyle.isSuperscript || false,
    isSubscript: textStyle.isSubscript || false,
  };
}

// Global state store για draft text settings (εκτός React context)
let draftTextSettingsStore: {
  overrideGlobalSettings: boolean;
  settings: any;
} | null = null;

// Συνάρτηση για να ενημερώσει το store από το React context
export function updateDraftTextSettingsStore(settings: { overrideGlobalSettings: boolean; settings: any }) {
  draftTextSettingsStore = settings;
  console.log('📝 [updateDraftTextSettingsStore] Updated store:', settings);
}

// ✅ ΝΕΑ ΣΥΝΑΡΤΗΣΗ: Ελέγχει το checkbox και επιστρέφει τις σωστές ρυθμίσεις κειμένου
export function getTextPreviewStyleWithOverride(): TextPreviewStyle {
  // Αν έχω ειδικές ρυθμίσεις και το checkbox είναι checked
  if (draftTextSettingsStore?.overrideGlobalSettings && draftTextSettingsStore.settings) {
    const specificSettings = draftTextSettingsStore.settings;

    console.log('✅ [getTextPreviewStyleWithOverride] Using SPECIFIC text settings from store:', specificSettings);

    // Helper function για text decoration από specific settings
    const getSpecificTextDecoration = (settings: any): string => {
      const decorations: string[] = [];
      if (settings.isUnderline) decorations.push('underline');
      if (settings.isStrikethrough) decorations.push('line-through');
      return decorations.join(' ') || 'none';
    };

    return {
      enabled: specificSettings.enabled !== undefined ? specificSettings.enabled : true,
      fontFamily: specificSettings.fontFamily || 'Arial, sans-serif',
      fontSize: `${specificSettings.fontSize || 12}px`,
      color: specificSettings.color || '#FF0000', // ✅ AutoCAD standard: Red for preview text
      fontWeight: specificSettings.isBold ? 'bold' : 'normal',
      fontStyle: specificSettings.isItalic ? 'italic' : 'normal',
      textDecoration: getSpecificTextDecoration(specificSettings),
      opacity: specificSettings.opacity || 1,
      isSuperscript: specificSettings.isSuperscript || false,
      isSubscript: specificSettings.isSubscript || false,
    };
  }

  // Fallback στις γενικές ρυθμίσεις
  console.log('🔄 [getTextPreviewStyleWithOverride] Using GENERAL text settings (checkbox unchecked or no store)');
  return getTextPreviewStyle();
}

// Function για να εφαρμόσει το στυλ σε canvas context
export function applyTextPreviewStyle(ctx: CanvasRenderingContext2D): void {
  const style = getTextPreviewStyleWithOverride();

  // Construct font string for canvas
  const fontString = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

  ctx.font = fontString;
  ctx.fillStyle = style.color;
  ctx.globalAlpha = style.opacity;

  // Note: textDecoration (underline, line-through) needs special handling in canvas
  // This would require custom drawing logic for underlines/strikethrough
}

// Advanced function για text rendering με decorations και super/subscripts
// ✅ ΝΕΑ ΣΥΝΑΡΤΗΣΗ: Render με έλεγχο override
export function renderStyledTextWithOverride(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number
): void {
  const style = getTextPreviewStyleWithOverride();

  // ΝΕΟ! Έλεγχος αν το κείμενο είναι ενεργοποιημένο
  if (!style.enabled) {
    return; // Αν το κείμενο είναι απενεργοποιημένο, δεν κάνουμε render
  }

  const fontSize = parseInt(style.fontSize);

  // Handle superscript and subscript with adjusted font size and position
  let adjustedY = y;
  let adjustedFontSize = fontSize;

  if (style.isSuperscript || style.isSubscript) {
    adjustedFontSize = Math.round(fontSize * 0.75); // 75% του κανονικού μεγέθους
    if (style.isSuperscript) {
      adjustedY = y - fontSize * 0.3; // Πάνω από τη γραμμή βάσης
    } else if (style.isSubscript) {
      adjustedY = y + fontSize * 0.2; // Κάτω από τη γραμμή βάσης
    }
  }

  // Apply styling με τις προσαρμογές
  const fontString = `${style.fontStyle} ${style.fontWeight} ${adjustedFontSize}px ${style.fontFamily}`;
  ctx.font = fontString;
  ctx.fillStyle = style.color;
  ctx.globalAlpha = style.opacity;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Render the text
  ctx.fillText(text, x, adjustedY);

  // Render underline and strikethrough decorations
  if (style.textDecoration && style.textDecoration !== 'none') {
    const textWidth = ctx.measureText(text).width;
    const decorations = style.textDecoration.split(' ');

    ctx.strokeStyle = style.color;
    ctx.lineWidth = Math.max(1, adjustedFontSize * 0.05); // 5% του font size

    if (decorations.includes('underline')) {
      const underlineY = adjustedY + adjustedFontSize * 0.15;
      ctx.beginPath();
      ctx.moveTo(x - textWidth / 2, underlineY);
      ctx.lineTo(x + textWidth / 2, underlineY);
      ctx.stroke();
    }

    if (decorations.includes('line-through')) {
      const strikethroughY = adjustedY - adjustedFontSize * 0.05;
      ctx.beginPath();
      ctx.moveTo(x - textWidth / 2, strikethroughY);
      ctx.lineTo(x + textWidth / 2, strikethroughY);
      ctx.stroke();
    }
  }
}

// Παλιά συνάρτηση για backwards compatibility
export function renderStyledText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number
): void {
  const style = getTextPreviewStyleWithOverride();

  // ΝΕΟ! Έλεγχος αν το κείμενο είναι ενεργοποιημένο
  if (!style.enabled) {
    return; // Αν το κείμενο είναι απενεργοποιημένο, δεν κάνουμε render
  }

  const fontSize = parseInt(style.fontSize);

  // Handle superscript and subscript with adjusted font size and position
  let adjustedY = y;
  let adjustedFontSize = fontSize;

  if (style.isSuperscript || style.isSubscript) {
    adjustedFontSize = Math.round(fontSize * 0.75); // 75% του κανονικού μεγέθους
    if (style.isSuperscript) {
      adjustedY = y - fontSize * 0.3; // Πάνω από τη γραμμή βάσης
    } else if (style.isSubscript) {
      adjustedY = y + fontSize * 0.2; // Κάτω από τη γραμμή βάσης
    }
  }

  // Apply styling με τις προσαρμογές
  const fontString = `${style.fontStyle} ${style.fontWeight} ${adjustedFontSize}px ${style.fontFamily}`;
  ctx.font = fontString;
  ctx.fillStyle = style.color;
  ctx.globalAlpha = style.opacity;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Render the text
  ctx.fillText(text, x, adjustedY);

  // Get text metrics for decorations (χρησιμοποιώ το κανονικό font size για decorations)
  const originalFont = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  ctx.font = originalFont; // Προσωρινά επαναφέρω για μετρήσεις
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;

  // Για super/subscript, μειώνουμε το textWidth ανάλογα
  const effectiveTextWidth = (style.isSuperscript || style.isSubscript) ? textWidth * 0.75 : textWidth;

  // Calculate decoration positions
  const startX = x - effectiveTextWidth / 2; // Since textAlign is center
  const endX = x + effectiveTextWidth / 2;

  // Apply text decorations (πάντα στη βασική θέση, όχι adjusted)
  if (style.textDecoration.includes('underline')) {
    const underlineY = y + fontSize * 0.1; // Slightly below baseline
    ctx.beginPath();
    ctx.moveTo(startX, underlineY);
    ctx.lineTo(endX, underlineY);
    ctx.lineWidth = Math.max(1, fontSize * 0.05); // Proportional line thickness
    ctx.strokeStyle = style.color;
    ctx.stroke();
  }

  if (style.textDecoration.includes('line-through')) {
    const strikethroughY = y - fontSize * 0.2; // Middle of text
    ctx.beginPath();
    ctx.moveTo(startX, strikethroughY);
    ctx.lineTo(endX, strikethroughY);
    ctx.lineWidth = Math.max(1, fontSize * 0.05); // Proportional line thickness
    ctx.strokeStyle = style.color;
    ctx.stroke();
  }
}

// Function για να δημιουργήσει CSS style object
export function getTextPreviewCSSStyle(): React.CSSProperties {
  const style = getTextPreviewStyleWithOverride();

  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    color: style.color,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textDecoration: style.textDecoration,
    opacity: style.opacity,
  };
}