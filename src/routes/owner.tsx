import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { inr } from "@/lib/cart";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type Item = Database["public"]["Tables"]["menu_items"]["Row"];

export const Route = createFileRoute("/owner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Owner Panel — DENMARK RESTAURANT" },
      { name: "description", content: "Restaurant owner dashboard for orders, menu and settings." },
      { property: "og:title", content: "Owner Panel — DENMARK RESTAURANT" },
      { property: "og:description", content: "Owner-only area." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Owner,
});

function Owner() {
  const [session, setSession] = useState<Session | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return setIsOwner(null);
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }).then(({ data }) => setIsOwner(!!data));
  }, [session]);

  if (!session) return <Login />;
  if (isOwner === null) return <p className="p-10">Loading…</p>;
  if (!isOwner)
    return (
      <div className="p-10">
        <p>This account is not the restaurant owner.</p>
        <Button className="mt-4" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl text-ember-gradient">Owner Panel</h1>
        <div className="flex gap-2">
          <Button variant="secondary" asChild><Link to="/">View site</Link></Button>
          <Button variant="secondary" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </div>
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="bank">Bank details</TabsTrigger>
          <TabsTrigger value="info">Restaurant info</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><Orders /></TabsContent>
        <TabsContent value="menu"><MenuEditor /></TabsContent>
        <TabsContent value="bank"><Bank /></TabsContent>
        <TabsContent value="info"><Info /></TabsContent>
      </Tabs>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const go = async () => {
    const r = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/owner` } });
    if (r.error) return toast.error(r.error.message);
    if (mode === "up" && !r.data.session) toast.success("Check your email to confirm the account.");
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <h1 className="text-2xl">Owner {mode === "in" ? "sign in" : "registration"}</h1>
        <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full" onClick={go}>{mode === "in" ? "Sign in" : "Create owner account"}</Button>
        <button className="text-sm text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "First time? Create the owner account" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

const statuses = ["new", "preparing", "ready", "completed", "cancelled"];

function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const load = () => supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => setOrders(data ?? []));
  useEffect(() => {
    load();
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    const ch = supabase
      .channel("orders-owner")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        const o = p.new as Order;
        toast.success(`New order #${o.order_number} — ${o.customer_name} (${o.order_type === "dine_in" ? "Dine in" : "Delivery"})`);
        try {
          const ctx = new AudioContext(); const osc = ctx.createOscillator(); osc.connect(ctx.destination); osc.frequency.value = 880; osc.start(); osc.stop(ctx.currentTime + 0.4);
        } catch {}
        if ("Notification" in window && Notification.permission === "granted") new Notification("New order!", { body: `#${o.order_number} · ${inr(Number(o.total))}` });
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  return (
    <div className="mt-4 space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Bell className="size-4 text-primary" /> Keep this page open — new orders ring and pop up instantly.</p>
      {orders.length === 0 && <p className="text-muted-foreground">No orders yet.</p>}
      {orders.map((o) => (
        <div key={o.id} className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">#{o.order_number} · {o.customer_name} · {o.phone}</p>
            <span className="rounded-full bg-primary/15 px-3 py-0.5 text-xs uppercase text-primary">{o.order_type === "dine_in" ? "Dine in" : "Delivery"} · {o.payment_method.replace("_", " ")}</span>
          </div>
          {o.address && <p className="text-sm text-muted-foreground">📍 {o.address}</p>}
          {o.notes && <p className="text-sm text-muted-foreground">📝 {o.notes}</p>}
          <ul className="mt-2 text-sm">
            {(o.items as { name: string; qty: number; price: number }[]).map((i, k) => <li key={k}>{i.qty} × {i.name} — {inr(i.price * i.qty)}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-primary">{inr(Number(o.total))} · {new Date(o.created_at).toLocaleString()}</span>
            <div className="flex flex-wrap gap-1">
              {statuses.map((s) => <Button key={s} size="sm" variant={o.status === s ? "default" : "secondary"} onClick={() => setStatus(o.id, s)}>{s}</Button>)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuEditor() {
  const [items, setItems] = useState<Item[]>([]);
  const [n, setN] = useState({ name: "", category: "", price: "" });
  const load = () => supabase.from("menu_items").select("*").order("sort_order").then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);
  const save = async (id: string, patch: Partial<Item>) => {
    const { error } = await supabase.from("menu_items").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Saved"); load(); }
  };
  const addItem = async () => {
    if (!n.name || !n.category || !n.price) return toast.error("Fill all fields");
    const { error } = await supabase.from("menu_items").insert({ name: n.name, category: n.category, price: Number(n.price), sort_order: items.length + 1 });
    if (error) toast.error(error.message); else { setN({ name: "", category: "", price: "" }); load(); }
  };
  const del = async (id: string) => {
    if (!confirm("Delete this dish?")) return;
    await supabase.from("menu_items").delete().eq("id", id); load();
  };
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-2 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <Input placeholder="Dish name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <Input placeholder="Category" value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })} />
        <Input placeholder="Price ₹" type="number" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} />
        <Button onClick={addItem}>Add dish</Button>
      </div>
      {items.map((i) => <MenuRow key={i.id} item={i} onSave={save} onDelete={del} />)}
    </div>
  );
}

function MenuRow({ item, onSave, onDelete }: { item: Item; onSave: (id: string, p: Partial<Item>) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [price, setPrice] = useState(String(item.price));
  return (
    <div className="grid items-center gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[2fr_1.5fr_1fr_auto_auto_auto]">
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <Input value={category} onChange={(e) => setCategory(e.target.value)} />
      <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      <label className="flex items-center gap-2 text-xs"><Switch checked={item.available} onCheckedChange={(v) => onSave(item.id, { available: v })} /> Available</label>
      <Button size="sm" onClick={() => onSave(item.id, { name, category, price: Number(price) })}>Save</Button>
      <Button size="icon" variant="destructive" onClick={() => onDelete(item.id)}><Trash2 className="size-4" /></Button>
    </div>
  );
}

function Bank() {
  const [b, setB] = useState({ account_holder: "", bank_name: "", account_number: "", ifsc: "", upi_id: "" });
  useEffect(() => {
    supabase.from("owner_payment_details").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) setB({ account_holder: data.account_holder ?? "", bank_name: data.bank_name ?? "", account_number: data.account_number ?? "", ifsc: data.ifsc ?? "", upi_id: data.upi_id ?? "" });
    });
  }, []);
  const save = async () => {
    const { error } = await supabase.from("owner_payment_details").update({ ...b, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Bank details saved (private — never shown to customers)");
  };
  const fields: [keyof typeof b, string][] = [["account_holder", "Account holder"], ["bank_name", "Bank name"], ["account_number", "Account number"], ["ifsc", "IFSC"], ["upi_id", "UPI ID"]];
  return (
    <div className="mt-4 max-w-lg space-y-3 rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">Only you can see and edit these details.</p>
      {fields.map(([k, l]) => <div key={k}><Label>{l}</Label><Input value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} /></div>)}
      <Button onClick={save}>Save</Button>
    </div>
  );
}

function Info() {
  const [i, setI] = useState({ name: "", tagline: "", address: "", phone: "", hours: "" });
  useEffect(() => {
    supabase.from("restaurant_info").select("*").eq("id", 1).single().then(({ data }) => data && setI({ name: data.name, tagline: data.tagline, address: data.address, phone: data.phone, hours: data.hours }));
  }, []);
  const save = async () => {
    const { error } = await supabase.from("restaurant_info").update(i).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Saved");
  };
  return (
    <div className="mt-4 max-w-lg space-y-3 rounded-lg border bg-card p-5">
      {(Object.keys(i) as (keyof typeof i)[]).map((k) => <div key={k}><Label className="capitalize">{k}</Label><Input value={i[k]} onChange={(e) => setI({ ...i, [k]: e.target.value })} /></div>)}
      <Button onClick={save}>Save</Button>
    </div>
  );
}
