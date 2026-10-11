import type { Bill } from "./types";
import { addDays, fmtDay, round2, startOfDay, ymd } from "./util";

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

export function rangeFor(key: RangeKey, now = new Date(), custom?: { from: string; to: string }) {
  const t = startOfDay(now);
  switch (key) {
    case "today": return { from: t, to: now, label: "Today" };
    case "yesterday": return { from: addDays(t, -1), to: new Date(t.getTime() - 1), label: "Yesterday" };
    case "7d": return { from: addDays(t, -6), to: now, label: "Last 7 days" };
    case "30d": return { from: addDays(t, -29), to: now, label: "Last 30 days" };
    case "month": return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: now, label: "This month" };
    case "custom": {
      const f = custom?.from ? new Date(custom.from + "T00:00:00") : addDays(t, -6);
      const to = custom?.to ? new Date(custom.to + "T23:59:59") : now;
      return { from: f, to, label: `${fmtDay(f)} – ${fmtDay(to)}` };
    }
  }
}

export const inRange = (bills: Bill[], from: Date, to: Date) => {
  const a = from.toISOString(), b = to.toISOString();
  return bills.filter((x) => x.date >= a && x.date <= b);
};

export function summarize(bills: Bill[]) {
  const valid = bills.filter((b) => b.status !== "void");
  const paid = bills.filter((b) => b.status === "paid");
  const refunded = bills.filter((b) => b.status === "refunded");
  const gross = valid.reduce((s, b) => s + b.subtotal, 0);
  const discounts = valid.reduce((s, b) => s + b.discount, 0);
  const refunds = refunded.reduce((s, b) => s + b.taxable, 0);
  const tax = paid.reduce((s, b) => s + b.tax, 0);
  const collected = paid.reduce((s, b) => s + b.total, 0);
  const items = paid.reduce((s, b) => s + b.lines.reduce((a, l) => a + l.qty, 0), 0);
  const customers = new Set(paid.map((b) => b.customerId).filter(Boolean)).size;
  return {
    count: paid.length, voids: bills.filter((b) => b.status === "void").length, refundCount: refunded.length,
    gross: round2(gross), discounts: round2(discounts), refunds: round2(refunds), net: round2(gross - discounts - refunds),
    tax: round2(tax), collected: round2(collected), items, customers, aov: paid.length ? collected / paid.length : 0,
  };
}

export function byHour(bills: Bill[]) {
  const h = new Array(24).fill(0);
  bills.filter((b) => b.status === "paid").forEach((b) => (h[new Date(b.date).getHours()] += b.total));
  return h;
}

export function byDay(bills: Bill[], from: Date, to: Date) {
  const m = new Map<string, { sales: number; bills: number; tax: number; disc: number; cgst: number }>();
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) m.set(ymd(d), { sales: 0, bills: 0, tax: 0, disc: 0, cgst: 0 });
  bills.forEach((b) => {
    const k = ymd(new Date(b.date));
    const e = m.get(k);
    if (!e || b.status !== "paid") return;
    e.sales += b.total; e.bills += 1; e.tax += b.tax; e.disc += b.discount;
  });
  return [...m.entries()].map(([k, v]) => ({ date: k, label: fmtDay(new Date(k + "T00:00:00")), ...v }));
}

export function topProducts(bills: Bill[]) {
  const m = new Map<string, { id: string; name: string; categoryId: string; qty: number; revenue: number }>();
  bills.filter((b) => b.status === "paid").forEach((b) => b.lines.forEach((l) => {
    const e = m.get(l.productId) ?? { id: l.productId, name: l.name, categoryId: l.categoryId, qty: 0, revenue: 0 };
    e.qty += l.qty; e.revenue += l.qty * l.unitPrice;
    m.set(l.productId, e);
  }));
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

export function byCategory(bills: Bill[]) {
  const m = new Map<string, { qty: number; revenue: number }>();
  topProducts(bills).forEach((p) => {
    const e = m.get(p.categoryId) ?? { qty: 0, revenue: 0 };
    e.qty += p.qty; e.revenue += p.revenue;
    m.set(p.categoryId, e);
  });
  return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue);
}

export function byMethod(bills: Bill[]) {
  const keys = ["upi", "cash", "card", "other"] as const;
  const paid = bills.filter((b) => b.status === "paid");
  return keys.map((k) => {
    const list = paid.filter((b) => b.method === k);
    return { method: k, count: list.length, amount: list.reduce((s, b) => s + b.total, 0) };
  });
}

export function byCashier(bills: Bill[]) {
  const m = new Map<string, { id: string; bills: number; sales: number; items: number; refunds: number; voids: number }>();
  bills.forEach((b) => {
    const e = m.get(b.cashierId) ?? { id: b.cashierId, bills: 0, sales: 0, items: 0, refunds: 0, voids: 0 };
    if (b.status === "paid") { e.bills++; e.sales += b.total; e.items += b.lines.reduce((s, l) => s + l.qty, 0); }
    if (b.status === "refunded") e.refunds++;
    if (b.status === "void") e.voids++;
    m.set(b.cashierId, e);
  });
  return [...m.values()].sort((a, b) => b.sales - a.sales);
}

export function byOffer(bills: Bill[]) {
  const m = new Map<string, { id: string; label: string; uses: number; amount: number; revenue: number }>();
  bills.filter((b) => b.status === "paid").forEach((b) => b.discounts.forEach((d) => {
    const e = m.get(d.id) ?? { id: d.id, label: d.label, uses: 0, amount: 0, revenue: 0 };
    e.uses++; e.amount += d.amount; e.revenue += b.total;
    m.set(d.id, e);
  }));
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}

export const METHOD_LABEL: Record<string, string> = { upi: "UPI", cash: "Cash", card: "Card", other: "Gift card" };
export const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : a ? 100 : 0);
