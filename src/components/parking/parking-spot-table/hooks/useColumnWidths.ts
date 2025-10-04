import { useState, useCallback } from "react";
import { DEFAULT_COLUMN_WIDTHS } from "../config/columns";

export function useColumnWidths() {
  const [columnWidths, setColumnWidths] = useState<number[]>(DEFAULT_COLUMN_WIDTHS);
  const handleColumnResize = useCallback((newWidths: number[]) => setColumnWidths(newWidths), []);
  return { columnWidths, handleColumnResize };
}
