"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { MethodsList } from "@/components/portal/payment-methods/methods-list";
import { AddCardModal } from "@/components/portal/payment-methods/add-card-modal";
import { loadPortalState, savePortalState, type PaymentMethod } from "@/lib/mock-data";
import { Plus, Shield } from "lucide-react";

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
        isDefault: state.paymentMethods.length === 0,
      };

      const updatedMethods = [...state.paymentMethods, newMethod];

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
    const updatedMethods = state.paymentMethods.map((pm) => ({
      ...pm,
      isDefault: pm.id === pmId,
    }));

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
    if (!methodToDelete || methodToDelete.isDefault) return;

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
      <MethodsList
        paymentMethods={state.paymentMethods}
        defaultMethodId={subscription.paymentMethodId}
        onSetDefault={handleSetDefault}
        onDeleteMethod={handleDeleteMethod}
      />

      {/* Trust Badge */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0c0c0e]/30 p-4 flex gap-3 text-xs text-zinc-500 dark:text-zinc-400 leading-normal font-semibold">
        <Shield className="size-5 text-zinc-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-zinc-700 dark:text-zinc-300">PCI-DSS Compliant Infrastructure</p>
          <p className="mt-0.5 text-zinc-550 dark:text-zinc-450">
            Railswitch tokenizes cards securely via the Nomba Tokenization API. Raw card details are processed directly on Nomba's PCI-compliant vaults and are never sent to or stored on our servers.
          </p>
        </div>
      </div>

      {/* Add Card Modal */}
      <AddCardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        cardName={cardName}
        onCardNameChange={setCardName}
        cardNumber={cardNumber}
        onCardNumberChange={handleCardNumberChange}
        cardExpiry={cardExpiry}
        onExpiryChange={handleExpiryChange}
        cardCvv={cardCvv}
        onCvvChange={setCardCvv}
        tokenizing={tokenizing}
        success={success}
        onSubmit={handleTokenizeCard}
      />
    </div>
  );
}
