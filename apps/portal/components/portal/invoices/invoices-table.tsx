"use client";

import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatNaira, type Invoice } from "@/lib/mock-data";
import { Download, FileText } from "lucide-react";

interface InvoicesTableProps {
  invoices: Invoice[];
  onDownloadReceipt: (invoice: Invoice) => void;
}

export function InvoicesTable({ invoices, onDownloadReceipt }: InvoicesTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice ID</TableHead>
            <TableHead>Plan / Service</TableHead>
            <TableHead>Billing Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length > 0 ? (
            invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono font-semibold text-zinc-950 dark:text-zinc-200">
                  {inv.id}
                </TableCell>
                <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {inv.planName}
                </TableCell>
                <TableCell className="text-zinc-500 dark:text-zinc-400">
                  {inv.date}
                </TableCell>
                <TableCell className="text-zinc-500 dark:text-zinc-400">
                  {inv.method}
                </TableCell>
                <TableCell className="font-bold text-zinc-900 dark:text-zinc-100">
                  {formatNaira(inv.amount)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={inv.status} />
                </TableCell>
                <TableCell className="text-right">
                  {inv.status === "paid" ? (
                    <button
                      onClick={() => onDownloadReceipt(inv)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 font-bold transition-all"
                    >
                      <Download className="size-3" />
                      Receipt
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-semibold italic">
                      No receipt
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileText className="size-8 text-zinc-300 dark:text-zinc-700" />
                  <p className="font-semibold text-sm">No statements found</p>
                  <p className="text-xs">No matching invoices exist in your account.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
