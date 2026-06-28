"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Shield, Loader2, X, Check } from "lucide-react";
import React from "react";

interface AddCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  onCardNameChange: (val: string) => void;
  cardNumber: string;
  onCardNumberChange: (val: string) => void;
  cardExpiry: string;
  onExpiryChange: (val: string) => void;
  cardCvv: string;
  onCvvChange: (val: string) => void;
  tokenizing: boolean;
  success: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function AddCardModal({
  open,
  onOpenChange,
  cardName,
  onCardNameChange,
  cardNumber,
  onCardNumberChange,
  cardExpiry,
  onExpiryChange,
  cardCvv,
  onCvvChange,
  tokenizing,
  success,
  onSubmit,
}: AddCardModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!tokenizing} className="p-0 overflow-hidden">
        {/* Widget Banner Header */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-emerald-500 animate-pulse" />
            <span className="text-xs font-black tracking-widest uppercase">Nomba Checkout Widget</span>
          </div>
          {!tokenizing && (
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Tokenizer Form */}
        <form onSubmit={onSubmit} className="p-6 space-y-4">
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
                <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-heading">Secure Card Intake</h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
                  Input your card parameters to securely request a billing token.
                </p>
              </div>

              {/* Inputs */}
              <div className="space-y-1.5">
                <Label htmlFor="card-name-input">Cardholder Name</Label>
                <Input
                  id="card-name-input"
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={cardName}
                  onChange={(e) => onCardNameChange(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="card-number-input">Card Number</Label>
                <Input
                  id="card-number-input"
                  type="text"
                  required
                  maxLength={19}
                  placeholder="4000 1234 5678 9010"
                  value={cardNumber}
                  onChange={(e) => onCardNumberChange(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="card-expiry-input">Expiry (MM/YY)</Label>
                  <Input
                    id="card-expiry-input"
                    type="text"
                    required
                    maxLength={5}
                    placeholder="12/28"
                    value={cardExpiry}
                    onChange={(e) => onExpiryChange(e.target.value)}
                    className="font-mono text-center"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="card-cvv-input">CVV</Label>
                  <Input
                    id="card-cvv-input"
                    type="password"
                    required
                    maxLength={4}
                    placeholder="•••"
                    value={cardCvv}
                    onChange={(e) => onCvvChange(e.target.value.replace(/[^0-9]/g, ""))}
                    className="font-mono text-center"
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
      </DialogContent>
    </Dialog>
  );
}
