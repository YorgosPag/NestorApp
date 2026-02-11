"use client";

import TableOfContents from './TableOfContents';
import type { TableOfContentsProps } from './types';

export default function CompactTableOfContents(props: Omit<TableOfContentsProps, 'compact'>) {
  return <TableOfContents {...props} compact />;
}

