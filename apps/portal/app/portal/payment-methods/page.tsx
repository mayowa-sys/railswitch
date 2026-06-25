"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { loadPortalState, savePortalState, type PaymentMethod } from "@/lib/mock-data";
import {
  CreditCard,
  Plus,
  Trash2,
  Check,
  Shield,
  Loader2,
  Lock,
  X
} from "lucide-react";

export default function PaymentMethodsPage() {
  const [state, setState] = useState(loadPortalState());
  const [modalOpen, setModalOpen] = useState(false);
  
  // Card tokenizer form states
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [tokenizing, setTokenizing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      setState(loadPortalState());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const subscription = state.subscription;

  // Format Card Number inline
  const handleCardNumberChange = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      setCardNumber(parts.join(" "));
    } else {
      setCardNumber(v);
    }
  };

  // Format Expiry inline
  const handleExpiryChange = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      setCardExpiry(`${v.slice(0, 2)}/${v.slice(2, 4)}`);
    } else {
      setCardExpiry(v);
    }
  };

  const handleOpenModal = () => {
    setCardName("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setSuccess(false);
    setModalOpen(true);
  };

  // Simulate Nomba secure checkout card tokenization
  const handleTokenizeCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName || cardNumber.length < 15 || cardExpiry.length < 5 || cardCvv.length < 3) return;

    setTokenizing(true);
    
    // Simulate multi-stage secure encryption handshake
    setTimeout(() => {
      const last4 = cardNumber.replace(/\s/g, "").slice(-4);
      
      const newMethod: PaymentMethod = {
        id: `pm_${Date.now()}`,
        type: "card",
        last4,
        brand: cardNumber.startsWith("5") ? "Mastercard" : cardNumber.startsWith("4") ? "Visa" : "Verve",
        isDefault: state.paymentMethods.length === 0, // default if no others exist
      };

      const updatedMethods = [...state.paymentMethods, newMethod];

      // Save to localStorage
      savePortalState({
        paymentMethods: updatedMethods
      });

      setState((s) => ({
        ...s,
        paymentMethods: updatedMethods
      }));

      setTokenizing(false);
      setSuccess(true);

      setTimeout(() => {
        setModalOpen(false);
      }, 800);
    }, 1200);
  };

  const handleSetDefault = (pmId: string) => {
    // 1. Update Payment Method default flags
    const updatedMethods = state.paymentMethods.map((pm) => ({
      ...pm,
      isDefault: pm.id === pmId,
    }));

    // 2. Update default payment reference in active subscription
    const updatedSub = {
      ...subscription,
      paymentMethodId: pmId,
    };

    savePortalState({
      paymentMethods: updatedMethods,
      subscription: updatedSub,
    });

    setState((s) => ({
      ...s,
      paymentMethods: updatedMethods,
      subscription: updatedSub,
    }));
  };

  const handleDeleteMethod = (pmId: string) => {
    const methodToDelete = state.paymentMethods.find((m) => m.id === pmId);
    if (!methodToDelete || methodToDelete.isDefault) return; // cannot delete default

    const updatedMethods = state.paymentMethods.filter((pm) => pm.id !== pmId);
    savePortalState({ paymentMethods: updatedMethods });
    setState((s) => ({ ...s, paymentMethods: updatedMethods }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Methods"
        description="Configure your tokenized payment cards and fallback bank accounts."
        action={
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm shadow-indigo-500/20 transition-all"
          >
            <Plus className="size-4" />
            Add Card
          </button>
        }
      />

      {/* Methods list */}
      <div className="grid gap-4 md:grid-cols-2">
        {state.paymentMethods.map((method) => {
          const isDefault = method.id === subscription.paymentMethodId || method.isDefault;
          return (
            <div
              key={method.id}
              className={`rounded-xl border p-5 bg-white dark:bg-[#121215] flex flex-col justify-between shadow-sm relative ${
                isDefault
                  ? "border-indigo-600 dark:border-indigo-500 ring-1 ring-indigo-600 dark:ring-indigo-500"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {method.type === "card"
                        ? `${method.brand} ending in ${method.last4}`
                        : `${method.bankName} Account •••• ${method.last4}`}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {method.type === "card" ? "Tokenized Card Rail" : "Bank Transfer Gateway"}
                    </p>
                  </div>
                </div>
                {isDefault && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30">
                    <Check className="size-2.5" />
                    Default
                  </span>
                )}
              </div>

              <div className="mt-6 pt-3 border-t border-zinc-100 dark:border-zinc-850 flex justify-between items-center text-xs">
                {!isDefault ? (
                  <button
                    onClick={() => handleSetDefault(method.id)}
                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-bold transition-all"
                  >
                    Set as default
                  </button>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-semibold italic">
                    Primary payment source
                  </span>
                )}

                {!isDefault && (
                  <button
                    onClick={() => handleDeleteMethod(method.id)}
                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                    title="Remove method"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust Badge */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0c0c0e]/30 p-4 flex gap-3 text-xs text-zinc-500 dark:text-zinc-400 leading-normal font-semibold">
        <Shield className="size-5 text-zinc-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-zinc-700 dark:text-zinc-300">PCI-DSS Compliant Infrastructure</p>
          <p className="mt-0.5">
            Railswitch tokenizes cards securely via the Nomba Tokenization API. Raw card details are processed directly on Nomba's PCI-compliant vaults and are never sent to or stored on our servers.
          </p>
        </div>
      </div>

      {/* ─── Add Card Modal (Nomba checkoutTokenizer scaffold) ─────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Widget Banner Header */}
            <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-emerald-500 animate-pulse" />
                <span className="text-xs font-black tracking-widest uppercase">Nomba Checkout Widget</span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                disabled={tokenizing}
                className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Tokenizer Form */}
            <form onSubmit={handleTokenizeCard} className="p-6 space-y-4">
              {success ? (
                <div className="flex flex-col items-center justify-center text-center py-6">
                  <div className="size-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                    <Check className="size-6 animate-bounce" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Card Tokenized Successfully</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Your secure payment token has been generated and linked.
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-center pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
                    <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">Secure Card Intake</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Input your card parameters to securely request a billing token.
                    </p>
                  </div>

                  {/* Inputs */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-xs font-semibold outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Card Number</label>
                    <input
                      type="text"
                      required
                      maxLength={19}
                      placeholder="4000 1234 5678 9010"
                      value={cardNumber}
                      onChange={(e) => handleCardNumberChange(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-xs font-semibold font-mono outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        placeholder="12/28"
                        value={cardExpiry}
                        onChange={(e) => handleExpiryChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-xs font-semibold font-mono text-center outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">CVV</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="•••"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-xs font-semibold font-mono text-center outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold">
                      <Shield className="size-3 text-emerald-500" /> Secure SSL Handshake
                    </div>
                    <button
                      type="submit"
                      disabled={tokenizing || !cardName || cardNumber.length < 15}
                      className="h-9 px-5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      {tokenizing ? (
                        <><Loader2 className="size-3.5 animate-spin" /> Tokenizing Card...</>
                      ) : (
                        "Generate Token"
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
