/**
 * ADR-344 Phase 7.D — Sample `PlaceholderScope` for the manager preview.
 *
 * Built from `PLACEHOLDER_REGISTRY.<path>.sample` so the same data that
 * documents each placeholder also drives the preview. No I/O, no Firestore
 * — the preview is a client-side static demo, not a real drawing render.
 *
 * The hook memoises on `locale` so React only re-renders the preview pane
 * when the user actually changes language (e.g. el → en).
 */
'use client';

import { useMemo } from 'react';
import {
  PLACEHOLDER_REGISTRY,
  type PlaceholderPath,
  type PlaceholderScope,
} from '@/subapps/dxf-viewer/text-engine/templates';

type PreviewLocale = 'el' | 'en';

function sampleFor(path: PlaceholderPath): string {
  return PLACEHOLDER_REGISTRY[path].sample;
}

function parseDdMmYyyy(input: string): Date | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

export function useTextTemplatePreviewScope(locale: PreviewLocale = 'el'): PlaceholderScope {
  return useMemo<PlaceholderScope>(() => {
    const revisionDate = parseDdMmYyyy(sampleFor('revision.date'));
    return {
      company: { name: sampleFor('company.name') },
      project: {
        name: sampleFor('project.name'),
        code: sampleFor('project.code'),
        owner: sampleFor('project.owner'),
      },
      drawing: {
        title: sampleFor('drawing.title'),
        scale: sampleFor('drawing.scale'),
        sheetNumber: sampleFor('drawing.sheetNumber'),
        units: sampleFor('drawing.units'),
      },
      user: {
        fullName: sampleFor('user.fullName'),
        checkerName: sampleFor('user.checkerName'),
        title: sampleFor('user.title'),
        licenseNumber: sampleFor('user.licenseNumber'),
      },
      revision: {
        number: sampleFor('revision.number'),
        date: revisionDate,
        author: sampleFor('revision.author'),
        description: sampleFor('revision.description'),
      },
      formatting: { locale },
    };
  }, [locale]);
}
