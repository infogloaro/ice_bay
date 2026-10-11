"use client";
import { useMemo } from "react";
import type { Bill, Customer, Settings } from "@/lib/types";
import { makeQR } from "@/lib/qr";
import { fmtDate, fmtTime, maskPhone } from "@/lib/util";

export function QRCode({ text, size = 200 }: { text: string; size?: number }) {
  const m = useMemo(() => { try { return makeQR(text); } catch { return null; } }, [text]);
  if (!m) return null;
  const n = m.length, q = 4;
  let d = "";
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + q} ${y + q}h1v1h-1z`; }));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n + q * 2} ${n + q * 2}`} shapeRendering="crispEdges" role="img" aria-label="Payment QR code">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={d} fill="#13284B" />
    </svg>
  );
}

export function upiPayload(s: Settings, amount: number, billNo: string) {
  if (s.upiId.trim()) {
    return `upi://pay?pa=${encodeURIComponent(s.upiId.trim())}&pn=${encodeURIComponent(s.shopName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(billNo)}`;
  }
  // No UPI ID configured: a demo payload that scans but cannot move money.
  return `ICEBAY-DEMO|BILL:${billNo}|AMOUNT:INR ${amount.toFixed(2)}|Set a UPI ID in Settings > Payments for live QR`;
}

const methodName = (b: Bill, s: Settings) =>
  b.method === "cash" ? "Cash" : b.method === "upi" ? "UPI" : b.method === "card" ? "Card" : b.methodLabel || s.otherMethodName;

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Receipt({ bill, settings: s, customer, cashier, width }: { bill: Bill; settings: Settings; customer?: Customer; cashier?: string; width?: "58" | "80" }) {
  const w = width ?? s.receiptWidth;
  const half = s.taxRate / 2;
  const cgst = Math.round((bill.tax / 2) * 100) / 100;
  return (
    <div className={`receipt w${w}`}>
      {s.receiptShowLogo && (
        <div className="rc" style={{ marginBottom: 4 }}>
          <svg width="34" height="34" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#000" /><path d="M13 17.5a7 7 0 0 1 14 0" fill="#fff" /><path d="M12 18h16l-8 15-8-15z" fill="#fff" /></svg>
        </div>
      )}
      <div className="rc rbig">{s.shopName}</div>
      <div className="rc">{s.tagline}</div>
      <div className="rc">{s.address}</div>
      <div className="rc">Ph: {s.phone}</div>
      <div className="rc">GSTIN: {s.gstin}</div>
      <div className="rc">FSSAI: {s.fssai}</div>
      <div className="rdash" />
      <div className="rc rname">TAX INVOICE</div>
      <div className="rr"><span>Bill No: {bill.no}</span><span>{fmtDate(bill.date)}</span></div>
      <div className="rr"><span>Cashier: {cashier ?? "—"}</span><span>{fmtTime(bill.date)}</span></div>
      {customer && <div className="rr"><span>Cust: {customer.name.split(" ")[0]}</span><span>{maskPhone(customer.phone)}</span></div>}
      <div className="rdash" />
      <div className="rr rname"><span>Item</span><span>Amount</span></div>
      <div className="rdash" />
      {bill.lines.map((l, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <div className="rname">{l.name}</div>
          <div className="rr"><span>{l.variant}{l.addOns?.length ? " + " + l.addOns.join(", ") : ""} {l.qty} x {money(l.unitPrice)}</span><span>{money(l.qty * l.unitPrice)}</span></div>
        </div>
      ))}
      <div className="rdash" />
      <div className="rr"><span>Subtotal</span><span>{money(bill.subtotal)}</span></div>
      {bill.discounts.map((d) => <div key={d.id} className="rr"><span>{d.label}</span><span>-{money(d.amount)}</span></div>)}
      {s.taxInclusive && <div className="rr"><span>Taxable value</span><span>{money(bill.taxable)}</span></div>}
      <div className="rr"><span>CGST @{half}%</span><span>{money(cgst)}</span></div>
      <div className="rr"><span>SGST @{half}%</span><span>{money(bill.tax - cgst)}</span></div>
      {bill.roundOff !== 0 && <div className="rr"><span>Round off</span><span>{bill.roundOff > 0 ? "" : "-"}{money(Math.abs(bill.roundOff))}</span></div>}
      <div className="rdash" />
      <div className="rr rbig"><span>TOTAL</span><span>₹{money(bill.total)}</span></div>
      <div className="rdash" />
      <div className="rr"><span>Paid by</span><span>{methodName(bill, s)}</span></div>
      {bill.method === "cash" && bill.cashReceived !== undefined && (
        <>
          <div className="rr"><span>Cash received</span><span>{money(bill.cashReceived)}</span></div>
          <div className="rr"><span>Change</span><span>{money(bill.change ?? 0)}</span></div>
        </>
      )}
      {bill.ref && <div className="rr"><span>Txn ref</span><span>{bill.ref}</span></div>}
      {customer && (bill.pointsEarned > 0 || bill.pointsRedeemed > 0) && (
        <>
          <div className="rdash" />
          {bill.pointsRedeemed > 0 && <div className="rr"><span>Points redeemed</span><span>{bill.pointsRedeemed}</span></div>}
          <div className="rr"><span>Points earned</span><span>+{bill.pointsEarned}</span></div>
          <div className="rr"><span>Points balance</span><span>{customer.points}</span></div>
        </>
      )}
      {bill.status !== "paid" && <div className="rc rbig" style={{ marginTop: 6 }}>*** {bill.status.toUpperCase()} ***</div>}
      <div className="rdash" />
      <div className="rc">HSN {s.hsn} • Items: {bill.lines.reduce((a, l) => a + l.qty, 0)}</div>
      <div className="rc rname" style={{ marginTop: 4 }}>{s.receiptHeader}</div>
      <div className="rc">{s.receiptFooter}</div>
    </div>
  );
}
