"use client";
import { useEffect, useMemo, useState } from "react";
import type { Bill, Settings } from "@/lib/types";
import { Icon } from "./Icon";
import { Receipt } from "./Receipt";
import { Empty, toast } from "./ui";
import { staffName, useDB } from "@/lib/store";
import { allBills } from "@/lib/history";
import { byMethod, inRange, METHOD_LABEL, summarize, topProducts } from "@/lib/stats";
import { addDays, cx, fmtDate, fmtTime, inr, inr2, num, round2, startOfDay, ymd } from "@/lib/util";

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Thermal (58/80 mm) day-end summary, sized for the iMin built-in printer. */
function DayReceipt({ day, bills, settings: s, printedBy }: { day: Date; bills: Bill[]; settings: Settings; printedBy: string }) {
  const S = summarize(bills);
  const methods = byMethod(bills);
  const items = topProducts(bills);
  const half = s.taxRate / 2;
  return (
    <div className={`receipt w${s.receiptWidth}`}>
      <div className="rc rbig">{s.shopName}</div>
      <div className="rc">{s.address}</div>
      <div className="rc">GSTIN: {s.gstin}</div>
      <div className="rdash" />
      <div className="rc rname">DAILY SALES REPORT</div>
      <div className="rr"><span>Date</span><span>{fmtDate(day.toISOString())}</span></div>
      <div className="rr"><span>Printed</span><span>{fmtTime(new Date().toISOString())}</span></div>
      <div className="rr"><span>By</span><span>{printedBy}</span></div>
      <div className="rdash" />
      <div className="rr"><span>Paid bills</span><span>{S.count}</span></div>
      <div className="rr"><span>Items sold</span><span>{S.items}</span></div>
      <div className="rr"><span>Gross sales</span><span>{money(S.gross)}</span></div>
      <div className="rr"><span>Discounts</span><span>-{money(S.discounts)}</span></div>
      <div className="rr"><span>Refunds ({S.refundCount})</span><span>-{money(S.refunds)}</span></div>
      <div className="rr"><span>Net sales</span><span>{money(S.net)}</span></div>
      <div className="rr"><span>CGST @{half}%</span><span>{money(round2(S.tax / 2))}</span></div>
      <div className="rr"><span>SGST @{half}%</span><span>{money(round2(S.tax - round2(S.tax / 2)))}</span></div>
      <div className="rdash" />
      <div className="rr rbig"><span>COLLECTED</span><span>₹{money(S.collected)}</span></div>
      <div className="rdash" />
      <div className="rname">Payment modes</div>
      {methods.map((m) => <div key={m.method} className="rr"><span>{METHOD_LABEL[m.method]} ({m.count})</span><span>{money(m.amount)}</span></div>)}
      <div className="rdash" />
      <div className="rr rname"><span>Item</span><span>Qty / Amt</span></div>
      {items.map((p) => <div key={p.id} className="rr"><span>{p.name}</span><span>{p.qty} / {money(p.revenue)}</span></div>)}
      {S.voids > 0 && <><div className="rdash" /><div className="rr"><span>Voided bills</span><span>{S.voids}</span></div></>}
      <div className="rdash" />
      <div className="rc">*** End of report ***</div>
    </div>
  );
}

export function DailySales({ cashierName }: { cashierName: string }) {
  const db = useDB();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [q, setQ] = useState("");
  const [printing, setPrinting] = useState<"report" | Bill | null>(null);

  const from = day, to = new Date(addDays(day, 1).getTime() - 1);
  const isToday = ymd(day) === ymd(new Date());
  const bills = useMemo(() => inRange(allBills(db), from, to), [db, from.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const S = summarize(bills);
  const methods = byMethod(bills);
  const items = topProducts(bills);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? bills.filter((b) => b.no.toLowerCase().includes(s) || b.lines.some((l) => l.name.toLowerCase().includes(s))) : bills;
  }, [bills, q]);
  const custName = (id?: string) => db.customers.find((c) => c.id === id)?.name ?? "";

  // Render the print view first, then open the print dialog (iMin: built-in printer is the default Android print target).
  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => { window.print(); setPrinting(null); }, 80);
    return () => clearTimeout(t);
  }, [printing]);

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const half = db.settings.taxRate / 2;
    const summary = [
      [`${db.settings.shopName} — Daily sales`, fmtDate(day.toISOString())],
      [],
      ["Paid bills", S.count], ["Items sold", S.items], ["Gross sales", S.gross], ["Discounts", S.discounts],
      ["Refunds", S.refunds], ["Net sales", S.net], [`CGST ${half}%`, round2(S.tax / 2)], [`SGST ${half}%`, round2(S.tax - round2(S.tax / 2))],
      ["Total collected", S.collected], ["Average bill", round2(S.aov)], ["Voided bills", S.voids],
      [],
      ["Payment mode", "Bills", "Amount"], ...methods.map((m) => [METHOD_LABEL[m.method], m.count, m.amount]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summary); ws1["!cols"] = [{ wch: 26 }, { wch: 16 }, { wch: 14 }];
    const ws2 = XLSX.utils.aoa_to_sheet([["Product", "Qty", "Amount"], ...items.map((p) => [p.name, p.qty, p.revenue]), ["Total", items.reduce((s, p) => s + p.qty, 0), items.reduce((s, p) => s + p.revenue, 0)]]);
    ws2["!cols"] = [{ wch: 28 }, { wch: 8 }, { wch: 12 }];
    const ws3 = XLSX.utils.aoa_to_sheet([
      ["Bill no", "Time", "Items", "Customer", "Subtotal", "Discount", "GST", "Round off", "Total", "Payment", "Txn ref", "Cashier", "Status"],
      ...[...bills].reverse().map((b) => [b.no, fmtTime(b.date), b.lines.map((l) => `${l.qty}x ${l.name} (${l.variant})`).join(", "), custName(b.customerId), b.subtotal, b.discount, b.tax, b.roundOff, b.total, METHOD_LABEL[b.method], b.ref ?? "", staffName(db, b.cashierId), b.status]),
    ]);
    ws3["!cols"] = [{ wch: 10 }, { wch: 9 }, { wch: 48 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 9 }, { wch: 10 }, { wch: 9 }, { wch: 18 }, { wch: 20 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");
    XLSX.utils.book_append_sheet(wb, ws2, "Item-wise");
    XLSX.utils.book_append_sheet(wb, ws3, "Bills");
    XLSX.writeFile(wb, `icebay-daily-sales-${ymd(day)}.xlsx`);
    toast("Excel downloaded");
  };

  return (
    <div className="ds">
      <div className="row between wrap g12">
        <div>
          <div className="h2">Daily sales</div>
          <div className="xs muted">{day.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}{isToday ? " · live" : ""}</div>
        </div>
        <div className="row g8 wrap">
          <div className="row g4">
            <button className="btn btn-outline btn-icon" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day"><Icon name="chevronLeft" size={16} /></button>
            <input className="input" type="date" style={{ width: 160 }} value={ymd(day)} max={ymd(new Date())} onChange={(e) => e.target.value && setDay(startOfDay(new Date(e.target.value + "T00:00:00")))} aria-label="Sales date" />
            <button className="btn btn-outline btn-icon" onClick={() => setDay(addDays(day, 1))} disabled={isToday} aria-label="Next day"><Icon name="chevronRight" size={16} /></button>
            {!isToday && <button className="btn btn-ghost btn-sm" onClick={() => setDay(startOfDay(new Date()))}>Today</button>}
          </div>
          <button className="btn btn-outline" onClick={exportExcel} disabled={!bills.length}><Icon name="download" size={16} />Export Excel</button>
          <button className="btn btn-primary" onClick={() => setPrinting("report")} disabled={!bills.length}><Icon name="printer" size={16} />Print report (iMin)</button>
        </div>
      </div>

      <div className="ds-kpis">
        <div className="ds-kpi hl"><div className="small semi muted">Total collected</div><div className="v num">{inr(S.collected)}</div><div className="xs muted">{num(S.count)} paid bills</div></div>
        <div className="ds-kpi"><div className="small semi ink2">Items sold</div><div className="v num">{num(S.items)}</div><div className="xs muted">Avg bill {inr(S.aov)}</div></div>
        <div className="ds-kpi"><div className="small semi ink2">Gross sales</div><div className="v num">{inr(S.gross)}</div><div className="xs muted">Before discounts & GST</div></div>
        <div className="ds-kpi"><div className="small semi ink2">Discounts</div><div className="v num ok">−{inr(S.discounts)}</div><div className="xs muted">Offers, coupons, points</div></div>
        <div className="ds-kpi"><div className="small semi ink2">GST</div><div className="v num">{inr(S.tax)}</div><div className="xs muted">CGST + SGST</div></div>
        <div className="ds-kpi"><div className="small semi ink2">Refunds / voids</div><div className="v num">{S.refundCount} / {S.voids}</div><div className="xs muted">{inr(S.refunds)} refunded</div></div>
      </div>

      <div className="ds-pay">
        {methods.map((m) => (
          <div key={m.method} className="card row g12" style={{ padding: "12px 14px" }}>
            <span className="kpi" style={{ padding: 0 }}><span className="ic"><Icon name={m.method === "cash" ? "cash" : m.method === "upi" ? "qr" : m.method === "card" ? "card" : "gift"} size={17} /></span></span>
            <div className="grow"><div className="small semi">{METHOD_LABEL[m.method]}</div><div className="xs muted">{m.count} bills</div></div>
            <b className="num">{inr(m.amount)}</b>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr)", gap: 16 }} className="customize">
        <div className="card table-wrap">
          <div className="card-head"><b>Item-wise sales</b><span className="xs muted">{items.length} products</span></div>
          <table className="table">
            <thead><tr><th>Product</th><th className="r">Qty</th><th className="r">Amount</th></tr></thead>
            <tbody>{items.map((p) => <tr key={p.id}><td className="semi">{p.name}</td><td className="r num">{p.qty}</td><td className="r num semi">{inr(p.revenue)}</td></tr>)}</tbody>
          </table>
          {!items.length && <Empty icon="box" title="Nothing sold" />}
        </div>
        <div className="card table-wrap">
          <div className="card-head">
            <b>Bills</b>
            <div className="search" style={{ width: 240 }}><Icon name="search" size={16} /><input className="input" style={{ height: 34 }} placeholder="Bill no or item" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </div>
          <table className="table">
            <thead><tr><th>Bill</th><th>Time</th><th>Items</th><th>Pay</th><th className="r">Total</th><th className="r">Receipt</th></tr></thead>
            <tbody>{shown.map((b) => (
              <tr key={b.id}>
                <td className="semi num nowrap">{b.no}{b.status !== "paid" && <span className="badge b-err" style={{ marginLeft: 6 }}>{b.status}</span>}</td>
                <td className="ink2 nowrap">{fmtTime(b.date)}</td>
                <td className="ink2"><span className="ellipsis" style={{ display: "block", maxWidth: 260 }}>{b.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</span></td>
                <td><span className="badge b-out">{METHOD_LABEL[b.method]}</span></td>
                <td className="r num semi">{inr2(b.total)}</td>
                <td className="r"><button className="btn btn-outline btn-sm" onClick={() => setPrinting(b)}><Icon name="printer" size={14} />Print</button></td>
              </tr>
            ))}</tbody>
          </table>
          {!shown.length && <Empty icon="receipt" title={bills.length ? "No bills match" : "No bills on this day"} />}
        </div>
      </div>

      {printing && (
        <div className="print-only">
          {printing === "report"
            ? <DayReceipt day={day} bills={bills} settings={db.settings} printedBy={cashierName} />
            : <Receipt bill={printing} settings={db.settings} customer={db.customers.find((c) => c.id === printing.customerId)} cashier={staffName(db, printing.cashierId)} />}
        </div>
      )}
    </div>
  );
}
