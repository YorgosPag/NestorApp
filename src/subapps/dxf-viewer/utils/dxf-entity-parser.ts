import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';

// Helper για parsing vertices από DXF data
function parseVerticesFromData(data: Record<string, string>): Point2D[] {
  const vertices: Point2D[] = [];
  let currentVertex: { x?: number; y?: number } = {};
  
  Object.keys(data).forEach(code => {
    if (code === '10') {
      // Add previous vertex if complete
      if (currentVertex.x !== undefined && currentVertex.y !== undefined) {
        vertices.push({ x: currentVertex.x, y: currentVertex.y });
      }
      // Start new vertex
      currentVertex = { x: parseFloat(data[code]) };
    } else if (code === '20' && currentVertex.x !== undefined) {
      currentVertex.y = parseFloat(data[code]);
    }
  });
  
  // Add final vertex
  if (currentVertex.x !== undefined && currentVertex.y !== undefined) {
    vertices.push({ x: currentVertex.x, y: currentVertex.y });
  }
  
  return vertices;
}

export interface EntityData {
  type: string;
  layer: string;
  data: Record<string, string>;
}

export class DxfEntityParser {
  // Parse single entity until next "0"
  static parseEntity(lines: string[], startIndex: number): EntityData | null {
    const entityType = lines[startIndex + 1].trim();
    const data: Record<string, string> = {};
    let layer = '0';
    
    let i = startIndex + 2;
    while (i < lines.length - 1) {
      const code = lines[i].trim();
      const value = lines[i + 1].trim();
      
      // Stop at next entity
      if (code === '0') break;
      
      // Store all codes
      if (code === '8') {
        layer = value || '0';
      }
      data[code] = value;
      
      i += 2;
    }
    
    return { type: entityType, layer, data };
  }

  // Parse entities using state machine
  static parseEntities(lines: string[]): EntityData[] {
    const entities: EntityData[] = [];
    let i = 0;
    
    while (i < lines.length - 1) {
      const code = lines[i].trim();
      const value = lines[i + 1].trim();
      
      // Start of entity
      if (code === '0' && ['LINE', 'LWPOLYLINE', 'CIRCLE', 'ARC', 'TEXT', 'INSERT', 'SPLINE', 'ELLIPSE', 'MTEXT', 'MULTILINETEXT', 'DIMENSION', 'HATCH', 'SOLID'].includes(value)) {

        const entity = DxfEntityParser.parseEntity(lines, i);
        if (entity) {
          entities.push(entity);
        }
        // Skip to end of this entity
        i = DxfEntityParser.findNextEntity(lines, i + 2);
      } else if (code === '0') {
        // Log unknown entity types
        if (value.includes('DIMENSION') || value === 'DIMENSION') {

        } else if (!['SECTION', 'ENDSEC', 'EOF', 'TABLE', 'ENDTAB', 'HEADER', 'ENDHDR', 'CLASSES', 'OBJECTS', 'BLOCKS', 'ENDBLK', 'BLOCK'].includes(value)) {

        }
        i += 2;
      } else {
        i += 2;
      }
    }
    
    return entities;
  }

  // Find index of next entity (next "0" code)
  static findNextEntity(lines: string[], startIndex: number): number {
    for (let i = startIndex; i < lines.length - 1; i += 2) {
      if (lines[i].trim() === '0') {
        return i;
      }
    }
    return lines.length;
  }

  // Convert parsed entity to scene entity
  static convertToSceneEntity(entityData: EntityData, index: number): AnySceneEntity | null {
    const { type, layer, data } = entityData;
    
    switch (type) {
      case 'LINE':
        return DxfEntityParser.convertLine(data, layer, index);
      case 'LWPOLYLINE':
        return DxfEntityParser.convertLwPolyline(data, layer, index);
      case 'CIRCLE':
        return DxfEntityParser.convertCircle(data, layer, index);
      case 'ARC':
        return DxfEntityParser.convertArc(data, layer, index);
      case 'TEXT':
        return DxfEntityParser.convertText(data, layer, index);
      case 'MTEXT':
      case 'MULTILINETEXT':
        return DxfEntityParser.convertMText(data, layer, index);
      case 'SPLINE':
        return DxfEntityParser.convertSpline(data, layer, index);
      case 'ELLIPSE':
        return DxfEntityParser.convertEllipse(data, layer, index);
      case 'DIMENSION':
        return DxfEntityParser.convertDimension(data, layer, index);
      default:
        return null;
    }
  }

  // Convert LINE entity - NO DEFAULTS!
  private static convertLine(data: Record<string, string>, layer: string, index: number): AnySceneEntity | null {
    const x1 = parseFloat(data['10']);
    const y1 = parseFloat(data['20']);
    const x2 = parseFloat(data['11']);
    const y2 = parseFloat(data['21']);
    
    // Skip if missing coordinates
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
      console.warn(`⚠️ Skipping LINE ${index}: missing coordinates`, { x1, y1, x2, y2, available: Object.keys(data) });
      return null;
    }
    
    return {
      id: `line_${index}`,
      type: 'line',
      layer,
      visible: true,
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 }
    };
  }

  // Convert LWPOLYLINE entity
  private static convertLwPolyline(data: Record<string, string>, layer: string, index: number): AnySceneEntity | null {
    const vertices: Point2D[] = [];
    const isClosed = data['70'] === '1';
    
    // Extract vertices using shared helper function
    const parsedVertices = parseVerticesFromData(data);
    vertices.push(...parsedVertices);
    
    if (vertices.length < 2) {
      console.warn(`⚠️ Skipping LWPOLYLINE ${index}: insufficient vertices`, vertices.length);
      return null;
    }
    
    return {
      id: `polyline_${index}`,
      type: 'polyline',
      layer,
      visible: true,
      vertices,
      closed: isClosed
    };
  }

  // Convert CIRCLE entity
  private static convertCircle(data: Record<string, string>, layer: string, index: number): AnySceneEntity | null {
    const centerX = parseFloat(data['10']);
    const centerY = parseFloat(data['20']);
    const radius = parseFloat(data['40']);
    
    if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
      console.warn(`⚠️ Skipping CIRCLE ${index}: invalid parameters`, { centerX, centerY, radius });
      return null;
    }
    
    return {
      id: `circle_${index}`,
      type: 'circle',
      layer,
      visible: true,
      center: { x: centerX, y: centerY },
      radius
    };
  }

  // Convert ARC entity
  private static convertArc(data: Record<string, string>, layer: string, index: number): AnySceneEntity | null {
    const centerX = parseFloat(data['10']);
    const centerY = parseFloat(data['20']);
    const radius = parseFloat(data['40']);
    const startAngle = parseFloat(data['50']) || 0;
    const endAngle = parseFloat(data['51']) || 360;
    
    if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
      console.warn(`⚠️ Skipping ARC ${index}: invalid parameters`, { centerX, centerY, radius });
      return null;
    }
    
    return {
      id: `arc_${index}`,
      type: 'arc',
      layer,
      visible: true,
      center: { x: centerX, y: centerY },
      radius,
      startAngle,
      endAngle
    };
  }

  // Decode Greek text from DXF encoding
  private static decodeGreekText(text: string): string {
    if (!text) return text;
    
    // Try to detect and fix common Greek encoding issues
    let decoded = text;
    
    // Check for UTF-8 sequences that got mangled
    try {
      // If we have sequences like \u03B1 (α), decode them
      decoded = decoded.replace(/\\u([0-9A-Fa-f]{4})/g, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
      });
      
      // Handle common Windows-1253 to UTF-8 conversion issues
      const greekMappings: { [key: string]: string } = {
        'Ά': 'Ά', 'Έ': 'Έ', 'Ή': 'Ή', 'Ί': 'Ί', 'Ό': 'Ό', 'Ύ': 'Ύ', 'Ώ': 'Ώ',
        'ά': 'ά', 'έ': 'έ', 'ή': 'ή', 'ί': 'ί', 'ό': 'ό', 'ύ': 'ύ', 'ώ': 'ώ',
        'Α': 'Α', 'Β': 'Β', 'Γ': 'Γ', 'Δ': 'Δ', 'Ε': 'Ε', 'Ζ': 'Ζ', 'Η': 'Η',
        'Θ': 'Θ', 'Ι': 'Ι', 'Κ': 'Κ', 'Λ': 'Λ', 'Μ': 'Μ', 'Ν': 'Ν', 'Ξ': 'Ξ',
        'Ο': 'Ο', 'Π': 'Π', 'Ρ': 'Ρ', 'Σ': 'Σ', 'Τ': 'Τ', 'Υ': 'Υ', 'Φ': 'Φ',
        'Χ': 'Χ', 'Ψ': 'Ψ', 'Ω': 'Ω',
        'α': 'α', 'β': 'β', 'γ': 'γ', 'δ': 'δ', 'ε': 'ε', 'ζ': 'ζ', 'η': 'η',
        'θ': 'θ', 'ι': 'ι', 'κ': 'κ', 'λ': 'λ', 'μ': 'μ', 'ν': 'ν', 'ξ': 'ξ',
        'ο': 'ο', 'π': 'π', 'ρ': 'ρ', 'σ': 'σ', 'τ': 'τ', 'υ': 'υ', 'φ': 'φ',
        'χ': 'χ', 'ψ': 'ψ', 'ω': 'ω', 'ς': 'ς'
      };
      
      // Apply Greek mappings if needed
      for (const [encoded, greek] of Object.entries(greekMappings)) {
        decoded = decoded.replace(new RegExp(encoded, 'g'), greek);
      }
      
    } catch (error) {
      console.warn('Greek text decoding error:', error);
    }
    
    return decoded;
  }

  // Convert TEXT entity
  private static convertText(data: Record<string, string>, layer: string, index: number): AnySceneEntity | null {
    const x = parseFloat(data['10']);
    const y = parseFloat(data['20']);
    let text = data['1'] || '';
    const height = parseFloat(data['40']) || 1;
    const rotation = parseFloat(data['50']) || 0;
    
    // Show raw character codes for debugging Greek text
    const rawBytes = text ? Array.from(text).map(c => c.charCodeAt(0)).join(',') : 'empty';

    if (isNaN(x) || isNaN(y) || text.trim() === '') {
      console.warn(`⚠️ Skipping TEXT ${index}: missing position or text`, { x, y, text });
      return null;
    }
    
    // Decode Greek text
    const originalText = text;
    text = DxfEntityParser.decodeGreekText(text);
    
    if (originalText !== text) {

    }
    
    return {
      id: `text_${index}`,
      type: 'text',
      layer,
      visible: true,
      position: { x, y },
      text: text.trim(),
      fontSize: height, // ✅ ENTERPRISE FIX: Use fontSize instead of height (centralized TextEntity compatibility)
      rotation
    };
  }

  // Convert MTEXT/MULTILINETEXT entity
  private static convertMText(data: Record<string, string>, layer: string, index: number): AnySceneEntity | null {
    const x = parseFloat(data['10']);
    const y = parseFloat(data['20']);
    let text = data['1'] || data['3'] || ''; // MTEXT can use code 1 or 3
    const height = parseFloat(data['40']) || 1;
    const rotation = parseFloat(data['50']) || 0;
    
    if (isNaN(x) || isNaN(y) || text.trim() === '') {
      console.warn(`⚠️ Skipping MTEXT ${index}: missing position or text`, { x, y, text });
      return null;
    }
    
    // Decode Greek text
    text = DxfEntityParser.decodeGreekText(text);
    
    return {
      id: `mtext_${index}`,
      type: 'text',
      layer,
      visible: true,
      position: { x, y },
      text: text.trim(),
      fontSize: height, // ✅ ENTERPRISE FIX: Use fontSize instead of height (centralized TextEntity compatibility)
      rotation
    };
  }

  // Convert SPLINE entity to polyline approximation
  private static convertSpline(data: Record<string, string>, layer: string, index: number): AnySceneEntity | null {
    const vertices: Point2D[] = [];
    const codes = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));
    
    // Extract control points using shared helper function
    const parsedVertices = parseVerticesFromData(data);
    vertices.push(...parsedVertices);
    
    if (vertices.length < 2) {
      console.warn(`⚠️ Skipping SPLINE ${index}: insufficient control points`, vertices.length);
      return null;
    }
    
    return {
      id: `spline_${index}`,
      type: 'polyline',
      layer,
      visible: true,
      vertices,
      closed: false
    };
  }

  // Convert ELLIPSE entity to circle approximation
  private static convertEllipse(data: Record<string, string>, layer: string, index: number): AnySceneEntity | null {
    const centerX = parseFloat(data['10']);
    const centerY = parseFloat(data['20']);
    const majorAxisX = parseFloat(data['11']) || 0;
    const majorAxisY = parseFloat(data['21']) || 0;
    const ratio = parseFloat(data['40']) || 1; // Minor to major axis ratio
    
    if (isNaN(centerX) || isNaN(centerY)) {
      console.warn(`⚠️ Skipping ELLIPSE ${index}: invalid center`, { centerX, centerY });
      return null;
    }
    
    // Calculate radius as average of major and minor axes for approximation
    const majorRadius = Math.sqrt(majorAxisX * majorAxisX + majorAxisY * majorAxisY);
    const minorRadius = majorRadius * ratio;
    const approxRadius = (majorRadius + minorRadius) / 2;
    
    if (approxRadius <= 0) {
      console.warn(`⚠️ Skipping ELLIPSE ${index}: invalid radius`, { approxRadius });
      return null;
    }
    
    return {
      id: `ellipse_${index}`,
      type: 'circle',
      layer,
      visible: true,
      center: { x: centerX, y: centerY },
      radius: approxRadius
    };
  }

  // Convert DIMENSION entity - usually creates lines and text
  private static convertDimension(data: Record<string, string>, layer: string, index: number): AnySceneEntity | null {
    // For DIMENSION entities, we'll create a polyline representing the dimension lines
    const x1 = parseFloat(data['13']) || parseFloat(data['10']); // First definition point
    const y1 = parseFloat(data['23']) || parseFloat(data['20']);
    const x2 = parseFloat(data['14']) || parseFloat(data['11']); // Second definition point  
    const y2 = parseFloat(data['24']) || parseFloat(data['21']);
    const x3 = parseFloat(data['15']); // Third definition point (dimension line)
    const y3 = parseFloat(data['25']);

    // Try to create dimension lines if we have enough points
    if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
      const vertices: Point2D[] = [
        { x: x1, y: y1 },
        { x: x2, y: y2 }
      ];
      
      // Add third point if available (dimension line location)
      if (!isNaN(x3) && !isNaN(y3)) {
        vertices.push({ x: x3, y: y3 });
      }
      
      return {
        id: `dimension_${index}`,
        type: 'polyline',
        layer,
        visible: true,
        vertices,
        closed: false
      };
    }
    
    console.warn(`⚠️ Skipping DIMENSION ${index}: insufficient coordinate data`);
    return null;
  }
}
