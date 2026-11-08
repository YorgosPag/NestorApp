'use client';

/**
 * @fileoverview ADR-923 §5.15.2 (Θ.2α-3) — **Το πλευρικό πάνελ** του `PdfCanvasViewer`: «Μικρογραφίες | Περιεχόμενα».
 * @module components/file-manager/PdfSidebar
 *
 * 🔑 Μόνο απόδοση: κατάσταση (`usePdfSidebar`), περιεχόμενα (`usePdfOutline`) και μικρογραφίες (`usePdfThumbnails`)
 *    έχουν τους κατόχους τους στον θεατή.
 * 🔑 Σταθερό πλάτος, όπως pdf.js / Chrome PDF — οι μικρογραφίες έχουν σταθερή ανάλυση.
 * 📱 Κινητό ⇒ συρτάρι από αριστερά (`Sheet`): δίπλα σε σελίδα 390 px μια στήλη δεν διαβάζεται.
 * 🔑 Κλειστό πάνελ ⇒ η λίστα **δεν** υπάρχει στο DOM ⇒ μηδέν αιτήματα μικρογραφιών (σε έντυπο με άδεια = μηδέν bytes).
 *    Το ίδιο για την καρτέλα που δεν φαίνεται (`TabsContent` της Radix αποσυνδέει ό,τι δεν είναι ενεργό).
 */

import React from 'react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/useMobile';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { PdfOutlineTree } from './PdfOutlineTree';
import { PdfThumbnailList, type PdfThumbnailListProps } from './PdfThumbnailList';
import type { PdfDocumentNavigation } from './usePdfOutline';
import type { PdfSidebarState, PdfSidebarTab } from './usePdfSidebar';

export interface PdfSidebarProps {
  /** Μοναδικό ανά θεατή (`useId`) — ο στόχος του `aria-controls` της μπάρας· δύο θεατές στη σελίδα, δύο id. */
  readonly id: string;
  readonly sidebar: PdfSidebarState;
  readonly navigation: PdfDocumentNavigation;
  readonly thumbnails: Omit<PdfThumbnailListProps, 'pageLabels' | 'onNavigate' | 'currentPage'>;
  readonly currentPage: number;
  readonly onNavigate: (page: number) => void;
}

function SidebarBody({ sidebar, navigation, thumbnails, currentPage, onNavigate }: PdfSidebarProps) {
  const { t } = useTranslation('files');
  const hasOutline = navigation.outline.length > 0;
  const tab: PdfSidebarTab = hasOutline ? sidebar.tab : 'thumbnails';
  return (
    <Tabs value={tab} onValueChange={(value) => sidebar.setTab(value === 'outline' ? 'outline' : 'thumbnails')} className="flex h-full min-h-0 flex-col">
      {hasOutline && (
        <TabsList className="m-2 shrink-0 justify-center">
          <TabsTrigger value="thumbnails">{t('pdf.sidebar.thumbnails')}</TabsTrigger>
          <TabsTrigger value="outline">{t('pdf.sidebar.outline')}</TabsTrigger>
        </TabsList>
      )}
      <TabsContent value="thumbnails" className="mt-0 min-h-0 flex-1">
        <PdfThumbnailList {...thumbnails} currentPage={currentPage} pageLabels={navigation.pageLabels} onNavigate={onNavigate} />
      </TabsContent>
      {hasOutline && (
        <TabsContent value="outline" className="mt-0 min-h-0 flex-1">
          <PdfOutlineTree outline={navigation.outline} pages={navigation.outlinePages} currentPage={currentPage} onNavigate={onNavigate} />
        </TabsContent>
      )}
    </Tabs>
  );
}

export function PdfSidebar(props: PdfSidebarProps) {
  const { t } = useTranslation('files');
  const isMobile = useIsMobile();
  const { sidebar } = props;
  if (isMobile) {
    // Στο κινητό η επιλογή σελίδας κλείνει το συρτάρι (η σελίδα είναι ο λόγος που άνοιξε).
    const navigateAndClose = (page: number) => { props.onNavigate(page); sidebar.setOpen(false); };
    return (
      <Sheet open={sidebar.open} onOpenChange={sidebar.setOpen}>
        <SheetContent side="left" id={props.id} className="flex w-64 flex-col p-0">
          <SheetTitle className="sr-only">{t('pdf.sidebar.title')}</SheetTitle>
          <SidebarBody {...props} onNavigate={navigateAndClose} />
        </SheetContent>
      </Sheet>
    );
  }
  if (!sidebar.open) return null;
  return (
    <aside id={props.id} aria-label={t('pdf.sidebar.title')} className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
      <SidebarBody {...props} />
    </aside>
  );
}
