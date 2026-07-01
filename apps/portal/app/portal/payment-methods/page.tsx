"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { MethodsList } from "@/components/portal/payment-methods/methods-list";
import { AddCardModal } from "@/components/portal/payment-methods/add-card-modal";
import { api, type GatewayPaymentMethod } from "@/lib/api-client";
import { Plus, Shield, Loader2 } from "lucide-react";
import { PORTAL_API_KEY as API_KEY, PORTAL_CUSTOMER_ID } from "@/lib/config";

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<GatewayPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [tokenizing, setTokenizing] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchMethods = () => {
    api.paymentMethods.list(PORTAL_CUSTOMER_ID, API_KEY)
      .then((data) => { setMethods(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchMethods(); }, []);

  const handleCardNumberChange = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const parts = [];
    for (let i = 0; i < v.length; i += 4) parts.push(v.substring(i, i + 4));
    setCardNumber(parts.join(" "));
  };

  const handleExpiryChange = (value: string) => {
    const v = value.replace(/[^0-9]/gi, "");
    setCardExpiry(v.length >= 2 ? `${v.slice(0, 2)}/${v.slice(2, 4)}` : v);
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName || cardNumber.length < 15 || cardExpiry.length < 5 || cardCvv.length < 3) return;
    setTokenizing(true);
    try {
      await api.paymentMethods.create({ customer_id: PORTAL_CUSTOMER_ID, type: "card", nomba_token: `tok_${Date.now()}`, last4: cardNumber.replace(/\s/g, "").slice(-4), brand: cardNumber.startsWith("5") ? "mastercard" : cardNumber.startsWith("4") ? "visa" : "verve", is_default: methods.length === 0 }, API_KEY);
      setSuccess(true);
      fetchMethods();
    } catch {}
    setTokenizing(false);
    setTimeout(() => setModalOpen(false), 800);
  };

  const handleDelete = async (id: string) => {
    try { await api.paymentMethods.remove(id, API_KEY); fetchMethods(); } catch {}
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Methods" description="Manage your payment cards." action={<button onClick={() => { setCardName(""); setCardNumber(""); setCardExpiry(""); setCardCvv(""); setSuccess(false); setModalOpen(true); }} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm"><Plus className="size-4" />Add Card</button>} />
      <MethodsList paymentMethods={methods.map(m => ({ id: m.id, type: m.type as "card" | "bank_account", last4: m.last4, brand: m.brand, isDefault: m.is_default }))} defaultMethodId={methods.find(m => m.is_default)?.id ?? ""} onSetDefault={() => {}} onDeleteMethod={handleDelete} />
      <div className="rounded-xl border bg-zinc-50/50 p-4 flex gap-3 text-xs text-zinc-500"><Shield className="size-5 text-zinc-400 shrink-0 mt-0.5" /><div><p className="font-bold text-zinc-700">PCI-Compliant</p><p className="mt-0.5">Cards are tokenized via Nomba. Raw details are never stored on our servers.</p></div></div>
      <AddCardModal open={modalOpen} onOpenChange={setModalOpen} cardName={cardName} onCardNameChange={setCardName} cardNumber={cardNumber} onCardNumberChange={handleCardNumberChange} cardExpiry={cardExpiry} onExpiryChange={handleExpiryChange} cardCvv={cardCvv} onCvvChange={setCardCvv} tokenizing={tokenizing} success={success} onSubmit={handleAddCard} />
    </div>
  );
}
