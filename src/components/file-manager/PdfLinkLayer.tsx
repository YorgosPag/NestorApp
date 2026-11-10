'use client';

/**
 * @fileoverview ADR-923 §5.15.2 (Θ.2α-2) — **Η στρώση συνδέσμων** του `PdfCanvasViewer`.
 * @module components/file-manager/PdfLinkLayer
 *
 * 🔑 SVG με `viewBox` 0..1 πάνω από το canvas, περιοχές σε κλάσματα σελίδας ⇒ ακολουθούν
 *    ζουμ και ανάλυση χωρίς inline style (N.3). Πραγματικά `<a>`: πληκτρολόγιο (Tab/Enter), αναγνώστης οθόνης, hover.
 * 🔑 Εσωτερικός σύνδεσμος = `href="#page=N"` (σημασιολογία) + πλοήγηση μέσα στον θεατή· εξωτερικός = νέα καρτέλα με
 *    `noopener noreferrer nofollow` (ξένο περιεχόμενο: κανένα `window.opener`, κανένα referrer με άδεια, καμία ψήφος SEO).
 * 🔒 Ποια πρωτόκολλα επιτρέπονται το αποφασίζει ο **ένας** κριτής, `pdfLinkTargetOf`.
 */

import React, { useEffect, useState, type MouseEvent, type RefObject } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

import type { PdfDocProxy, PdfHighlightRegion, PdfPageProxy } from './pdf-canvas-config';
import { pdfLinkRegionOf, pdfLinkTargetOf, resolvePdfDestinationPage } from './pdf-link-target';
import { pdfPageFragment } from './usePdfPageInUrl';

const logger = createModuleLogger('PdfLinkLayer');

type PdfLink =
  | { readonly kind: 'external'; readonly region: PdfHighlightRegion; readonly href: string; readonly label: string }
  | { readonly kind: 'internal'; readonly region: PdfHighlightRegion; readonly page: number };

export interface PdfLinkLayerProps {
  readonly docRef: RefObject<PdfDocProxy | null>;
  /** Η σελίδα που φαίνεται — `null` ⇒ καμία στρώση. */
  readonly page: PdfPageProxy | null;
  readonly rotation: number;
  readonly onNavigate: (page: number) => void;
}

/** Οι σύνδεσμοι της σελίδας, με κάθε εσωτερικό προορισμό ήδη λυμένο σε σελίδα (ο σύνδεσμος που δεν λύνεται δεν δείχνεται). */
async function readPageLinks(doc: PdfDocProxy, page: PdfPageProxy, rotation: number): Promise<PdfLink[]> {
  const annotations = await page.getAnnotations({ intent: 'display' });
  const links = await Promise.all(annotations.map(async (annotation): Promise<PdfLink | null> => {
    const target = pdfLinkTargetOf(annotation);
    const region = target ? pdfLinkRegionOf(page, annotation.rect, rotation) : null;
    if (!target || !region) return null;
    if (target.kind === 'external') return { kind: 'external', region, href: target.href, label: target.label };
    const destPage = await resolvePdfDestinationPage(doc, target.dest).catch(() => null);
    return destPage === null ? null : { kind: 'internal', region, page: destPage };
  }));
  return links.filter((link): link is PdfLink => link !== null);
}

function usePageLinks(docRef: RefObject<PdfDocProxy | null>, page: PdfPageProxy | null, rotation: number): readonly PdfLink[] {
  const [links, setLinks] = useState<readonly PdfLink[]>([]);
  useEffect(() => {
    setLinks([]);
    const doc = docRef.current;
    if (!doc || !page) return;
    let cancelled = false;
    readPageLinks(doc, page, rotation).then((next) => { if (!cancelled) setLinks(next); }, (error: unknown) => {
      if (!cancelled) logger.warn('PDF links failed', { error: error instanceof Error ? error.message : String(error) });
    });
    return () => { cancelled = true; };
  }, [docRef, page, rotation]);
  return links;
}

function LinkArea({ region }: { readonly region: PdfHighlightRegion }) {
  return (
    <rect
      x={region.x}
      y={region.y}
      width={region.width}
      height={region.height}
      className="fill-transparent group-hover:fill-primary/15 group-focus-visible:fill-primary/15 group-focus-visible:stroke-primary"
      strokeWidth={0.002}
    />
  );
}

const LINK_CLASS = 'group pointer-events-auto cursor-pointer outline-none';

function PdfLinkAnchor({ link, onNavigate }: { readonly link: PdfLink; readonly onNavigate: (page: number) => void }) {
  const { t } = useTranslation('files');
  if (link.kind === 'external') {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label={t('pdf.externalLink', { target: link.label })}
        className={LINK_CLASS}
        data-pdf-link=""
      >
        <LinkArea region={link.region} />
      </a>
    );
  }
  const follow = (event: MouseEvent<SVGAElement>) => {
    event.preventDefault();
    onNavigate(link.page);
  };
  return (
    <a href={`#${pdfPageFragment(link.page)}`} onClick={follow} aria-label={t('pdf.linkToPage', { page: link.page })} className={LINK_CLASS} data-pdf-link="">
      <LinkArea region={link.region} />
    </a>
  );
}

export function PdfLinkLayer({ docRef, page, rotation, onNavigate }: PdfLinkLayerProps) {
  const links = usePageLinks(docRef, page, rotation);
  if (links.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
      {links.map((link, index) => <PdfLinkAnchor key={`${link.kind}-${index}`} link={link} onNavigate={onNavigate} />)}
    </svg>
  );
}
