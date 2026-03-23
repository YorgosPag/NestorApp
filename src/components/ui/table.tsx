import * as React from "react"

import { cn } from "@/lib/utils"
import { INTERACTIVE_PATTERNS } from "@/components/ui/effects"
import { useBorderTokens } from "@/hooks/useBorderTokens"

// =============================================================================
// TABLE SIZE SYSTEM — Centralized density tokens
// =============================================================================

/**
 * Table density sizes.
 * - default: standard padding (p-2 / 8px) — existing behavior
 * - compact: tight padding (py-1 px-1 / 4px) — for data-dense tables (ownership, grids)
 */
type TableSize = 'default' | 'compact';

/**
 * Centralized size tokens — SSoT for table density.
 * All children (th, td, input, select) inherit density from the parent <Table>.
 */
const TABLE_SIZE_TOKENS: Record<TableSize, { cell: string; head: string; compact: string }> = {
  default: {
    cell: 'p-2',
    head: 'h-8 px-2',
    compact: '',
  },
  compact: {
    cell: 'py-1 px-1',
    head: 'h-6 px-1',
    compact: '[&_input]:h-5 [&_input]:px-1 [&_input]:text-xs [&_button[role=combobox]]:h-5 [&_button[role=combobox]]:px-1',
  },
};

// React Context to propagate size to children without prop drilling
const TableSizeContext = React.createContext<TableSize>('default');

function useTableSize(): TableSize {
  return React.useContext(TableSizeContext);
}

// =============================================================================
// TABLE COMPONENTS
// =============================================================================

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Table density: 'default' (8px padding) | 'compact' (4px padding) */
  size?: TableSize;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, size = 'default', ...props }, ref) => {
    const sizeTokens = TABLE_SIZE_TOKENS[size];

    return (
      <TableSizeContext.Provider value={size}>
        <div className="relative w-full overflow-auto">
          <table
            ref={ref}
            className={cn("w-full caption-bottom text-sm", sizeTokens.compact, className)}
            {...props}
          />
        </div>
      </TableSizeContext.Provider>
    );
  },
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const { quick } = useBorderTokens();

  return (
    <thead ref={ref} className={cn(`[&_tr]:${quick.borderB}`, className)} {...props} />
  );
})
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const { style } = useBorderTokens();

  return (
    <tbody
      ref={ref}
      className={cn(`[&_tr:last-child]:${style.none}`, className)}
      {...props}
    />
  );
})
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const { quick, style } = useBorderTokens();

  return (
    <tfoot
      ref={ref}
      className={cn(
        `${quick.borderT} bg-muted/50 font-medium [&>tr]:last:${style.none}`,
        className
      )}
      {...props}
    />
  );
})
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => {
  const { quick } = useBorderTokens();

  return (
    <tr
      ref={ref}
      className={cn(
        `${quick.borderB} transition-colors ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} data-[state=selected]:bg-muted`,
        className
      )}
      {...props}
    />
  );
})
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const size = useTableSize();
  const sizeTokens = TABLE_SIZE_TOKENS[size];

  return (
    <th
      ref={ref}
      className={cn(
        `${sizeTokens.head} text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0`,
        className
      )}
      {...props}
    />
  );
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const size = useTableSize();
  const sizeTokens = TABLE_SIZE_TOKENS[size];

  return (
    <td
      ref={ref}
      className={cn(`${sizeTokens.cell} align-middle [&:has([role=checkbox])]:pr-0`, className)}
      {...props}
    />
  );
})
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-2 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

export type { TableSize }
