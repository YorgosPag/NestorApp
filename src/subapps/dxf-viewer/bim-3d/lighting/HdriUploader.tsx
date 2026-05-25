'use client';

/**
 * ADR-366 Group B — Custom HDRI upload UI.
 *
 * Drag-drop zone for .hdr / .exr environment maps. Validates client-side,
 * uploads to Firebase Storage via `hdri-upload.service`, then writes the
 * download URL into `EnvironmentStore.customHdriUrl` — the existing
 * subscription pipeline (use-bim3d-store-sync → ThreeJsSceneManager →
 * EnvmapGenerator.loadHdri) applies the texture live.
 */

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/auth/hooks/useAuth';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import {
  HdriUploadError,
  uploadCustomHdri,
  type HdriUploadErrorCode,
} from './hdri-upload.service';

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'error'; code: HdriUploadErrorCode };

function errorKey(code: HdriUploadErrorCode): string {
  switch (code) {
    case 'format': return 'lighting.hdri.custom.formatError';
    case 'size': return 'lighting.hdri.custom.sizeError';
    case 'missing-company': return 'lighting.hdri.custom.errorGeneric';
    case 'upload-failed': return 'lighting.hdri.custom.errorGeneric';
  }
}

export function HdriUploader() {
  const { t } = useTranslation('bim3d');
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: 'idle' });

  const customHdriName = useEnvironmentStore((s) => s.customHdriName);
  const customHdriUrl = useEnvironmentStore((s) => s.customHdriUrl);

  async function handleFile(file: File): Promise<void> {
    setState({ status: 'uploading' });
    try {
      const result = await uploadCustomHdri({ file, companyId });
      useEnvironmentStore.getState().setCustomHdri(result.downloadUrl, result.fileName);
      setState({ status: 'idle' });
    } catch (err) {
      const code: HdriUploadErrorCode =
        err instanceof HdriUploadError ? err.code : 'upload-failed';
      setState({ status: 'error', code });
    }
  }

  function handleInput(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleFile(file);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function handleRemove(): void {
    useEnvironmentStore.getState().clearCustomHdri();
    setState({ status: 'idle' });
  }

  const uploading = state.status === 'uploading';
  const hasCustom = customHdriUrl !== null;

  return (
    <section aria-label={t('lighting.hdri.custom.label')} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-white/60">{t('lighting.hdri.custom.label')}</span>
        {uploading && (
          <span className="text-[10px] text-white/40">
            {t('lighting.hdri.custom.uploading')}
          </span>
        )}
      </div>

      {!hasCustom && (
        <label
          className={[
            'flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-[10px] transition-colors',
            uploading
              ? 'border-white/10 text-white/30'
              : 'border-white/20 text-white/60 hover:border-primary/50 hover:text-white',
          ].join(' ')}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Upload className="h-3 w-3 shrink-0" />
          <span>{t('lighting.hdri.custom.dropHint')}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".hdr,.exr"
            disabled={uploading}
            className="sr-only"
            onChange={handleInput}
          />
        </label>
      )}

      {hasCustom && customHdriName && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate text-[10px] text-white">
                {customHdriName}
              </span>
            </TooltipTrigger>
            <TooltipContent>{customHdriName}</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-4 w-4 shrink-0 p-0 text-white/60 hover:text-white"
            onClick={handleRemove}
            aria-label={t('lighting.hdri.custom.remove')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {state.status === 'error' && (
        <p className="text-[10px] text-destructive">{t(errorKey(state.code))}</p>
      )}
    </section>
  );
}
