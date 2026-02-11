"use client";

import TableOfContents from './TableOfContents';
import type { TableOfContentsProps } from './types';

export default function PrintTableOfContents(props: Omit<TableOfContentsProps, 'showPageNumbers'>) {
  return <TableOfContents {...props} showPageNumbers />;
}

