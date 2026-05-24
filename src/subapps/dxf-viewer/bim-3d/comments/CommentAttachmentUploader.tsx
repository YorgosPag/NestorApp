'use client';

/**
 * ADR-366 Phase 9 / C.2 — BIM comment attachment uploader.
 * PNG/JPG only, 5MB max per file, 5 files max.
 * Generates client-side thumbnail via createImageBitmap + canvas.
 * Upload to Firebase Storage happens at comment-submit time (caller's responsibility).
 */

import { useRef, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface StagedFile {
  readonly id: string;
  readonly file: File;
  readonly thumbnailDataUrl: string;
}

interface CommentAttachmentUploaderProps {
  readonly value: readonly StagedFile[];
  readonly onChange: (files: readonly StagedFile[]) => void;
}

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg']);

async function generateThumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { resizeWidth: 128, resizeQuality: 'medium' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.75);
}

async function stageFiles(raw: FileList, existing: readonly StagedFile[]): Promise<readonly StagedFile[]> {
  const toAdd = Array.from(raw).slice(0, MAX_FILES - existing.length);
  const staged: StagedFile[] = [];
  for (const file of toAdd) {
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_SIZE_BYTES) continue;
    const thumbnailDataUrl = await generateThumbnail(file);
    staged.push({ id: crypto.randomUUID(), file, thumbnailDataUrl });
  }
  return staged;
}

export function CommentAttachmentUploader({ value, onChange }: CommentAttachmentUploaderProps) {
  const { t } = useTranslation('bim3d');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleInput(e: ChangeEvent<HTMLInputElement>): void {
    if (!e.target.files) return;
    void stageFiles(e.target.files, value).then((staged) =>
      onChange([...value, ...staged]),
    );
    e.target.value = '';
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    if (!e.dataTransfer.files) return;
    void stageFiles(e.dataTransfer.files, value).then((staged) =>
      onChange([...value, ...staged]),
    );
  }

  function remove(id: string): void {
    onChange(value.filter((f) => f.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length < MAX_FILES && (
        <label
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span>{t('comments.attachment.upload')}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            multiple
            className="sr-only"
            onChange={handleInput}
          />
        </label>
      )}

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('comments.details.attachments')}>
          {value.map((f) => (
            <li key={f.id} className="relative">
              <img
                src={f.thumbnailDataUrl}
                alt={f.file.name}
                className="h-14 w-14 rounded-md object-cover"
              />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full p-0"
                onClick={() => remove(f.id)}
                aria-label={t('comments.details.delete')}
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {t('comments.attachment.maxFiles')} · {t('comments.attachment.maxSize')}
      </p>
    </div>
  );
}
