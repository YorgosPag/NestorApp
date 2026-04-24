// Layout constants for PDF generation

export const COLORS = {
  RED: [139, 0, 0] as [number, number, number],
  BLACK: [0, 0, 0] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
  GRAY: [200, 200, 200] as [number, number, number],
};

export const FONTS = {
  HELVETICA: 'helvetica',
  // ADR-267 SSoT — embedded Roboto TTF with Identity-H encoding. Caller must
  // have invoked `registerGreekFont(doc)` before using this value; otherwise
  // jsPDF falls back to Helvetica with garbled Greek glyphs.
  UNICODE: 'Roboto',
};

export const FONT_STYLES = {
  NORMAL: 'normal' as const,
  BOLD: 'bold' as const,
};

export const LINE_WIDTHS = {
  HEADER: 0.5,
  FOOTER: 0.3,
};

export const FONT_SIZES = {
  H1: 18,
  H2: 14,
  H3: 12,
  BODY: 10,
  SMALL: 9,
};

export const LINE_SPACING = {
  BODY: 5,
  H1: 15,
  H2: 10,
  H3: 8,
};
