/**
 * @file AutoCAD Color Index (ACI) Palette
 * @module settings/standards/aci
 *
 * ENTERPRISE STANDARD - CAD Industry Standard Colors
 *
 * **SOURCE:** AutoCAD 2024 Official ACI Palette
 * **STANDARD:** ISO 128 Technical Drawings
 *
 * @see https://knowledge.autodesk.com/support/autocad/learn-explore/caas/CloudHelp/cloudhelp/2024/ENU/AutoCAD-Core/files/GUID-27CE8A71-60EA-4B76-88BD-D69C450F8A6E-htm.html
 */

// ============================================================================
// ACI PALETTE (256 COLORS)
// ============================================================================

/**
 * Full ACI palette (indexes 1-255)
 *
 * **INDEX 0:** ByBlock (context-dependent)
 * **INDEX 7:** White (default)
 * **INDEX 256:** ByLayer (context-dependent)
 */
export const ACI_PALETTE = {
  // Core colors (1-9)
  1: '#FF0000',   // Red
  2: '#FFFF00',   // Yellow
  3: '#00FF00',   // Green
  4: '#00FFFF',   // Cyan
  5: '#0000FF',   // Blue
  6: '#FF00FF',   // Magenta
  7: '#FFFFFF',   // White (default)
  8: '#808080',   // Gray
  9: '#C0C0C0',   // Light Gray

  // Extended colors (10-249) - Standard ACI
  10: '#FF0000', 11: '#FF7F7F', 12: '#CC0000', 13: '#CC6666', 14: '#990000',
  15: '#993333', 16: '#7F0000', 17: '#7F3F3F', 18: '#4C0000', 19: '#4C2626',

  20: '#FF3F00', 21: '#FF9F7F', 22: '#CC3300', 23: '#CC7F66', 24: '#992600',
  25: '#994C33', 26: '#7F1F00', 27: '#7F4F3F', 28: '#4C1300', 29: '#4C2F26',

  30: '#FF7F00', 31: '#FFBF7F', 32: '#CC6600', 33: '#CC9966', 34: '#994C00',
  35: '#996633', 36: '#7F3F00', 37: '#7F5F3F', 38: '#4C2600', 39: '#4C3926',

  40: '#FFBF00', 41: '#FFDF7F', 42: '#CC9900', 43: '#CCB266', 44: '#997300',
  45: '#998033', 46: '#7F5F00', 47: '#7F6F3F', 48: '#4C3900', 49: '#4C4226',

  50: '#FFFF00', 51: '#FFFF7F', 52: '#CCCC00', 53: '#CCCC66', 54: '#999900',
  55: '#999933', 56: '#7F7F00', 57: '#7F7F3F', 58: '#4C4C00', 59: '#4C4C26',

  60: '#BFFF00', 61: '#DFFF7F', 62: '#99CC00', 63: '#B2CC66', 64: '#739900',
  65: '#809933', 66: '#5F7F00', 67: '#6F7F3F', 68: '#394C00', 69: '#424C26',

  70: '#7FFF00', 71: '#BFFF7F', 72: '#66CC00', 73: '#99CC66', 74: '#4C9900',
  75: '#669933', 76: '#3F7F00', 77: '#5F7F3F', 78: '#264C00', 79: '#394C26',

  80: '#3FFF00', 81: '#9FFF7F', 82: '#33CC00', 83: '#7FCC66', 84: '#269900',
  85: '#4C9933', 86: '#1F7F00', 87: '#4F7F3F', 88: '#134C00', 89: '#2F4C26',

  90: '#00FF00', 91: '#7FFF7F', 92: '#00CC00', 93: '#66CC66', 94: '#009900',
  95: '#339933', 96: '#007F00', 97: '#3F7F3F', 98: '#004C00', 99: '#264C26',

  100: '#00FF3F', 101: '#7FFF9F', 102: '#00CC33', 103: '#66CC7F', 104: '#009926',
  105: '#33994C', 106: '#007F1F', 107: '#3F7F4F', 108: '#004C13', 109: '#264C2F',

  110: '#00FF7F', 111: '#7FFFBF', 112: '#00CC66', 113: '#66CC99', 114: '#00994C',
  115: '#339966', 116: '#007F3F', 117: '#3F7F5F', 118: '#004C26', 119: '#264C39',

  120: '#00FFBF', 121: '#7FFFDF', 122: '#00CC99', 123: '#66CCB2', 124: '#009973',
  125: '#339980', 126: '#007F5F', 127: '#3F7F6F', 128: '#004C39', 129: '#264C42',

  130: '#00FFFF', 131: '#7FFFFF', 132: '#00CCCC', 133: '#66CCCC', 134: '#009999',
  135: '#339999', 136: '#007F7F', 137: '#3F7F7F', 138: '#004C4C', 139: '#264C4C',

  140: '#00BFFF', 141: '#7FDFFF', 142: '#0099CC', 143: '#66B2CC', 144: '#007399',
  145: '#338099', 146: '#005F7F', 147: '#3F6F7F', 148: '#00394C', 149: '#26424C',

  150: '#007FFF', 151: '#7FBFFF', 152: '#0066CC', 153: '#6699CC', 154: '#004C99',
  155: '#336699', 156: '#003F7F', 157: '#3F5F7F', 158: '#00264C', 159: '#26394C',

  160: '#003FFF', 161: '#7F9FFF', 162: '#0033CC', 163: '#667FCC', 164: '#002699',
  165: '#334C99', 166: '#001F7F', 167: '#3F4F7F', 168: '#00134C', 169: '#262F4C',

  170: '#0000FF', 171: '#7F7FFF', 172: '#0000CC', 173: '#6666CC', 174: '#000099',
  175: '#333399', 176: '#00007F', 177: '#3F3F7F', 178: '#00004C', 179: '#26264C',

  180: '#3F00FF', 181: '#9F7FFF', 182: '#3300CC', 183: '#7F66CC', 184: '#260099',
  185: '#4C3399', 186: '#1F007F', 187: '#4F3F7F', 188: '#13004C', 189: '#2F264C',

  190: '#7F00FF', 191: '#BF7FFF', 192: '#6600CC', 193: '#9966CC', 194: '#4C0099',
  195: '#663399', 196: '#3F007F', 197: '#5F3F7F', 198: '#26004C', 199: '#39264C',

  200: '#BF00FF', 201: '#DF7FFF', 202: '#9900CC', 203: '#B266CC', 204: '#730099',
  205: '#803399', 206: '#5F007F', 207: '#6F3F7F', 208: '#39004C', 209: '#42264C',

  210: '#FF00FF', 211: '#FF7FFF', 212: '#CC00CC', 213: '#CC66CC', 214: '#990099',
  215: '#993399', 216: '#7F007F', 217: '#7F3F7F', 218: '#4C004C', 219: '#4C264C',

  220: '#FF00BF', 221: '#FF7FDF', 222: '#CC0099', 223: '#CC66B2', 224: '#990073',
  225: '#993380', 226: '#7F005F', 227: '#7F3F6F', 228: '#4C0039', 229: '#4C2642',

  230: '#FF007F', 231: '#FF7FBF', 232: '#CC0066', 233: '#CC6699', 234: '#99004C',
  235: '#993366', 236: '#7F003F', 237: '#7F3F5F', 238: '#4C0026', 239: '#4C2639',

  240: '#FF003F', 241: '#FF7F9F', 242: '#CC0033', 243: '#CC667F', 244: '#990026',
  245: '#99334C', 246: '#7F001F', 247: '#7F3F4F', 248: '#4C0013', 249: '#4C262F',

  // Grayscale (250-255)
  250: '#333333',
  251: '#505050',
  252: '#696969',
  253: '#828282',
  254: '#BEBEBE',
  255: '#FFFFFF'
} as const;

// ============================================================================
// ACI COLOR NAMES
// ============================================================================

export const ACI_COLOR_NAMES: Record<number, string> = {
  1: 'Red',
  2: 'Yellow',
  3: 'Green',
  4: 'Cyan',
  5: 'Blue',
  6: 'Magenta',
  7: 'White',
  8: 'Gray',
  9: 'Light Gray'
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get ACI color by index
 *
 * @param index - ACI index (1-255)
 * @returns Hex color string or default white
 */
export function getAciColor(index: number): string {
  if (index < 1 || index > 255) {
    console.warn(`[ACI] Invalid index ${index}, using white`);
    return ACI_PALETTE[7];
  }

  return ACI_PALETTE[index as keyof typeof ACI_PALETTE] || ACI_PALETTE[7];
}

/**
 * Get ACI color name by index
 *
 * @param index - ACI index (1-255)
 * @returns Color name or 'Unknown'
 */
export function getAciColorName(index: number): string {
  return ACI_COLOR_NAMES[index] || `ACI ${index}`;
}

// 🏢 ADR-076: Centralized Color Conversion
import { parseHex } from '../../ui/color/utils';
import type { RGBColor } from '../../ui/color/types';

/**
 * Find closest ACI color to hex color
 *
 * @param hex - Hex color (#RRGGBB)
 * @returns Closest ACI index
 */
export function findClosestAci(hex: string): number {
  let rgb: RGBColor;
  try {
    rgb = parseHex(hex);
  } catch {
    return 7; // Default to white on parse error
  }

  let closestIndex = 7;
  let minDistance = Infinity;

  for (let i = 1; i <= 255; i++) {
    const aciColor = getAciColor(i);
    let aciRgb: RGBColor;
    try {
      aciRgb = parseHex(aciColor);
    } catch {
      continue;
    }

    const distance = colorDistance(rgb, aciRgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  return closestIndex;
}

function colorDistance(
  c1: RGBColor,
  c2: RGBColor
): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}
