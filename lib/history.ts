import type { Bill, BillLine, DB, PayMethod } from "./types";
import { products as seedProducts } from "./data";
import { addDays, mulberry32, round2, startOfDay, ymd } from "./util";

const HOUR_W = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 5, 5, 6, 8, 10, 12, 12, 10, 6, 0];
const POP: Record<string, number> = {
  "p-mango": 10, "p-watermelon": 9, "p-rasamalai": 8, "p-mojito": 7, "p-green-mango": 7, "p-pink-guava": 6,
  "p-orange": 6, "p-butterscotch": 6, "p-blueberry": 5, "p-pineapple": 5, "p-grape": 4, "p-mint": 4,
  "p-raspberry": 4, "p-pomegranate": 3, "p-rose-water": 3, "b-assorted6": 3, "d-water": 4, "b-fruit12": 1.5,
};
const DAYS = 45;

function pick<T>(r: () => number, arr: T[], w: (x: T) => number) {
  const total = arr.reduce((s, x) => s + w(x), 0);
  let t = r() * total;
  for (const x of arr) { t -= w(x); if (t <= 0) return x; }
  return arr[arr.length - 1];
}

let cacheKey = "";
let cache: Bill[] = [];

/** Deterministic sales history for the last 45 days, up to "now", so dashboards look lived-in. */
export function historyBills(now = new Date()): Bill[] {
  const key = ymd(now) + "-" + now.getHours();
  if (key === cacheKey) return cache;
  const sellable = seedProducts.filter((p) => p.categoryId !== "toppings");
  const out: Bill[] = [];
  let no = 21001;
  const today = startOfDay(now);
  for (let d = DAYS - 1; d >= 0; d--) {
    const day = addDays(today, -d);
    const seed = Number(ymd(day).replace(/-/g, ""));
    const r = mulberry32(seed);
    const dow = day.getDay();
    const weekend = dow === 0 || dow === 6;
    const trend = 1 + (DAYS - d) / DAYS * 0.18;
    const count = Math.round((weekend ? 58 + r() * 14 : 34 + r() * 12) * trend);
    const stamps: number[] = [];
    for (let i = 0; i < count; i++) {
      const h = pick(r, HOUR_W.map((_, i) => i), (i) => HOUR_W[i]);
      stamps.push(new Date(day).setHours(h, Math.floor(r() * 60), Math.floor(r() * 60)));
    }
    stamps.sort((a, b) => a - b);
    for (const ts of stamps) {
      const nLines = pick(r, [1, 2, 3, 4], (n) => [5, 4, 2, 1][n - 1]);
      const lines: BillLine[] = [];
      for (let i = 0; i < nLines; i++) {
        const p = pick(r, sellable, (x) => POP[x.id] ?? 1.5);
        const v = r() < 0.7 ? p.variants[0] : p.variants[Math.floor(r() * p.variants.length)];
        const ex = lines.find((l) => l.productId === p.id && l.variant === v.name);
        if (ex) { ex.qty++; continue; }
        lines.push({ productId: p.id, categoryId: p.categoryId, name: p.name, variant: v.name, qty: r() < 0.55 ? 1 : r() < 0.85 ? 2 : 3, unitPrice: v.price });
      }
      const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      const discounts: Bill["discounts"] = [];
      const mock = lines.filter((l) => l.categoryId === "mocktail").reduce((s, l) => s + l.qty * l.unitPrice, 0);
      if (mock && d < 10) discounts.push({ id: "o-mock", label: "Mocktail Hour", amount: round2(mock * 0.1) });
      const gm = lines.filter((l) => l.productId === "p-green-mango" && l.variant === "Single").reduce((s, l) => s + l.qty, 0);
      if (gm >= 2 && d < 20) discounts.push({ id: "o-bogo", label: "Buy 1 Get 1", amount: Math.floor(gm / 2) * 60 });
      if (subtotal > 400 && r() < 0.12 && d < 5) discounts.push({ id: "o-flat50", label: "FLAT50", amount: 50 });
      if (subtotal > 500 && r() < 0.1 && d < 3) discounts.push({ id: "o-diwali", label: "Diwali Delight", amount: round2(subtotal * 0.15) });
      const discount = Math.min(subtotal, round2(discounts.reduce((s, x) => s + x.amount, 0)));
      const taxable = round2(subtotal - discount);
      const tax = round2(taxable * 0.05);
      const total = Math.round(taxable + tax);
      const method: PayMethod = pick(r, ["upi", "cash", "card", "other"] as PayMethod[], (m) => ({ upi: 58, cash: 24, card: 16, other: 2 }[m]));
      const hasCust = r() < 0.42;
      const cashier = pick(r, ["s-karthik", "s-divya", "s-priya"], (s) => (s === "s-priya" ? 1 : 2));
      const roll = r();
      out.push({
        id: "h-" + no, no: "IB-" + no, date: new Date(ts).toISOString(), lines, subtotal, discounts, discount,
        taxable, tax, roundOff: round2(total - (taxable + tax)), total, method,
        ref: method === "upi" ? "UPI" + String(Math.floor(r() * 1e12)).padStart(12, "0") : method === "card" ? "AUTH" + Math.floor(100000 + r() * 899999) : undefined,
        customerId: hasCust ? "cu-" + (1 + Math.floor(r() * 30)) : undefined,
        cashierId: cashier, pointsEarned: hasCust ? Math.floor(total / 10) : 0, pointsRedeemed: 0,
        status: roll < 0.008 ? "refunded" : roll < 0.012 ? "void" : "paid", demo: true,
      });
      no++;
    }
  }
  const nowMs = now.getTime();
  cache = out.filter((b) => new Date(b.date).getTime() <= nowMs);
  cacheKey = key;
  return cache;
}

let mergeKey: unknown[] = [];
let merged: Bill[] = [];

/** History + bills created in this demo, with refund/void overrides applied. Newest first. */
export function allBills(db: DB, now = new Date()): Bill[] {
  const hist = historyBills(now);
  if (mergeKey[0] === hist && mergeKey[1] === db.bills && mergeKey[2] === db.billStatus) return merged;
  const all = [...hist, ...db.bills].map((b) => (db.billStatus[b.id] ? { ...b, status: db.billStatus[b.id] } : b));
  all.sort((a, b) => (a.date < b.date ? 1 : -1));
  mergeKey = [hist, db.bills, db.billStatus];
  merged = all;
  return all;
}

export function nextBillNo(db: DB) {
  const hist = historyBills();
  const histMax = hist.length ? Number(hist[hist.length - 1].no.slice(3)) : 0;
  return Math.max(db.billSeq, histMax + 1);
}
