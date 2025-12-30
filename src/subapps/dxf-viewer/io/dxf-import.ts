import type { Point2D } from '../rendering/types/Types';
import type { DxfImportResult, SceneModel, SceneBounds, BaseEntity } from '../types/scene';

// ✅ ENTERPRISE FIX: Extended entity interfaces for DXF import processing
interface LineEntity extends BaseEntity {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

interface PolylineEntity extends BaseEntity {
  type: 'polyline';
  vertices: Point2D[];
}

interface CircleEntity extends BaseEntity {
  type: 'circle';
  center: Point2D;
  radius: number;
}

interface ArcEntity extends BaseEntity {
  type: 'arc';
  center: Point2D;
  radius: number;
}

interface TextEntity extends BaseEntity {
  type: 'text';
  position: Point2D;
  text?: string;
  height?: number;
}

interface BlockEntity extends BaseEntity {
  type: 'block';
  position: Point2D;
}

export class DxfImportService {
  private worker: Worker | null = null;
  
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/dxf-parser.worker.ts', import.meta.url)
      );
    }
    return this.worker;
  }

  private calculateTightBounds(scene: SceneModel): SceneBounds {
    if (scene.entities.length === 0) {
      return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // 🔺 ΒΗΜΑ 1: Εύρεση ΑΚΡΙΒΩΝ bounds (χωρίς κανένα padding)
    scene.entities.forEach((entity) => {
      try {
        switch (entity.type) {
          case 'line':
            const lineEntity = entity as LineEntity;
            if (lineEntity.start && lineEntity.end) {
              minX = Math.min(minX, lineEntity.start.x, lineEntity.end.x);
              minY = Math.min(minY, lineEntity.start.y, lineEntity.end.y);
              maxX = Math.max(maxX, lineEntity.start.x, lineEntity.end.x);
              maxY = Math.max(maxY, lineEntity.start.y, lineEntity.end.y);
            }
            break;
            
          case 'polyline':
            const polylineEntity = entity as PolylineEntity;
            if (polylineEntity.vertices && Array.isArray(polylineEntity.vertices)) {
              polylineEntity.vertices.forEach((vertex: Point2D) => {
                if (vertex.x !== undefined && vertex.y !== undefined) {
                  minX = Math.min(minX, vertex.x);
                  minY = Math.min(minY, vertex.y);
                  maxX = Math.max(maxX, vertex.x);
                  maxY = Math.max(maxY, vertex.y);
                }
              });
            }
            break;
            
          case 'circle':
            const circleEntity = entity as CircleEntity;
            if (circleEntity.center && circleEntity.radius !== undefined) {
              minX = Math.min(minX, circleEntity.center.x - circleEntity.radius);
              minY = Math.min(minY, circleEntity.center.y - circleEntity.radius);
              maxX = Math.max(maxX, circleEntity.center.x + circleEntity.radius);
              maxY = Math.max(maxY, circleEntity.center.y + circleEntity.radius);
            }
            break;
            
          case 'arc':
            const arcEntity = entity as ArcEntity;
            if (arcEntity.center && arcEntity.radius !== undefined) {
              minX = Math.min(minX, arcEntity.center.x - arcEntity.radius);
              minY = Math.min(minY, arcEntity.center.y - arcEntity.radius);
              maxX = Math.max(maxX, arcEntity.center.x + arcEntity.radius);
              maxY = Math.max(maxY, arcEntity.center.y + arcEntity.radius);
            }
            break;
            
          case 'text':
            const textEntity = entity as TextEntity;
            if (textEntity.position) {
              const textWidth = (textEntity.text?.length || 5) * (textEntity.height || 10) * 0.7;
              const textHeight = textEntity.height || 10;
              minX = Math.min(minX, textEntity.position.x);
              minY = Math.min(minY, textEntity.position.y);
              maxX = Math.max(maxX, textEntity.position.x + textWidth);
              maxY = Math.max(maxY, textEntity.position.y + textHeight);
            }
            break;
            
          case 'block':
            const blockEntity = entity as BlockEntity;
            if (blockEntity.position) {
              minX = Math.min(minX, blockEntity.position.x);
              minY = Math.min(minY, blockEntity.position.y);
              maxX = Math.max(maxX, blockEntity.position.x);
              maxY = Math.max(maxY, blockEntity.position.y);
            }
            break;
        }
      } catch (error) {
        console.warn('Error processing entity bounds:', entity, error);
      }
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      console.warn('Invalid bounds calculated, using defaults');
      return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
    }

    // 🔺 ΒΗΜΑ 2: PERFECT ALIGNMENT OFFSET
    // Bottom-left corner πάντα στο (0,0)
    const offsetX = -minX;
    const offsetY = -minY;

    // 🔺 ΒΗΜΑ 3: Εφαρμογή του offset σε ΟΛΕΣ τις οντότητες
    scene.entities.forEach((entity) => {
      try {
        switch (entity.type) {
          case 'line':
            const lineEnt = entity as LineEntity;
            if (lineEnt.start && lineEnt.end) {
              lineEnt.start.x += offsetX;
              lineEnt.start.y += offsetY;
              lineEnt.end.x += offsetX;
              lineEnt.end.y += offsetY;
            }
            break;
            
          case 'polyline':
            const polyEnt = entity as PolylineEntity;
            if (polyEnt.vertices && Array.isArray(polyEnt.vertices)) {
              polyEnt.vertices.forEach((vertex: Point2D) => {
                if (vertex.x !== undefined && vertex.y !== undefined) {
                  vertex.x += offsetX;
                  vertex.y += offsetY;
                }
              });
            }
            break;
            
          case 'circle':
          case 'arc':
            const circEnt = entity as CircleEntity | ArcEntity;
            if (circEnt.center) {
              circEnt.center.x += offsetX;
              circEnt.center.y += offsetY;
            }
            break;
            
          case 'text':
            const textEnt = entity as TextEntity;
            if (textEnt.position) {
              textEnt.position.x += offsetX;
              textEnt.position.y += offsetY;
            }
            break;
            
          case 'block':
            const blockEnt = entity as BlockEntity;
            if (blockEnt.position) {
              blockEnt.position.x += offsetX;
              blockEnt.position.y += offsetY;
            }
            break;
        }
      } catch (error) {
        console.warn('Error normalizing entity:', entity, error);
      }
    });
    
    // 🔺 ΒΗΜΑ 4: PERFECT TIGHT BOUNDS - ZERO PADDING
    // Bottom-left exactly at (0,0), Top-right exactly at drawing size
    const perfectBounds = {
      min: { x: 0, y: 0 },           // 🔺 PERFECT: Bottom-left στο (0,0)
      max: { 
        x: maxX - minX,              // 🔺 PERFECT: Ακριβές width
        y: maxY - minY               // 🔺 PERFECT: Ακριβές height
      }
    };

    return perfectBounds;
  }
  
  private async tryReadFileWithEncoding(file: File, encoding: string): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      if (encoding === 'UTF-8' || encoding === 'Windows-1253' || encoding === 'ISO-8859-7') {
        // For text files, try reading as ArrayBuffer first, then decode manually
        reader.onload = (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
              resolve(null);
              return;
            }
            
            // Convert ArrayBuffer to Uint8Array
            const bytes = new Uint8Array(arrayBuffer);
            let content = '';
            
            if (encoding === 'UTF-8') {
              // Use TextDecoder for UTF-8
              const decoder = new TextDecoder('utf-8');
              content = decoder.decode(bytes);
            } else if (encoding === 'Windows-1253') {
              // Manual decode Windows-1253 (Greek)
              content = this.decodeWindows1253(bytes);
            } else if (encoding === 'ISO-8859-7') {
              // Manual decode ISO-8859-7 (Greek)
              content = this.decodeISO88597(bytes);
            }
            
            resolve(content || null);
          } catch (error) {
            console.warn(`Decode error with ${encoding}:`, error);
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(file);
      } else {
        // Fallback to standard text reading
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve(content || null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file, encoding);
      }
    });
  }
  
  private processBytes(bytes: Uint8Array, mapper: (byte: number) => string): string {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte < 128) {
        result += String.fromCharCode(byte);
      } else {
        result += mapper(byte);
      }
    }
    return result;
  }

  private decodeWindows1253(bytes: Uint8Array): string {
    // Complete Windows-1253 to Unicode mapping table
    const windows1253ToUnicode: { [key: number]: number } = {
      0x80: 0x20AC, // Euro sign
      0x82: 0x201A, // Single low-9 quotation mark
      0x83: 0x0192, // Latin small letter f with hook
      0x84: 0x201E, // Double low-9 quotation mark
      0x85: 0x2026, // Horizontal ellipsis
      0x86: 0x2020, // Dagger
      0x87: 0x2021, // Double dagger
      0x89: 0x2030, // Per mille sign
      0x8B: 0x2039, // Single left-pointing angle quotation mark
      0x8C: 0x0152, // Latin capital ligature OE
      0x8E: 0x017D, // Latin capital letter Z with caron
      0x91: 0x2018, // Left single quotation mark
      0x92: 0x2019, // Right single quotation mark
      0x93: 0x201C, // Left double quotation mark
      0x94: 0x201D, // Right double quotation mark
      0x95: 0x2022, // Bullet
      0x96: 0x2013, // En dash
      0x97: 0x2014, // Em dash
      0x99: 0x2122, // Trade mark sign
      0x9B: 0x203A, // Single right-pointing angle quotation mark
      0x9C: 0x0153, // Latin small ligature oe
      0x9E: 0x017E, // Latin small letter z with caron
      0x9F: 0x0178, // Latin capital letter Y with diaeresis
      0xA0: 0x00A0, // No-break space
      0xA1: 0x0385, // Greek dialytika tonos
      0xA2: 0x0386, // Greek capital letter alpha with tonos
      0xA3: 0x00A3, // Pound sign
      0xA4: 0x00A4, // Currency sign
      0xA5: 0x00A5, // Yen sign
      0xA6: 0x00A6, // Broken bar
      0xA7: 0x00A7, // Section sign
      0xA8: 0x00A8, // Diaeresis
      0xA9: 0x00A9, // Copyright sign
      0xAB: 0x00AB, // Left-pointing double angle quotation mark
      0xAC: 0x00AC, // Not sign
      0xAD: 0x00AD, // Soft hyphen
      0xAE: 0x00AE, // Registered sign
      0xAF: 0x2015, // Horizontal bar
      0xB0: 0x00B0, // Degree sign
      0xB1: 0x00B1, // Plus-minus sign
      0xB2: 0x00B2, // Superscript two
      0xB3: 0x00B3, // Superscript three
      0xB4: 0x0384, // Greek tonos
      0xB5: 0x00B5, // Micro sign
      0xB6: 0x00B6, // Pilcrow sign
      0xB7: 0x00B7, // Middle dot
      0xB8: 0x0388, // Greek capital letter epsilon with tonos
      0xB9: 0x0389, // Greek capital letter eta with tonos
      0xBA: 0x038A, // Greek capital letter iota with tonos
      0xBB: 0x00BB, // Right-pointing double angle quotation mark
      0xBC: 0x038C, // Greek capital letter omicron with tonos
      0xBD: 0x00BD, // Vulgar fraction one half
      0xBE: 0x038E, // Greek capital letter upsilon with tonos
      0xBF: 0x038F, // Greek capital letter omega with tonos
      // Greek alphabet starts here
      0xC0: 0x0390, // Greek small letter iota with dialytika and tonos
      0xC1: 0x0391, // Greek capital letter alpha
      0xC2: 0x0392, // Greek capital letter beta
      0xC3: 0x0393, // Greek capital letter gamma
      0xC4: 0x0394, // Greek capital letter delta
      0xC5: 0x0395, // Greek capital letter epsilon
      0xC6: 0x0396, // Greek capital letter zeta
      0xC7: 0x0397, // Greek capital letter eta
      0xC8: 0x0398, // Greek capital letter theta
      0xC9: 0x0399, // Greek capital letter iota
      0xCA: 0x039A, // Greek capital letter kappa
      0xCB: 0x039B, // Greek capital letter lambda
      0xCC: 0x039C, // Greek capital letter mu
      0xCD: 0x039D, // Greek capital letter nu
      0xCE: 0x039E, // Greek capital letter xi
      0xCF: 0x039F, // Greek capital letter omicron
      0xD0: 0x03A0, // Greek capital letter pi
      0xD1: 0x03A1, // Greek capital letter rho
      0xD3: 0x03A3, // Greek capital letter sigma
      0xD4: 0x03A4, // Greek capital letter tau
      0xD5: 0x03A5, // Greek capital letter upsilon
      0xD6: 0x03A6, // Greek capital letter phi
      0xD7: 0x03A7, // Greek capital letter chi
      0xD8: 0x03A8, // Greek capital letter psi
      0xD9: 0x03A9, // Greek capital letter omega
      0xDA: 0x03AA, // Greek capital letter iota with dialytika
      0xDB: 0x03AB, // Greek capital letter upsilon with dialytika
      0xDC: 0x03AC, // Greek small letter alpha with tonos
      0xDD: 0x03AD, // Greek small letter epsilon with tonos
      0xDE: 0x03AE, // Greek small letter eta with tonos
      0xDF: 0x03AF, // Greek small letter iota with tonos
      0xE0: 0x03B0, // Greek small letter upsilon with dialytika and tonos
      0xE1: 0x03B1, // Greek small letter alpha
      0xE2: 0x03B2, // Greek small letter beta
      0xE3: 0x03B3, // Greek small letter gamma
      0xE4: 0x03B4, // Greek small letter delta
      0xE5: 0x03B5, // Greek small letter epsilon
      0xE6: 0x03B6, // Greek small letter zeta
      0xE7: 0x03B7, // Greek small letter eta
      0xE8: 0x03B8, // Greek small letter theta
      0xE9: 0x03B9, // Greek small letter iota
      0xEA: 0x03BA, // Greek small letter kappa
      0xEB: 0x03BB, // Greek small letter lambda
      0xEC: 0x03BC, // Greek small letter mu
      0xED: 0x03BD, // Greek small letter nu
      0xEE: 0x03BE, // Greek small letter xi
      0xEF: 0x03BF, // Greek small letter omicron
      0xF0: 0x03C0, // Greek small letter pi
      0xF1: 0x03C1, // Greek small letter rho
      0xF2: 0x03C2, // Greek small letter final sigma
      0xF3: 0x03C3, // Greek small letter sigma
      0xF4: 0x03C4, // Greek small letter tau
      0xF5: 0x03C5, // Greek small letter upsilon
      0xF6: 0x03C6, // Greek small letter phi
      0xF7: 0x03C7, // Greek small letter chi
      0xF8: 0x03C8, // Greek small letter psi
      0xF9: 0x03C9, // Greek small letter omega
      0xFA: 0x03CA, // Greek small letter iota with dialytika
      0xFB: 0x03CB, // Greek small letter upsilon with dialytika
      0xFC: 0x03CC, // Greek small letter omicron with tonos
      0xFD: 0x03CD, // Greek small letter upsilon with tonos
      0xFE: 0x03CE  // Greek small letter omega with tonos
    };
    
    return this.processBytes(bytes, (byte) => {
      if (windows1253ToUnicode[byte]) {
        return String.fromCharCode(windows1253ToUnicode[byte]);
      } else {
        return String.fromCharCode(byte);
      }
    });
  }
  
  private decodeISO88597(bytes: Uint8Array): string {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte < 128) {
        // ASCII characters
        result += String.fromCharCode(byte);
      } else if (byte >= 0xB0 && byte <= 0xFE) {
        // Greek characters in ISO-8859-7 range
        const greekOffset = byte - 0xB0;
        const unicodeStart = 0x0390; // Greek range start  
        result += String.fromCharCode(unicodeStart + greekOffset);
      } else {
        result += String.fromCharCode(byte);
      }
    }
    return result;
  }

  async importDxfFile(file: File, encoding?: string): Promise<DxfImportResult> {

    // Προσωρινά επαναφορά σε direct parsing μέχρι να διορθωθεί το worker
    if (process.env.NODE_ENV === 'development') {
      try {

        const result = await this.directParseFileWithEncoding(file, encoding);
        if (result.success) {
          return result;
        }

      } catch (error) {

      }
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      const timeout = setTimeout(() => {
        console.error('⌛ DXF import timeout after 15 seconds');
        resolve({
          success: false,
          error: 'DXF import timeout - worker did not respond',
          stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
        });
      }, 15000);
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!content) {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: 'Failed to read file content',
            stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
          });
          return;
        }
        
        try {
          const worker = this.getWorker();
          
          worker.onmessage = (event) => {
            clearTimeout(timeout);
            const result = event.data as DxfImportResult;
            
            if (result.success && result.scene) {
              const perfectBounds = this.calculateTightBounds(result.scene);
              result.scene.bounds = perfectBounds;
            }
            
            resolve(result);
          };
          
          worker.onerror = (error) => {
            clearTimeout(timeout);
            console.error('DXF worker error:', error);
            resolve({
              success: false,
              error: 'DXF parsing worker failed. This might be due to an unsupported file format or corrupted file.',
              stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
            });
          };
          
          worker.postMessage({ 
            type: 'parse-dxf',
            fileContent: content,
            filename: file.name
          });
        } catch (workerError) {
          clearTimeout(timeout);
          console.error('Failed to create worker:', workerError);
          resolve({
            success: false,
            error: 'Failed to initialize DXF parser. Worker not supported in this environment.',
            stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
          });
        }
      };
      
      reader.onerror = () => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: 'Failed to read file',
          stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
        });
      };
      
      // Try UTF-8 first, then fallback to Windows-1253 for Greek characters
      reader.readAsText(file, 'UTF-8');
    });
  }
  
  private async directParseFileWithEncoding(file: File, encoding?: string): Promise<DxfImportResult> {
    // If specific encoding is provided, use it; otherwise try different encodings for Greek text support
    const encodings = encoding ? [encoding] : ['UTF-8', 'Windows-1253', 'ISO-8859-7'];
    
    for (const currentEncoding of encodings) {
      try {

        const content = await this.tryReadFileWithEncoding(file, currentEncoding);
        
        if (!content) {

          continue;
        }
        
        // Debug: Show first few characters and bytes

        // Test if content has reasonable Greek text (not garbled)
        const hasGreekText = /[\u0370-\u03FF\u1F00-\u1FFF]/.test(content);
        const hasGarbledChars = /[�\uFFFD]/.test(content);
        const garbledCount = (content.match(/[�\uFFFD]/g) || []).length;
        
        if (hasGreekText) {

        }
        if (hasGarbledChars) {

          // If UTF-8 produces garbage, skip to next encoding
          if (currentEncoding === 'UTF-8') {

            continue;
          }
        }
        
        const { DxfSceneBuilder } = await import('../utils/dxf-scene-builder');
        const startTime = performance.now();

        const scene = DxfSceneBuilder.buildScene(content);
        
        if (!scene) {

          continue;
        }

        // Apply bounds normalization to ensure bottom-left corner is at (0,0)
        if (scene && scene.entities.length > 0) {
          const perfectBounds = this.calculateTightBounds(scene);
          scene.bounds = perfectBounds;

        }
        
        if (!DxfSceneBuilder.validateScene(scene)) {

          continue;
        }
        
        const parseTimeMs = performance.now() - startTime;

        return {
          success: true,
          scene,
          stats: {
            entityCount: scene.entities.length,
            layerCount: Object.keys(scene.layers).length,
            parseTimeMs
          }
        };
        
      } catch (error) {

        continue;
      }
    }
    
    // If all encodings failed
    return {
      success: false,
      error: 'Failed to parse DXF file with any supported encoding (UTF-8, Windows-1253, ISO-8859-7)',
      stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
    };
  }
  
  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const dxfImportService = new DxfImportService();
