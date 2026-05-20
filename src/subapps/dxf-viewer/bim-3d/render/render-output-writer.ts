/**
 * render-output-writer.ts — ADR-366 §B.4 Phase 6
 *
 * Writes render output to disk (browser download) and/or project (Firebase Storage + Firestore).
 * Pure async module — no React imports.
 */

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateBimRenderId } from '@/services/enterprise-id-convenience';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';
import type { RenderFormat } from '../stores/ViewMode3DStore';

export interface RenderOutputConfig {
  format: RenderFormat;
  destDisk: boolean;
  destProject: boolean;
  projectId: string;
  companyId: string;
  userId: string;
  /** SPP used — for metadata snapshot */
  presetSPP: number;
  resolutionW: number;
  resolutionH: number;
}

async function canvasToBlob(canvas: HTMLCanvasElement, format: RenderFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (format === 'exr') {
      // THREE.EXRExporter is not available in three@0.170.0 — PNG fallback.
      // TODO Phase 7.x: replace with OIDN-wasm EXR writer when available.
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas blob export failed'));
      }, 'image/png');
    } else {
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const quality = format === 'jpg' ? 0.92 : undefined;
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas blob export failed'));
        },
        mimeType,
        quality,
      );
    }
  });
}

function buildFilename(config: RenderOutputConfig): string {
  const ext = config.format === 'exr' ? 'png' : config.format;
  const ts = nowISO().replace(/[:.]/g, '-').slice(0, 19);
  return `render_${config.resolutionW}x${config.resolutionH}_${ts}.${ext}`;
}

export async function writeRenderOutput(
  canvas: HTMLCanvasElement,
  config: RenderOutputConfig,
): Promise<{ savedDisk: boolean; savedProject: boolean; uploadError: boolean }> {
  const blob = await canvasToBlob(canvas, config.format);
  const filename = buildFilename(config);
  const ext = config.format === 'exr' ? 'png' : config.format;

  let savedDisk = false;
  let savedProject = false;
  let uploadError = false;

  if (config.destDisk) {
    triggerExportDownload({ blob, filename });
    savedDisk = true;
  }

  if (config.destProject) {
    const renderId = generateBimRenderId();
    const { path: storagePath } = buildStoragePath({
      companyId: config.companyId,
      projectId: config.projectId,
      entityType: ENTITY_TYPES.PROJECT,
      entityId: config.projectId,
      domain: FILE_DOMAINS.CONSTRUCTION,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: renderId,
      ext,
    });
    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, {
        contentType: config.format === 'jpg' ? 'image/jpeg' : 'image/png',
      });

      const docRef = doc(db, COLLECTIONS.BIM_RENDERS, renderId);
      await setDoc(docRef, {
        id: renderId,
        companyId: config.companyId,
        projectId: config.projectId,
        createdBy: config.userId,
        createdAt: serverTimestamp(),
        type: 'bim-render',
        format: ext,
        storagePath,
        resolutionW: config.resolutionW,
        resolutionH: config.resolutionH,
        presetSPP: config.presetSPP,
      });
      savedProject = true;
    } catch {
      uploadError = true;
      // Belt-and-suspenders: if upload fails, fall back to disk download
      if (!savedDisk) {
        triggerExportDownload({ blob, filename });
        savedDisk = true;
      }
    }
  }

  return { savedDisk, savedProject, uploadError };
}
