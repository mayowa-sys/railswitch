"use client";

import { useState } from "react";
import { Check, Zap, Shield, Landmark, CreditCard, ArrowRight, Loader2, AlertCircle, Dumbbell, Heart, Users, Clock, Building } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const FITCORE_API_KEY = "sk_test_mer_HfDzRi_p6G___5GjJ2qsjwpi1eRVU0Hw-2GvTEc";

const PLANS = [
  { id: "starter", name: "Basic", price: "₦9,900", amountKobo: 990000, features: ["Access to 1 location", "Open gym floor", "Locker room access", "1 group class/week", "Mobile app check-in"], color: "from-emerald-500 to-teal-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: "Dumbbell" },
  { id: "growth", name: "Pro", price: "₦29,900", amountKobo: 2990000, features: ["All locations access", "Unlimited group classes", "Personal trainer (2/mo)", "Pool & sauna", "Guest passes (2/mo)", "Priority booking"], color: "from-blue-500 to-indigo-600", bg: "bg-blue-50", border: "border-blue-200", icon: "Heart", popular: true },
  { id: "business", name: "Elite", price: "₦79,900", amountKobo: 7990000, features: ["Everything in Pro", "Unlimited personal training", "Nutrition planning", "Recovery lounge", "Exclusive events", "Locker reservation", "24/7 access"], color: "from-violet-500 to-purple-600", bg: "bg-violet-50", border: "border-violet-200", icon: "Zap" },
  { id: "enterprise", name: "Corporate", price: "₦249,000", amountKobo: 24900000, features: ["Up to 20 employees", "Dedicated account manager", "Custom wellness programs", "On-site classes", "Health analytics", "Priority support", "Annual health fair"], color: "from-amber-500 to-orange-600", bg: "bg-amber-50", border: "border-amber-200", icon: "Users" },
];

const ICON_MAP: Record<string, React.ElementType> = { Dumbbell, Heart, Zap, Users };

const TEST_CARDS = [
  { label: "Success Card", number: "5060 6666 6666 6666 666", key: "success" },
  { label: "Decline Card", number: "5060 6666 6666 6666 674", key: "insufficient" },
];

// Real Nomba VA details — this would be dynamically generated in production
const VA_DETAILS = { accountNumber: "7038059983", bankName: "Nombank MFB" };

export default function StorefrontPage() {
  const [step, setStep] = useState<"plans" | "payment" | "processing" | "success" | "va_fallback">("plans");
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[0] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentRef, setPaymentRef] = useState("");

  const resetForm = () => { setName(""); setEmail(""); setPhone(""); setCardNumber(""); setCardExpiry(""); setCardCvv(""); setError(""); };

  const handleSelectPlan = (plan: (typeof PLANS)[0]) => { setSelectedPlan(plan); resetForm(); setStep("payment"); };

  const handleCardNumberChange = (v: string) => {
    const cleaned = v.replace(/\s/g, "").replace(/[^0-9]/g, "");
    const parts = [];
    for (let i = 0; i < cleaned.length && i < 16; i += 4) parts.push(cleaned.substring(i, i + 4));
    setCardNumber(parts.join(" "));
  };

  const handleExpiryChange = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, "");
    setCardExpiry(cleaned.length >= 2 ? cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4) : cleaned);
  };

  const fillTestCard = (card: (typeof TEST_CARDS)[0]) => {
    setName("Chioma Okafor");
    setEmail("chioma.okafor@email.com");
    setPhone("0803 412 5567");
    setCardNumber(card.number);
    setCardExpiry("12/28");
    setCardCvv("123");
  };

  const handleSubmitPayment = async () => {
    if (!selectedPlan || !email || !name || cardNumber.replace(/\s/g, "").length < 15) {
      setError("Please fill in all fields with a valid card number.");
      return;
    }
    setLoading(true); setError("");

    const ref = "FTCORE-" + Date.now().toString(36).toUpperCase();
    setPaymentRef(ref);

    // Check if this is the decline card
    const isDeclined = cardNumber.includes("674");

    if (isDeclined) {
      // Card declined — don't create subscription yet. Show VA.
      await new Promise((r) => setTimeout(r, 1500)); // Simulate processing
      setStep("va_fallback");
    } else {
      // Card approved — create the actual subscription via RailSwitch
      try {
        const key = FITCORE_API_KEY;

        const planRes = await fetch(API + "/v1/plans", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ name: selectedPlan.name, description: "FitCore " + selectedPlan.name + " Membership", amount: selectedPlan.amountKobo, currency: "NGN", interval: "monthly", interval_count: 1 }),
        });
        const planData = await planRes.json();
        const planId = planData.data?.id;
        if (!planId) throw new Error("Plan setup failed");

        const custRes = await fetch(API + "/v1/customers", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ name, email, phone }),
        });
        const custData = await custRes.json();
        const customerId = custData.data?.id;
        if (!customerId) throw new Error("Profile setup failed");

        const last4 = cardNumber.replace(/\s/g, "").slice(-4);
        const brand = cardNumber.startsWith("5") ? "mastercard" : cardNumber.startsWith("4") ? "visa" : "verve";
        await fetch(API + "/v1/payment-methods", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ customer_id: customerId, type: "card", nomba_token: "tok_fc_" + Date.now(), last4, brand, is_default: true }),
        });

        const subRes = await fetch(API + "/v1/subscriptions", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ customer_id: customerId, plan_id: planId, start_date: new Date().toISOString() }),
        });
        const subData = await subRes.json();
        const subId = subData.data?.id;
        if (!subId) throw new Error("Membership setup failed");

        setPaymentRef(subId);
        setStep("success");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    }
    setLoading(false);
  };

  const PlanIcon = ({ icon }: { icon: string }) => { const I = ICON_MAP[icon] || Dumbbell; return <I className="size-5 text-white" />; };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-zinc-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20"><Dumbbell className="size-5 text-white" /></div>
            <div><span className="text-lg font-extrabold tracking-tight text-zinc-900">FitCore</span><span className="text-xs text-zinc-400 ml-2 font-medium">Nigeria</span></div>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-zinc-600">
            <span className="hover:text-zinc-900 cursor-pointer transition-colors">Locations</span>
            <span className="hover:text-zinc-900 cursor-pointer transition-colors">Classes</span>
            <span className="hover:text-zinc-900 cursor-pointer transition-colors">About</span>
            <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">Powered by RailSwitch</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6">
        {/* ========== PLANS PAGE ========== */}
        {step === "plans" && (
          <>
            <div className="text-center py-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-6"><Zap className="size-3" /> Nigeria&apos;s Fastest-Growing Fitness Chain</div>
              <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900 mb-4 leading-tight">Your fitness journey,<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">on your terms.</span></h1>
              <p className="text-lg text-zinc-500 max-w-xl mx-auto">Premium gym memberships with flexible billing. Card payment not working? Pay via bank transfer — we&apos;ll keep your membership active.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto mb-16">
              {[
                { icon: Building, label: "12 Locations", sub: "Lagos, Abuja, PH" },
                { icon: Clock, label: "24/7 Access", sub: "Keycard entry" },
                { icon: Shield, label: "Secure Billing", sub: "PCI-compliant" },
                { icon: Landmark, label: "Multiple Payment Options", sub: "Card or bank transfer" },
              ].map((b) => (
                <div key={b.label} className="text-center p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                  <b.icon className="size-5 text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-800">{b.label}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{b.sub}</p>
                </div>
              ))}
            </div>

            <h2 className="text-2xl font-bold text-center mb-2">Choose Your Membership</h2>
            <p className="text-center text-zinc-500 mb-8 text-sm">All plans include a 7-day free trial. Cancel anytime.</p>

            <div className="grid gap-6 md:grid-cols-4 max-w-5xl mx-auto pb-20">
              {PLANS.map((plan) => (
                <div key={plan.id} className={"relative rounded-2xl border " + plan.border + " " + plan.bg + " p-6 flex flex-col gap-4 transition-all hover:shadow-lg " + (plan.popular ? "ring-2 ring-blue-500/30 shadow-md" : "")}>
                  {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-lg">Most Popular</span>}
                  <div className={"size-10 rounded-xl bg-gradient-to-r " + plan.color + " flex items-center justify-center"}><PlanIcon icon={plan.icon} /></div>
                  <h3 className="text-lg font-bold text-zinc-900">{plan.name}</h3>
                  <p className={"text-3xl font-extrabold bg-gradient-to-r " + plan.color + " bg-clip-text text-transparent"}>{plan.price}<span className="text-sm font-normal text-zinc-400">/mo</span></p>
                  <ul className="space-y-2 flex-1">{plan.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-zinc-600"><Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />{f}</li>)}</ul>
                  <button onClick={() => handleSelectPlan(plan)} className={"w-full py-2.5 rounded-xl bg-gradient-to-r " + plan.color + " text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-md"}>Get Started</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ========== PAYMENT PAGE ========== */}
        {step === "payment" && selectedPlan && (
          <div className="max-w-lg mx-auto py-12">
            <button onClick={() => setStep("plans")} className="text-sm text-zinc-500 hover:text-zinc-700 mb-6 flex items-center gap-1"><ArrowRight className="size-3 rotate-180" /> Back to plans</button>

            <div className="rounded-2xl border border-zinc-200 bg-white shadow-xl p-8">
              <div className={"size-12 rounded-xl bg-gradient-to-r " + selectedPlan.color + " flex items-center justify-center mb-4"}><PlanIcon icon={selectedPlan.icon} /></div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-1">{selectedPlan.name} Membership</h2>
              <p className={"text-3xl font-extrabold bg-gradient-to-r " + selectedPlan.color + " bg-clip-text text-transparent mb-6"}>{selectedPlan.price}<span className="text-sm font-normal text-zinc-400">/month · Cancel anytime</span></p>

              {/* Quick-fill test cards */}
              <div className="flex gap-2 mb-6">
                {TEST_CARDS.map((card) => (
                  <button key={card.key} type="button" onClick={() => fillTestCard(card)} className="text-[10px] px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 transition-colors font-medium">
                    {card.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chioma Okafor" className="w-full h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="chioma@email.com" className="w-full h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 block mb-1">Phone</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 412 5567" className="w-full h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-4">
                  <p className="text-xs font-semibold text-zinc-500 mb-3">Payment Details</p>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">Card Number</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                      <input type="text" value={cardNumber} onChange={(e) => handleCardNumberChange(e.target.value)} placeholder="5060 6666 6666 6666 666" maxLength={19} className="w-full h-11 pl-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-400 block mb-1">Expiry</label>
                      <input type="text" value={cardExpiry} onChange={(e) => handleExpiryChange(e.target.value)} placeholder="MM/YY" maxLength={5} className="w-full h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-400 block mb-1">CVV</label>
                      <input type="text" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="123" maxLength={4} className="w-full h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-500 flex items-start gap-2">
                  <Shield className="size-3.5 text-zinc-400 shrink-0 mt-0.5" />
                  Your card details are tokenized securely via Nomba. FitCore never stores your raw card information.
                </div>

                {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2"><AlertCircle className="size-3.5 shrink-0" />{error}</div>}

                <button onClick={handleSubmitPayment} disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {loading ? "Processing payment..." : "Pay " + selectedPlan.price + "/mo — Start 7-Day Free Trial"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== SUCCESS PAGE ========== */}
        {step === "success" && selectedPlan && (
          <div className="max-w-lg mx-auto py-16 text-center">
            <div className="size-20 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-6 shadow-lg"><Check className="size-10 text-emerald-500" /></div>
            <h2 className="text-3xl font-extrabold text-zinc-900 mb-2">Welcome to FitCore!</h2>
            <p className="text-lg text-zinc-500 mb-1">Your {selectedPlan.name} membership is active.</p>
            <p className="text-sm text-zinc-400 mb-8">You&apos;ll be billed {selectedPlan.price}/month starting after your 7-day free trial. Your keycard is ready at any FitCore reception.</p>

            <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 text-left space-y-3">
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Membership</span><span className="font-semibold text-zinc-900">{selectedPlan.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Billing</span><span className="font-semibold text-zinc-900">{selectedPlan.price}/month</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Member</span><span className="font-semibold text-zinc-900">{name || "Chioma Okafor"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">Payment</span><span className="font-semibold text-zinc-900">Card ····{cardNumber.slice(-4) || "6666"}</span></div>
              <div className="pt-3 border-t border-zinc-200">
                <span className="text-xs text-zinc-400">Reference</span>
                <p className="text-xs font-mono text-zinc-500 mt-0.5 break-all">{paymentRef}</p>
              </div>
            </div>
            <button onClick={() => { setStep("plans"); resetForm(); }} className="mt-8 text-sm font-medium text-emerald-600 hover:text-emerald-700">← Back to plans</button>
          </div>
        )}

        {/* ========== VA FALLBACK PAGE ========== */}
        {step === "va_fallback" && selectedPlan && (
          <div className="max-w-lg mx-auto py-12">
            <button onClick={() => setStep("payment")} className="text-sm text-zinc-500 hover:text-zinc-700 mb-6 flex items-center gap-1"><ArrowRight className="size-3 rotate-180" /> Back</button>

            <div className="rounded-2xl border border-zinc-200 bg-white shadow-xl p-8">
              <div className="size-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-5"><Landmark className="size-7 text-amber-600" /></div>
              <h2 className="text-2xl font-extrabold text-zinc-900 mb-2">Card Payment Unsuccessful</h2>
              <p className="text-zinc-500 mb-6 leading-relaxed">Your bank declined the transaction. This is common with Nigerian cards — no worries, you can still join via bank transfer.</p>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 border-dashed mb-6">
                <p className="text-xs text-amber-700 uppercase tracking-wider font-bold mb-4 text-center">Bank Transfer Details</p>
                <div className="text-center space-y-3">
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Account Number</p>
                    <p className="text-4xl font-extrabold font-mono tracking-widest text-amber-800">{VA_DETAILS.accountNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Bank</p>
                    <p className="text-lg font-bold text-amber-800">{VA_DETAILS.bankName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Amount</p>
                    <p className="text-lg font-bold text-amber-800">{selectedPlan.price}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Reference</p>
                    <p className="text-sm font-mono font-bold text-amber-700">{paymentRef}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm text-zinc-600">
                <p className="font-semibold text-zinc-800">How to complete your membership:</p>
                <ol className="list-decimal pl-5 space-y-2 text-zinc-500">
                  <li>Transfer <strong className="text-zinc-700">{selectedPlan.price}</strong> to the account above</li>
                  <li>Use <strong className="text-zinc-700">{paymentRef}</strong> as the payment reference</li>
                  <li>Your {selectedPlan.name} membership activates automatically within 5 minutes of receipt</li>
                  <li>You&apos;ll receive an SMS confirmation at {phone || "your phone number"}</li>
                </ol>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">Need help?</p>
                <p className="text-xs text-emerald-600 mt-1">Call us on <strong>0700-FITCORE</strong> or visit any FitCore reception. This virtual account is valid for 7 days.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-100 py-8 text-center text-xs text-zinc-400 bg-zinc-50">
        <p className="font-semibold text-zinc-500 mb-1">FitCore Nigeria</p>
        <p>12 locations across Lagos, Abuja, and Port Harcourt</p>
        <p className="mt-2">Billing powered by <span className="text-emerald-600 font-semibold">RailSwitch</span> — recurring billing for a country where cards fail.</p>
      </footer>
    </div>
  );
}
