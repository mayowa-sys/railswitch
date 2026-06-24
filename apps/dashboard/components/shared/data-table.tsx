"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  cell: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: string | ((row: T) => string);
  /** Extractor for a stable row key — required for filterable / sorted lists to avoid index-key issues */
  rowKey?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  skeletonRows = 5,
  emptyTitle = "No results found",
  emptyDescription = "Try adjusting your filters or search query.",
  onRowClick,
  rowClassName,
  rowKey,
}: DataTableProps<T>) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-200 dark:border-zinc-800/80 hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50/60 dark:bg-zinc-900/40 h-10",
                  col.headerClassName
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={i} className="border-zinc-100 dark:border-zinc-800/50">
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    <Skeleton className="h-4 w-full rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                <EmptyState
                  icon={PackageSearch}
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow
                key={rowKey ? rowKey(row) : i}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-zinc-100 dark:border-zinc-800/50 transition-colors duration-150",
                  onRowClick && "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30",
                  typeof rowClassName === "function" ? rowClassName(row) : rowClassName
                )}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={cn("py-3 text-sm", col.className)}>
                    {col.cell(row, i)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
