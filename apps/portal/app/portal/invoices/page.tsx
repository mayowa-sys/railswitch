"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { InvoicesTable } from "@/components/portal/invoices/invoices-table";
import { loadPortalState, formatNaira, type Invoice, getServerPortalState } from "@/lib/mock-data";
import { isMockMode, api, type GatewayInvoice } from "@/lib/api-client";
import { useApiData } from "@/lib/use-api-data";
import { Search } from "lucide-react";

import { PORTAL_API_KEY as API_KEY } from "@/lib/config";

export default function InvoicesPage() {
  const [state, setState] = useState(() => getServerPortalState());
  const [searchQuery, setSearchQuery] = useState("");
  const mock = isMockMode();

  const { data: rawInvoices, isLoading } = useApiData({
    fetcher: (key) => api.invoices.list(key),
    mockData: [] as GatewayInvoice[],
    apiKey: API_KEY,
  });

  useEffect(() => {
    if (!mock) return;
    setState(loadPortalState());
    const handleStorageChange = () => { setState(loadPortalState()); };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [mock]);

  const realInvoices = useMemo(() => {
    if (mock || rawInvoices.length === 0) return [];
    return rawInvoices.map((inv) => ({
      id: inv.id,
      planName: inv.description ?? "Subscription",
      amount: inv.amount,
      status: inv.status as "paid" | "failed" | "pending",
      date: new Date(inv.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }),
      method: "Gateway",
    }));
  }, [mock, rawInvoices]);

  const invoices = mock ? (state?.invoices || getServerPortalState().invoices) : realInvoices;
  const filteredInvoices = invoices.filter((inv: Invoice) =>
    inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.planName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
Transaction ID: tx_${Math.random().toString(36).slice(2, 11)}
Orchestrated by: RailSwitch smart recovery engine
=========================================================
         Thank you for choosing NaijaMusicPro!
========================================================`;

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

      <InvoicesTable
        invoices={filteredInvoices}
        onDownloadReceipt={handleDownloadReceipt}
      />
    </div>
  );
}
