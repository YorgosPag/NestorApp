'use client';
/**
 * ADR-651 Φάση Δ — hook του διαλόγου «AI Πινακίδα».
 *
 * Ενορχηστρώνει: (α) generate (εικόνα/κείμενο) μέσω των AI routes, (β) AI compliance,
 * (γ) «Εισαγωγή στη σκηνή» (θέτει AI override στο options-store + οπλίζει το εργαλείο
 * «Πινακίδα» με το ΥΠΑΡΧΟΝ `level-panel:tool-change` — μηδέν νέος μηχανισμός ενεργοποίησης),
 * (δ) «Αποθήκευση προτύπου» μέσω του ΥΠΑΡΧΟΝΤΟΣ CRUD (`POST /api/dxf/text-templates`).
 *
 * Graceful παντού: αποτυχία AI ⇒ i18n error key κάτω από `aiTitleBlock.errors`, ποτέ crash.
 * Το κλειδί OpenAI ζει μόνο πίσω από τα routes.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EventBus } from '../../../systems/events/EventBus';
import { useTitleBlockOptionsStore } from '../../../state/title-block-options-store';
import { getPlaceholderScopeSources } from '../../../text-engine/templates/resolver/placeholder-scope-client';
import { getActiveScaleName } from '../../../systems/viewport/ViewportStore';
import {
  requestAiCompliance,
  requestTitleBlockFromImage,
  requestTitleBlockFromText,
} from '../../../text-engine/title-block/ai/ai-title-block-client';
import type { AiComplianceWarning } from '../../../text-engine/title-block/ai/ai-title-block-schema';
import type { AiTitleBlockResult } from '../../../text-engine/title-block/ai/ai-title-block-reconcile';
import {
  TITLE_BLOCK_STAMP_LABEL,
  toTitleBlockLocale,
} from '../../../text-engine/title-block/title-block-presets';

export type AiTitleBlockMode = 'image' | 'text';

const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface UseAiTitleBlockResult {
  readonly mode: AiTitleBlockMode;
  readonly prompt: string;
  readonly imageName: string | null;
  readonly templateName: string;
  readonly result: AiTitleBlockResult | null;
  readonly warnings: readonly AiComplianceWarning[];
  readonly generating: boolean;
  readonly validating: boolean;
  readonly saving: boolean;
  readonly saved: boolean;
  /** i18n key suffix κάτω από `aiTitleBlock.errors`, ή `null`. */
  readonly errorKey: string | null;
  setMode(mode: AiTitleBlockMode): void;
  setPrompt(prompt: string): void;
  setTemplateName(name: string): void;
  pickImage(file: File): void;
  generate(): Promise<void>;
  runCompliance(): Promise<void>;
  insert(): void;
  save(): Promise<void>;
}

/** Το ενεργό σχέδιο ξέρει την κλίμακα· ο compliance θέλει «τι θα τυπωθεί». */
function drawingFacts(): { scale?: string } {
  const scale = getActiveScaleName();
  return scale ? { scale } : {};
}

export function useAiTitleBlock(projectId?: string): UseAiTitleBlockResult {
  const { i18n } = useTranslation('dxf-viewer-shell');
  const locale = toTitleBlockLocale(i18n.language);

  const [mode, setMode] = useState<AiTitleBlockMode>('image');
  const [prompt, setPrompt] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [result, setResult] = useState<AiTitleBlockResult | null>(null);
  const [warnings, setWarnings] = useState<readonly AiComplianceWarning[]>([]);
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const pickImage = useCallback((file: File) => {
    setErrorKey(null);
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setErrorKey('imageFormat');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorKey('imageTooLarge');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(typeof reader.result === 'string' ? reader.result : null);
      setImageName(file.name);
    };
    reader.onerror = () => setErrorKey('imageFormat');
    reader.readAsDataURL(file);
  }, []);

  const runCompliance = useCallback(async () => {
    if (!result) return;
    setValidating(true);
    try {
      const next = await requestAiCompliance({
        content: result.template.content,
        locale,
        withStampBox: result.withStampBox,
        stampImageUrl: getPlaceholderScopeSources().user?.stampImageUrl,
        projectId,
        drawing: drawingFacts(),
      });
      setWarnings(next);
    } finally {
      setValidating(false);
    }
  }, [result, locale, projectId]);

  const generate = useCallback(async () => {
    setErrorKey(null);
    setSaved(false);
    setWarnings([]);
    if (mode === 'image' && !imageDataUrl) {
      setErrorKey('imageFormat');
      return;
    }
    if (mode === 'text' && !prompt.trim()) {
      setErrorKey('emptyPrompt');
      return;
    }
    setGenerating(true);
    try {
      const next =
        mode === 'image'
          ? await requestTitleBlockFromImage(imageDataUrl as string, locale)
          : await requestTitleBlockFromText(prompt.trim(), locale);
      if (!next) {
        setErrorKey(mode === 'image' ? 'analyzeFailed' : 'generateFailed');
        setResult(null);
        return;
      }
      setResult(next);
      void runCompliance();
    } finally {
      setGenerating(false);
    }
  }, [mode, imageDataUrl, prompt, locale, runCompliance]);

  const insert = useCallback(() => {
    if (!result) return;
    const tplLocale = toTitleBlockLocale(result.template.locale);
    useTitleBlockOptionsStore.getState().setAiOverride({
      template: result.template,
      withStampBox: result.withStampBox,
      stampLabel: result.withStampBox ? TITLE_BLOCK_STAMP_LABEL[tplLocale] : '',
    });
    // Οπλίζει το εργαλείο «Πινακίδα» — ο χρήστης κάνει κλικ για τοποθέτηση (μοτίβο Φάσης Β).
    EventBus.emit('level-panel:tool-change', 'title-block');
  }, [result]);

  const save = useCallback(async () => {
    if (!result || !templateName.trim()) return;
    setSaving(true);
    setErrorKey(null);
    try {
      const response = await fetch('/api/dxf/text-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          category: 'title-block',
          content: result.template.content,
        }),
      });
      if (!response.ok) {
        setErrorKey('saveFailed');
        return;
      }
      setSaved(true);
    } catch {
      setErrorKey('saveFailed');
    } finally {
      setSaving(false);
    }
  }, [result, templateName]);

  return {
    mode,
    prompt,
    imageName,
    templateName,
    result,
    warnings,
    generating,
    validating,
    saving,
    saved,
    errorKey,
    setMode,
    setPrompt,
    setTemplateName,
    pickImage,
    generate,
    runCompliance,
    insert,
    save,
  };
}
