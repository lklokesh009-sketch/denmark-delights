import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartLine = { id: string; name: string; price: number; qty: number };

type Ctx = {
  lines: CartLine[];
  add: (item: { id: string; name: string; price: number }) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<Ctx | null>(null);

export function cartTotal(lines: CartLine[]) {
  return lines.reduce((s, l) => s + l.price * l.qty, 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    try {
      const s = localStorage.getItem("denmark-cart");
      if (s) setLines(JSON.parse(s));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("denmark-cart", JSON.stringify(lines));
  }, [lines]);

  const add: Ctx["add"] = (item) =>
    setLines((ls) => {
      const f = ls.find((l) => l.id === item.id);
      if (f) return ls.map((l) => (l.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { ...item, qty: 1 }];
    });
  const setQty: Ctx["setQty"] = (id, qty) =>
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, qty } : l))));

  return (
    <CartContext.Provider
      value={{ lines, add, setQty, clear: () => setLines([]), total: cartTotal(lines), count: lines.reduce((s, l) => s + l.qty, 0) }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart outside provider");
  return c;
}

export const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
