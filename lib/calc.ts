import type { AppliedDiscount, CartLine, Customer, Offer, Settings } from "./types";
import { round2, ymd } from "./util";

export interface Totals {
  itemCount: number;
  subtotal: number;
  discounts: AppliedDiscount[];   // offers + coupon
  offerDiscount: number;
  pointsValue: number;            // loyalty redemption in ₹
  pointsUsed: number;
  discount: number;               // offerDiscount + pointsValue
  taxable: number;
  cgst: number; sgst: number; tax: number;
  roundOff: number;
  total: number;
  earn: number;
  couponError?: string;
  couponApplied?: string;
  maxRedeemBlocks: number;
}

export function offerLive(o: Offer, now = new Date()) {
  const t = ymd(now);
  return o.active && t >= o.start && t <= o.end && (o.usageLimit === 0 || o.used < o.usageLimit);
}

export function offerStatus(o: Offer, now = new Date()): "Live" | "Scheduled" | "Expired" | "Paused" | "Limit reached" {
  const t = ymd(now);
  if (!o.active) return "Paused";
  if (t < o.start) return "Scheduled";
  if (t > o.end) return "Expired";
  if (o.usageLimit && o.used >= o.usageLimit) return "Limit reached";
  return "Live";
}

const scoped = (o: Offer) => o.productIds.length > 0 || o.categoryIds.length > 0;
const eligible = (o: Offer, l: CartLine) =>
  !scoped(o) || o.productIds.includes(l.productId) || o.categoryIds.includes(l.categoryId);

export function offerAmount(o: Offer, lines: CartLine[], subtotal: number): number {
  if (subtotal < o.minOrder) return 0;
  const el = lines.filter((l) => eligible(o, l));
  const base = el.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  switch (o.type) {
    case "percent":
      return round2((base * o.value) / 100);
    case "fixed":
      return el.length ? Math.min(o.value, base) : 0;
    case "bogo": {
      const units: number[] = [];
      el.forEach((l) => { for (let i = 0; i < l.qty; i++) units.push(l.unitPrice); });
      units.sort((a, b) => b - a);
      const free = Math.floor(units.length / 2);
      return units.slice(units.length - free).reduce((s, x) => s + x, 0);
    }
    case "combo": {
      if (!o.productIds.length) return 0;
      const counts = o.productIds.map((id) => lines.filter((l) => l.productId === id).reduce((s, l) => s + l.qty, 0));
      return Math.min(...counts) * o.value;
    }
  }
  return 0;
}

export function describeOffer(o: Offer) {
  switch (o.type) {
    case "percent": return `${o.value}% off`;
    case "fixed": return `₹${o.value} off`;
    case "bogo": return "Buy 1 Get 1";
    case "combo": return `₹${o.value} off combo`;
  }
}

export function computeTotals(
  lines: CartLine[],
  ctx: { offers: Offer[]; settings: Settings; coupon?: string; redeemBlocks?: number; customer?: Customer | null },
  now = new Date(),
): Totals {
  const { offers, settings } = ctx;
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));

  const candidates: { o: Offer; amt: number }[] = [];
  for (const o of offers) {
    if (!o.autoApply || !offerLive(o, now)) continue;
    const amt = offerAmount(o, lines, subtotal);
    if (amt > 0) candidates.push({ o, amt });
  }

  let couponError: string | undefined;
  let couponApplied: string | undefined;
  const code = ctx.coupon?.trim().toUpperCase();
  if (code) {
    const o = offers.find((x) => x.code?.toUpperCase() === code);
    if (!o) couponError = "Coupon code not found";
    else if (!offerLive(o, now)) couponError = offerStatus(o, now) === "Limit reached" ? "Coupon usage limit reached" : "Coupon is not active";
    else if (subtotal < o.minOrder) couponError = `Add ₹${Math.ceil(o.minOrder - subtotal)} more to use ${o.code}`;
    else {
      const amt = offerAmount(o, lines, subtotal);
      if (amt <= 0) couponError = "No eligible items for this coupon";
      else { candidates.push({ o, amt }); couponApplied = o.code; }
    }
  }

  // Stacking rule: all stackable offers apply; among non-stackable, only the best one.
  const stack = candidates.filter((c) => c.o.stackable);
  const best = candidates.filter((c) => !c.o.stackable).sort((a, b) => b.amt - a.amt)[0];
  const chosen = best ? [...stack, best] : stack;
  if (best && couponApplied && best.o.code !== couponApplied) {
    couponError = "A better non-stackable offer is already applied";
    couponApplied = undefined;
  }

  let offerDiscount = 0;
  const discounts: AppliedDiscount[] = [];
  for (const c of chosen) {
    const amt = Math.min(c.amt, subtotal - offerDiscount);
    if (amt <= 0) continue;
    offerDiscount = round2(offerDiscount + amt);
    discounts.push({ id: c.o.id, label: c.o.name.split(" — ")[0], amount: round2(amt) });
  }

  const L = settings.loyalty;
  const afterOffers = subtotal - offerDiscount;
  let maxRedeemBlocks = 0;
  if (L.enabled && ctx.customer && afterOffers >= L.minBill) {
    maxRedeemBlocks = Math.min(Math.floor(ctx.customer.points / L.redeemPoints), Math.floor(afterOffers / L.redeemValue));
  }
  const blocks = Math.min(ctx.redeemBlocks ?? 0, maxRedeemBlocks);
  const pointsValue = blocks * L.redeemValue;
  const pointsUsed = blocks * L.redeemPoints;

  const net = round2(afterOffers - pointsValue);
  const r = settings.taxRate / 100;
  let taxable: number, tax: number, gross: number;
  if (settings.taxInclusive) {
    taxable = round2(net / (1 + r)); tax = round2(net - taxable); gross = net;
  } else {
    taxable = net; tax = round2(net * r); gross = net + tax;
  }
  const total = settings.roundToRupee ? Math.round(gross) : round2(gross);
  const roundOff = round2(total - gross);
  const cgst = round2(tax / 2);
  const earn = L.enabled && ctx.customer ? Math.floor(total / L.spendPerPoint) : 0;

  return {
    itemCount, subtotal, discounts, offerDiscount, pointsValue, pointsUsed,
    discount: round2(offerDiscount + pointsValue), taxable, cgst, sgst: round2(tax - cgst), tax,
    roundOff, total, earn, couponError, couponApplied, maxRedeemBlocks,
  };
}
