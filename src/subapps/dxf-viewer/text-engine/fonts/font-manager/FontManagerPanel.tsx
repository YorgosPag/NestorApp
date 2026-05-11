'use client';

/**
 * FontManagerPanel — company font list + upload UI (ADR-344 Phase 2, Q18).
 *
 * Allows admin/super-admin users to upload and delete custom TTF/OTF/SHX fonts
 * for the company's DXF viewer. Regular users can see installed fonts but cannot
 * upload/delete.
 *
 * Rules:
 * - Radix UI components per ADR-001
 * - Zero inline styles (CLAUDE.md N.3)
 * - All strings via t('textFonts.*') (CLAUDE.md N.11)
 * - Enterprise IDs via generateCompanyFontId (CLAUDE.md N.6)
 */

import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button } from '@/components/ui/button';
import { uploadCompanyFont, deleteCompanyFont } from './font-upload.service';
import type { CompanyFontRecord } from './font-upload.service';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FontManagerPanelProps {
  companyId: string;
  userId: string;
  canManage: boolean;
  fonts: CompanyFontRecord[];
  onFontsChange: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-component: FontRow ───────────────────────────────────────────────────

interface FontRowProps {
  font: CompanyFontRecord;
  canManage: boolean;
  onDelete: (font: CompanyFontRecord) => void;
}

function FontRow({ font, canManage, onDelete }: FontRowProps) {
  const { t } = useTranslation(['textFonts']);
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate font-medium">{font.name}</span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs uppercase text-muted-foreground">
        {font.format}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(font.size)}</span>
      {canManage && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(font)}
          aria-label={t('textFonts:panel.delete')}
        >
          {t('textFonts:panel.delete')}
        </Button>
      )}
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FontManagerPanel({
  companyId,
  userId,
  canManage,
  fonts,
  onFontsChange,
}: FontManagerPanelProps) {
  const { t } = useTranslation(['textFonts']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CompanyFontRecord | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
        await uploadCompanyFont(companyId, file, userId);
        onFontsChange();
      } catch (err) {
        setError(t('textFonts:panel.uploadError'));
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [companyId, userId, onFontsChange, t],
  );

  const handleDelete = useCallback(
    async (font: CompanyFontRecord) => {
      setPendingDelete(null);
      try {
        await deleteCompanyFont(companyId, font.id, font.fileName);
        onFontsChange();
      } catch {
        setError(t('textFonts:panel.deleteError'));
      }
    },
    [companyId, onFontsChange, t],
  );

  return (
    <section className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('textFonts:panel.title')}</h3>
        {canManage && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? t('textFonts:panel.uploading') : t('textFonts:panel.upload')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2,.shx"
              className="sr-only"
              onChange={handleFileChange}
            />
          </>
        )}
      </header>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {fonts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('textFonts:panel.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {fonts.map((font) => (
            <FontRow
              key={font.id}
              font={font}
              canManage={canManage}
              onDelete={setPendingDelete}
            />
          ))}
        </ul>
      )}

      <AlertDialog.Root
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg">
            <AlertDialog.Title className="mb-2 text-sm font-semibold">
              {t('textFonts:panel.deleteConfirm')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mb-4 text-sm text-muted-foreground">
              {t('textFonts:panel.deleteConfirmBody')}
            </AlertDialog.Description>
            <footer className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" size="sm">
                  {t('textFonts:panel.cancel')}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => pendingDelete && handleDelete(pendingDelete)}
                >
                  {t('textFonts:panel.delete')}
                </Button>
              </AlertDialog.Action>
            </footer>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
