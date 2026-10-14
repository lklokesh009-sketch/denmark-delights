import { describe, it, expect } from "vitest";
import { cartTotal } from "@/lib/cart";

describe("cart total", () => {
  it("sums price × quantity", () => {
    expect(cartTotal([{ id: "a", name: "Al Faham Full", price: 520, qty: 2 }, { id: "b", name: "Kubbus", price: 20, qty: 3 }])).toBe(1100);
  });
});
