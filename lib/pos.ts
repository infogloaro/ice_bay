import type { Bill, CartLine, DB, PayMethod } from "./types";
import type { Totals } from "./calc";
import { addAudit, getDB, setDB } from "./store";
import { allBills, nextBillNo } from "./history";
import { uid } from "./util";

export function finalizeBill(a: {
  lines: CartLine[]; totals: Totals; customerId?: string; method: PayMethod; methodLabel?: string;
  ref?: string; cashReceived?: number; change?: number;
}): Bill {
  let bill!: Bill;
  setDB((d) => {
    const n = nextBillNo(d);
    const staffId = d.session.staffId ?? "system";
    const t = a.totals;
    const discounts = [...t.discounts];
    if (t.pointsValue > 0) discounts.push({ id: "loyalty", label: `Loyalty (${t.pointsUsed} pts)`, amount: t.pointsValue });
    bill = {
      id: uid("b-"), no: "IB-" + n, date: new Date().toISOString(),
      lines: a.lines.map((l) => ({ productId: l.productId, categoryId: l.categoryId, name: l.name, variant: l.variant, addOns: l.addOns.map((x) => x.name), qty: l.qty, unitPrice: l.unitPrice })),
      subtotal: t.subtotal, discounts, discount: t.discount, taxable: t.taxable, tax: t.tax, roundOff: t.roundOff, total: t.total,
      method: a.method, methodLabel: a.methodLabel, ref: a.ref, customerId: a.customerId, cashierId: staffId,
      pointsEarned: a.customerId ? t.earn : 0, pointsRedeemed: a.customerId ? t.pointsUsed : 0, status: "paid",
      cashReceived: a.cashReceived, change: a.change,
    };
    d.bills.push(bill);
    d.billSeq = n + 1;
    for (const l of a.lines) {
      const p = d.products.find((x) => x.id === l.productId);
      if (p) p.stock = Math.max(0, p.stock - l.qty);
      d.stockMoves.unshift({ id: uid("m-"), productId: l.productId, type: "sale", qty: -l.qty, note: bill.no, date: bill.date, by: staffId });
    }
    if (d.stockMoves.length > 1500) d.stockMoves.length = 1500;
    for (const x of t.discounts) {
      const o = d.offers.find((o) => o.id === x.id);
      if (o) o.used += 1;
    }
    if (a.customerId) {
      const c = d.customers.find((c) => c.id === a.customerId);
      if (c) {
        c.points = Math.max(0, c.points - t.pointsUsed + t.earn);
        c.visits += 1; c.spent += t.total; c.lastVisit = bill.date;
      }
    }
    addAudit(d, "Bill paid", `${bill.no} · ₹${bill.total} · ${a.method.toUpperCase()}`);
  });
  return bill;
}

export function refundBill(billId: string, kind: "refunded" | "void", reason: string) {
  setDB((d) => {
    const b = allBills(d).find((x) => x.id === billId);
    d.billStatus[billId] = kind;
    if (b) {
      // Restock items and reverse loyalty for bills made in this demo.
      for (const l of b.lines) {
        const p = d.products.find((x) => x.id === l.productId);
        if (p) p.stock += l.qty;
        d.stockMoves.unshift({ id: uid("m-"), productId: l.productId, type: "refund", qty: l.qty, note: b.no, date: new Date().toISOString(), by: d.session.staffId ?? "system" });
      }
      const c = d.customers.find((c) => c.id === b.customerId);
      if (c) { c.points = Math.max(0, c.points - b.pointsEarned + b.pointsRedeemed); c.spent = Math.max(0, c.spent - b.total); }
    }
    addAudit(d, kind === "void" ? "Bill voided" : "Bill refunded", `${b?.no ?? billId} · ${reason}`);
  });
}

export function cashSalesSince(d: DB, staffId: string, since: string) {
  return d.bills
    .filter((b) => b.cashierId === staffId && b.date >= since && b.method === "cash")
    .reduce((s, b) => s + (d.billStatus[b.id] ? 0 : b.total), 0);
}

export const peekDB = getDB;
