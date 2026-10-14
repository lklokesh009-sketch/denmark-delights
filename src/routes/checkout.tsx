import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Utensils, Bike, CreditCard, Landmark, Banknote, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCart, inr } from "@/lib/cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — DENMARK RESTAURANT" },
      { name: "description", content: "Choose dine in or delivery and your payment option to place your order." },
      { property: "og:title", content: "Checkout — DENMARK RESTAURANT" },
      { property: "og:description", content: "Complete your order at Denmark Restaurant." },
    ],
  }),
  component: Checkout,
});

const payments = [
  { v: "credit_card", l: "Credit Card", i: CreditCard },
  { v: "debit_card", l: "Debit Card", i: CreditCard },
  { v: "net_banking", l: "Net Banking", i: Landmark },
  { v: "upi", l: "UPI", i: Smartphone },
  { v: "cash", l: "Cash on Delivery / Counter", i: Banknote },
] as const;

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-center gap-3 rounded-lg border p-4 text-left transition", active ? "border-primary bg-primary/10 text-primary" : "bg-card hover:border-primary/50")}>
      {children}
    </button>
  );
}

function Checkout() {
  const { lines, total, clear } = useCart();
  const [type, setType] = useState<"dine_in" | "delivery" | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", phone: "", address: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <CheckCircle2 className="mx-auto size-16 text-primary" />
          <h1 className="mt-4 text-4xl">Order #{done} placed!</h1>
          <p className="mt-2 text-muted-foreground">The restaurant has been notified. We'll call you if needed.</p>
          <Button asChild className="mt-6"><Link to="/">Back to menu</Link></Button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!type) return toast.error("Choose Dine In or Delivery");
    if (!f.name.trim() || !f.phone.trim()) return toast.error("Enter your name and phone");
    if (type === "delivery" && !f.address.trim()) return toast.error("Enter delivery address");
    if (!pay) return toast.error("Choose a payment option");
    setBusy(true);
    const { data, error } = await supabase.rpc("place_order", {
      _customer_name: f.name, _phone: f.phone, _address: f.address, _order_type: type,
      _payment_method: pay, _notes: f.notes, _items: lines.map((l) => ({ id: l.id, qty: l.qty })),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    clear();
    setDone(data as number);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Back to menu</Link>
      <h1 className="mt-2 text-4xl text-ember-gradient">Checkout</h1>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-xl">Your order</h2>
        {lines.length === 0 ? <p className="text-muted-foreground">Cart is empty.</p> : lines.map((l) => (
          <div key={l.id} className="flex justify-between py-1 text-sm"><span>{l.qty} × {l.name}</span><span>{inr(l.price * l.qty)}</span></div>
        ))}
        <div className="mt-3 flex justify-between border-t pt-3 text-lg font-semibold"><span>Total</span><span className="text-primary">{inr(total)}</span></div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xl">1. Dine In or Delivery?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice active={type === "dine_in"} onClick={() => setType("dine_in")}><Utensils /> <span className="text-lg font-semibold">DINE IN</span></Choice>
          <Choice active={type === "delivery"} onClick={() => setType("delivery")}><Bike /> <span className="text-lg font-semibold">DELIVERY</span></Choice>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <h2 className="text-xl sm:col-span-2">2. Your details</h2>
        <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        {type === "delivery" && <div className="sm:col-span-2"><Label>Delivery address</Label><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>}
        <div className="sm:col-span-2"><Label>Notes (optional)</Label><Input placeholder={type === "dine_in" ? "Table no. / number of guests" : "Spice level, landmark…"} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xl">3. Payment</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {payments.map((p) => <Choice key={p.v} active={pay === p.v} onClick={() => setPay(p.v)}><p.i className="size-5" /> {p.l}</Choice>)}
        </div>
      </section>

      <Button size="lg" className="mt-8 w-full shadow-glow" disabled={busy || !lines.length} onClick={submit}>
        {busy ? "Placing order…" : `Place order · ${inr(total)}`}
      </Button>
    </div>
  );
}
