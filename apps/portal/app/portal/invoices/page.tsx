"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadPortalState, formatNaira, type Invoice } from "@/lib/mock-data";
import { Download, Receipt, Search, FileText } from "lucide-react";

export default function InvoicesPage() {
  const [state, setState] = useState(loadPortalState());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleStorageChange = () => {
      setState(loadPortalState());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const filteredInvoices = state.invoices.filter((inv) =>
    inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.planName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Download Receipt helper
  const handleDownloadReceipt = (invoice: Invoice) => {
    const receiptText = `=========================================================
                    RAILSWITCH RECEIPT
=========================================================
Merchant:       NaijaMusicPro (Naija Music Pro Ltd)
Customer:       John Doe (john.doe@acme.corp)
Invoice ID:     ${invoice.id}
Billing Date:   ${invoice.date}
Payment Method: ${invoice.method}
---------------------------------------------------------
Description                           Amount
---------------------------------------------------------
${invoice.planName}                   ${formatNaira(invoice.amount)}
---------------------------------------------------------
SUBTOTAL                              ${formatNaira(invoice.amount)}
TOTAL PAID                            ${formatNaira(invoice.amount)}
---------------------------------------------------------
Status:         ${invoice.status.toUpperCase()}
Transaction ID: tx_${Math.random().toString(36).substr(2, 9)}
Orchestrated by: RailSwitch smart recovery engine
=========================================================
         Thank you for choosing NaijaMusicPro!
=========================================================`;

    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${invoice.id}_receipt.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice History"
        description="View past charges, transaction channels, and download invoice receipts."
      />

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 dark:text-zinc-500" />
        <input
          type="text"
          placeholder="Filter invoices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-9 pl-9 pr-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 focus:bg-white dark:focus:bg-[#0c0c0e] text-sm transition-all outline-none"
        />
      </div>

      {/* Invoices List */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-[#16161a]/40 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <th className="p-4">Invoice ID</th>
                <th className="p-4">Plan / Service</th>
                <th className="p-4">Billing Date</th>
                <th className="p-4">Method</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40 text-xs">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/10 transition-colors">
                    <td className="p-4 font-mono font-semibold text-zinc-950 dark:text-zinc-200">
                      {inv.id}
                    </td>
                    <td className="p-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {inv.planName}
                    </td>
                    <td className="p-4 text-zinc-500 dark:text-zinc-400">
                      {inv.date}
                    </td>
                    <td className="p-4 text-zinc-500 dark:text-zinc-400">
                      {inv.method}
                    </td>
                    <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">
                      {formatNaira(inv.amount)}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="p-4 text-right">
                      {inv.status === "paid" ? (
                        <button
                          onClick={() => handleDownloadReceipt(inv)}
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
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="size-8 text-zinc-300 dark:text-zinc-700" />
                      <p className="font-semibold text-sm">No statements found</p>
                      <p className="text-xs">No matching invoices exist in your account.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
