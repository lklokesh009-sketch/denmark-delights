import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Minus, ShoppingBag, Flame, MapPin, Phone, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCart, inr } from "@/lib/cart";
import { menuQuery, infoQuery } from "@/lib/data";
import hero from "@/assets/hero.jpg";
import chinese from "@/assets/chinese.jpg";
import biryani from "@/assets/biryani.jpg";
import heroVideo from "@/assets/hero.mp4.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DENMARK RESTAURANT — Chinese & Arabian Non-Veg, Tamil Nadu" },
      { name: "description", content: "Order authentic Chinese and Arabian non-vegetarian dishes online from Denmark Restaurant, Tamil Nadu. Dine in or delivery." },
      { property: "og:title", content: "DENMARK RESTAURANT" },
      { property: "og:description", content: "Authentic Chinese & Arabian non-veg cuisine in Tamil Nadu. Order online." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(menuQuery), context.queryClient.ensureQueryData(infoQuery)]),
  component: Index,
});

function CartButton() {
  const { lines, setQty, total, count } = useCart();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="gap-2 shadow-glow">
          <ShoppingBag className="size-4" /> Cart ({count}) · {inr(total)}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Your order</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {lines.length === 0 && <p className="text-muted-foreground">Your cart is empty.</p>}
          {lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 border-b pb-3">
              <div>
                <p className="font-medium">{l.name}</p>
                <p className="text-sm text-muted-foreground">{inr(l.price)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="secondary" onClick={() => setQty(l.id, l.qty - 1)}><Minus className="size-3" /></Button>
                <span className="w-6 text-center">{l.qty}</span>
                <Button size="icon" variant="secondary" onClick={() => setQty(l.id, l.qty + 1)}><Plus className="size-3" /></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t p-4">
          <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{inr(total)}</span></div>
          <Button asChild className="w-full" disabled={!lines.length}>
            {lines.length ? <Link to="/checkout">Proceed to checkout</Link> : <span>Proceed to checkout</span>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Index() {
  const { data: menu } = useSuspenseQuery(menuQuery);
  const { data: info } = useSuspenseQuery(infoQuery);
  const { add, lines } = useCart();
  const [q, setQ] = useState("");
  const items = menu.filter((m) => m.available && m.name.toLowerCase().includes(q.toLowerCase()));
  const cats = useMemo(() => Array.from(new Set(menu.map((m) => m.category))), [menu]);
  const qtyOf = (id: string) => lines.find((l) => l.id === id)?.qty ?? 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-display text-xl tracking-widest text-ember-gradient">DENMARK</span>
          <CartButton />
        </div>
      </header>

      <section className="relative flex min-h-[85vh] items-center overflow-hidden">
        <video className="absolute inset-0 size-full object-cover" src={heroVideo.url} poster={hero} autoPlay muted loop playsInline />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-scrim/60 to-scrim/30" />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-scrim/50 px-4 py-1 text-sm text-primary">
            <Flame className="size-4" /> Authentic Chinese & Arabian · Non-Veg
          </p>
          <h1 className="font-display text-5xl leading-tight tracking-[0.15em] text-ember-gradient drop-shadow md:text-8xl">{info.name}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-foreground/90">{info.tagline} — the flavours of the Gulf and the wok, served in the heart of {info.address}.</p>
          <Button size="lg" asChild className="mt-8 shadow-glow"><a href="#menu">Order now</a></Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
        {[{ img: chinese, t: "Fire of the Wok", d: "Dragon chicken, Szechuan noodles, chilli prawns." }, { img: hero, t: "Arabian Grills & Mandi", d: "Al Faham, shawarma, mutton mandi, kabsa." }, { img: biryani, t: "Tamil Nadu Soul", d: "Ambur & Dindigul biryani, Chettinad specials." }].map((c) => (
          <div key={c.t} className="tilt-card overflow-hidden rounded-xl border bg-card">
            <img src={c.img} alt={c.t} loading="lazy" width={1024} height={768} className="h-52 w-full object-cover" />
            <div className="p-5"><h3 className="text-2xl text-primary">{c.t}</h3><p className="mt-1 text-sm text-muted-foreground">{c.d}</p></div>
          </div>
        ))}
      </section>

      <section id="menu" className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div><h2 className="text-4xl md:text-5xl">Our Menu</h2><p className="text-muted-foreground">{menu.length} dishes · tap Add to order</p></div>
          <Input placeholder="Search dishes…" value={q} onChange={(e) => setQ(e.target.value)} className="md:w-72" />
        </div>
        <nav className="mb-8 flex flex-wrap gap-2">
          {cats.map((c) => <a key={c} href={`#cat-${c}`} className="rounded-full border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-primary">{c}</a>)}
        </nav>
        {cats.map((c) => {
          const list = items.filter((i) => i.category === c);
          if (!list.length) return null;
          return (
            <div key={c} id={`cat-${c}`} className="mb-12 scroll-mt-20">
              <h3 className="mb-4 border-b pb-2 text-2xl text-primary">{c}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition hover:border-primary/60">
                    <div>
                      <p className="font-medium">{i.name}</p>
                      {i.description && <p className="text-xs text-muted-foreground">{i.description}</p>}
                      <p className="text-primary">{inr(Number(i.price))}</p>
                    </div>
                    <Button size="sm" variant={qtyOf(i.id) ? "default" : "secondary"} onClick={() => add({ id: i.id, name: i.name, price: Number(i.price) })}>
                      <Plus className="size-4" /> Add{qtyOf(i.id) ? ` (${qtyOf(i.id)})` : ""}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <footer className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 text-sm text-muted-foreground md:grid-cols-3">
          <p className="flex items-center gap-2"><MapPin className="size-4 text-primary" />{info.address}</p>
          <p className="flex items-center gap-2"><Phone className="size-4 text-primary" />{info.phone}</p>
          <p className="flex items-center gap-2"><Clock className="size-4 text-primary" />{info.hours}</p>
        </div>
      </footer>
    </div>
  );
}
