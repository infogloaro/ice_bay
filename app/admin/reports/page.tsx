"use client";
import { useMemo, useState } from "react";
import { Page, RangePicker, SectionCard, useCatName } from "@/components/admin";
import { AreaChart, BarChart, Donut, DONUT_COLORS, Legend } from "@/components/Charts";
import { Icon } from "@/components/Icon";
import { Receipt } from "@/components/Receipt";
import { Empty, Modal, toast } from "@/components/ui";
import { can, staffName, useDB } from "@/lib/store";
import { allBills } from "@/lib/history";
import { refundBill } from "@/lib/pos";
import { byCashier, byCategory, byDay, byHour, byMethod, byOffer, inRange, METHOD_LABEL, rangeFor, summarize, topProducts, type RangeKey } from "@/lib/stats";
import type { Bill } from "@/lib/types";
import { addDays, cx, downloadFile, fmtDateTime, inr, inr2, num, toCSV, ymd } from "@/lib/util";

type Tab = "overview" | "transactions" | "products" | "categories" | "payments" | "discounts" | "refunds" | "tax" | "cashiers";
const TABS: [Tab, string][] = [["overview", "Overview"], ["transactions", "Transactions"], ["products", "Products"], ["categories", "Categories"], ["payments", "Payments"], ["discounts", "Discounts & offers"], ["refunds", "Refunds & voids"], ["tax", "Tax summary"], ["cashiers", "Cashiers"]];

export default function Reports() {
  const db = useDB();
  const catName = useCatName();
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
    return (TABS.find(([k]) => k === t)?.[0] ?? "overview") as Tab;
  });
  const [range, setRange] = useState<RangeKey>("30d");
  const [custom, setCustom] = useState({ from: ymd(addDays(new Date(), -13)), to: ymd(new Date()) });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Bill | null>(null);
  const [reason, setReason] = useState("");

  const r = rangeFor(range, new Date(), custom);
  const all = allBills(db);
  const bills = useMemo(() => inRange(all, r.from, r.to), [all, r.from.getTime(), r.to.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const S = summarize(bills);
  const days = byDay(bills, r.from, r.to);
  const hours = byHour(bills);
  const prods = topProducts(bills);
  const cats = byCategory(bills);
  const methods = byMethod(bills);
  const offers = byOffer(bills);
  const cashiers = byCashier(bills);
  const nonPaid = bills.filter((b) => b.status !== "paid");
  const tx = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? bills.filter((b) => b.no.toLowerCase().includes(s) || b.lines.some((l) => l.name.toLowerCase().includes(s)) || (b.ref ?? "").toLowerCase().includes(s)) : bills;
  }, [bills, q]);
  const half = db.settings.taxRate / 2;
  const fileTag = `${ymd(r.from)}_${ymd(r.to)}`;

  const exportTab = () => {
    let rows: (string | number)[][] = [];
    if (tab === "overview" || tab === "tax") rows = [["Date", "Bills", "Sales (collected)", "Discounts", "Taxable", `CGST ${half}%`, `SGST ${half}%`, "Total GST"], ...days.map((d) => [d.date, d.bills, d.sales.toFixed(2), d.disc.toFixed(2), (d.sales - d.tax).toFixed(2), (d.tax / 2).toFixed(2), (d.tax / 2).toFixed(2), d.tax.toFixed(2)])];
    if (tab === "transactions" || tab === "refunds") rows = [["Bill", "Date", "Status", "Items", "Subtotal", "Discount", "Tax", "Total", "Method", "Ref", "Cashier"], ...(tab === "refunds" ? nonPaid : tx).map((b) => [b.no, fmtDateTime(b.date), b.status, b.lines.reduce((s, l) => s + l.qty, 0), b.subtotal, b.discount, b.tax, b.total, METHOD_LABEL[b.method], b.ref ?? "", staffName(db, b.cashierId)])];
    if (tab === "products") rows = [["Product", "Category", "Qty", "Revenue"], ...prods.map((p) => [p.name, catName(p.categoryId), p.qty, p.revenue])];
    if (tab === "categories") rows = [["Category", "Qty", "Revenue"], ...cats.map((c) => [catName(c.id), c.qty, c.revenue])];
    if (tab === "payments") rows = [["Method", "Bills", "Amount"], ...methods.map((m) => [METHOD_LABEL[m.method], m.count, m.amount])];
    if (tab === "discounts") rows = [["Offer", "Uses", "Discount given", "Sales on those bills"], ...offers.map((o) => [o.label, o.uses, o.amount.toFixed(2), o.revenue])];
    if (tab === "cashiers") rows = [["Cashier", "Bills", "Sales", "Items", "Refunds", "Voids"], ...cashiers.map((c) => [staffName(db, c.id), c.bills, c.sales, c.items, c.refunds, c.voids])];
    downloadFile(`icebay-${tab}-${fileTag}.csv`, toCSV(rows));
    toast("CSV downloaded");
  };

  const doRefund = (kind: "refunded" | "void") => {
    if (!open) return;
    if (!reason.trim()) return toast("Add a reason for the audit log", "err");
    refundBill(open.id, kind, reason.trim());
    toast(kind === "void" ? `${open.no} voided` : `${open.no} refunded · ${inr(open.total)}`);
    setOpen(null); setReason("");
  };

  return (
    <Page perm="reports" title="Sales & Reports" sub={`${r.label} · ${fmtDateTime(r.from.toISOString()).split(",")[0]} to ${fmtDateTime(r.to.toISOString()).split(",")[0]}`}
      actions={<><RangePicker value={range} onChange={setRange} custom={custom} onCustom={setCustom} /><button className="btn btn-outline" onClick={exportTab}><Icon name="download" size={16} />Export CSV</button></>}>

      <div className="card" style={{ padding: 4 }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 0 }}>
          {[
            ["Gross sales", S.gross, "Before discounts & tax", ""],
            ["Discounts", -S.discounts, "Offers, coupons, points", "−"],
            ["Refunds", -S.refunds, `${S.refundCount} bills · ${S.voids} voids excluded`, "−"],
            ["Net sales", S.net, "Gross − discounts − refunds", "="],
            ["GST collected", S.tax, `CGST ${half}% + SGST ${half}%`, "+"],
            ["Total collected", S.collected, `${num(S.count)} paid bills`, ""],
          ].map(([label, v, sub, op], i) => (
            <div key={label as string} style={{ padding: "16px 18px", borderLeft: i ? "1px solid var(--line2)" : 0, background: label === "Net sales" ? "var(--yellow-soft)" : undefined, borderRadius: label === "Net sales" ? 12 : 0 }}>
              <div className="row g6 small semi ink2">{op && <span className="muted">{op}</span>}{label}</div>
              <div className="display num" style={{ fontSize: 24, fontWeight: 750, marginTop: 4 }}>{(v as number) < 0 ? "−" : ""}{inr(Math.abs(v as number))}</div>
              <div className="xs muted">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tabs mt16">{TABS.map(([k, l]) => <button key={k} className={cx(tab === k && "on")} onClick={() => setTab(k)}>{l}{k === "refunds" && nonPaid.length ? <span className="badge b-err" style={{ marginLeft: 6, height: 18 }}>{nonPaid.length}</span> : null}</button>)}</div>

      <div className="mt16">
        {tab === "overview" && (
          <div className="col g16">
            <SectionCard title="Daily sales" sub="Total collected per day">
              <AreaChart data={days.map((d) => ({ label: d.label, value: d.sales }))} height={280} format={inr} />
            </SectionCard>
            <div className="grid-2">
              <SectionCard title="Sales by hour" sub="When the queue peaks">
                <BarChart data={hours.slice(11, 24).map((v, i) => ({ label: `${(i + 11) % 12 || 12}${i + 11 < 12 ? "a" : "p"}`, value: v }))} format={inr} />
              </SectionCard>
              <SectionCard title="Top categories" sub="Share of item revenue">
                <div className="col g12">
                  {cats.slice(0, 7).map((c) => (
                    <div key={c.id}><div className="row between small"><span className="semi">{catName(c.id)}</span><span className="num">{inr(c.revenue)} <span className="muted">· {c.qty}</span></span></div>
                      <div className="bar mt4"><span style={{ width: `${(c.revenue / Math.max(1, cats[0]?.revenue ?? 1)) * 100}%` }} /></div></div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {tab === "transactions" && (
          <div className="card">
            <div className="row g12" style={{ padding: 16, borderBottom: "1px solid var(--line2)" }}>
              <div className="search grow" style={{ maxWidth: 420 }}><Icon name="search" /><input className="input" placeholder="Bill no, item or payment ref" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <span className="small muted">{num(tx.length)} bills</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Bill</th><th>Date & time</th><th>Items</th><th>Cashier</th><th>Method</th><th>Status</th><th className="r">Total</th></tr></thead>
                <tbody>{tx.slice(0, 200).map((b) => (
                  <tr key={b.id} className="clickable" onClick={() => { setOpen(b); setReason(""); }}>
                    <td className="semi num">{b.no}</td><td className="ink2 nowrap">{fmtDateTime(b.date)}</td>
                    <td className="ink2"><span className="ellipsis" style={{ display: "block", maxWidth: 280 }}>{b.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</span></td>
                    <td className="ink2">{staffName(db, b.cashierId).split(" ")[0]}</td>
                    <td><span className="badge b-out">{METHOD_LABEL[b.method]}</span></td>
                    <td><span className={cx("badge", b.status === "paid" ? "b-ok" : "b-err")}>{b.status}</span></td>
                    <td className="r num semi">{inr(b.total)}</td>
                  </tr>
                ))}</tbody>
              </table>
              {tx.length > 200 && <div className="small muted center" style={{ padding: 12 }}>Showing the latest 200 — export CSV for all {num(tx.length)}.</div>}
              {!tx.length && <Empty icon="receipt" title="No bills match" />}
            </div>
          </div>
        )}

        {tab === "products" && (
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Product</th><th>Category</th><th className="r">Qty sold</th><th className="r">Revenue</th><th style={{ width: 200 }}>Share</th></tr></thead>
              <tbody>{prods.map((p, i) => (
                <tr key={p.id}><td className="muted num">{i + 1}</td><td className="semi">{p.name}</td><td className="ink2">{catName(p.categoryId)}</td><td className="r num">{num(p.qty)}</td><td className="r num semi">{inr(p.revenue)}</td>
                  <td><div className="row g8"><div className="bar grow"><span style={{ width: `${(p.revenue / Math.max(1, prods[0].revenue)) * 100}%` }} /></div><span className="xs muted num">{((p.revenue / Math.max(1, S.gross)) * 100).toFixed(1)}%</span></div></td></tr>
              ))}</tbody>
            </table>
            {!prods.length && <Empty icon="box" title="No product sales in this period" />}
          </div>
        )}

        {tab === "categories" && (
          <div className="grid-2">
            <SectionCard title="Revenue by category">
              <BarChart data={cats.map((c) => ({ label: catName(c.id).split(" ")[0], value: c.revenue }))} format={inr} height={280} />
            </SectionCard>
            <div className="card table-wrap">
              <table className="table">
                <thead><tr><th>Category</th><th className="r">Items</th><th className="r">Revenue</th><th className="r">Share</th></tr></thead>
                <tbody>{cats.map((c) => <tr key={c.id}><td className="semi">{catName(c.id)}</td><td className="r num">{num(c.qty)}</td><td className="r num semi">{inr(c.revenue)}</td><td className="r num ink2">{((c.revenue / Math.max(1, S.gross)) * 100).toFixed(1)}%</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "payments" && (
          <div className="grid-2">
            <SectionCard title="Payment mix">
              <div className="row g24 wrap" style={{ alignItems: "center" }}>
                <Donut size={200} thickness={30} data={methods.map((m, i) => ({ label: m.method, value: m.amount, color: DONUT_COLORS[i] }))} center={<div><div className="xs muted semi">Collected</div><div className="h3 num">{inr(S.collected)}</div></div>} />
                <Legend items={methods.map((m, i) => ({ label: METHOD_LABEL[m.method], value: inr(m.amount), sub: `${m.count} bills`, color: DONUT_COLORS[i] }))} />
              </div>
            </SectionCard>
            <div className="card table-wrap">
              <table className="table">
                <thead><tr><th>Method</th><th className="r">Bills</th><th className="r">Avg bill</th><th className="r">Amount</th><th className="r">Share</th></tr></thead>
                <tbody>{methods.map((m) => <tr key={m.method}><td className="semi">{METHOD_LABEL[m.method]}</td><td className="r num">{num(m.count)}</td><td className="r num">{inr(m.count ? m.amount / m.count : 0)}</td><td className="r num semi">{inr(m.amount)}</td><td className="r num ink2">{((m.amount / Math.max(1, S.collected)) * 100).toFixed(1)}%</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "discounts" && (
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Offer / discount</th><th className="r">Times applied</th><th className="r">Discount given</th><th className="r">Sales on those bills</th><th className="r">Avg discount</th></tr></thead>
              <tbody>{offers.map((o) => <tr key={o.id}><td><span className="badge b-soft"><Icon name="tag" size={11} />{o.label}</span></td><td className="r num">{num(o.uses)}</td><td className="r num semi ok">−{inr2(o.amount)}</td><td className="r num">{inr(o.revenue)}</td><td className="r num ink2">{inr2(o.amount / Math.max(1, o.uses))}</td></tr>)}</tbody>
            </table>
            {!offers.length && <Empty icon="tag" title="No discounts in this period" />}
          </div>
        )}

        {tab === "refunds" && (
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Bill</th><th>Date</th><th>Status</th><th>Cashier</th><th>Method</th><th className="r">Amount</th></tr></thead>
              <tbody>{nonPaid.map((b) => <tr key={b.id} className="clickable" onClick={() => setOpen(b)}><td className="semi num">{b.no}</td><td className="ink2">{fmtDateTime(b.date)}</td><td><span className="badge b-err">{b.status}</span></td><td className="ink2">{staffName(db, b.cashierId)}</td><td>{METHOD_LABEL[b.method]}</td><td className="r num semi">{inr(b.total)}</td></tr>)}</tbody>
            </table>
            {!nonPaid.length && <Empty icon="undo" title="No refunds or voids" sub="Open any bill in Transactions to refund or void it." />}
          </div>
        )}

        {tab === "tax" && (
          <div className="card table-wrap">
            <div className="row between" style={{ padding: 16 }}><div><div className="h3">GST summary · HSN {db.settings.hsn}</div><div className="xs muted">GSTIN {db.settings.gstin} · intra-state supply (CGST + SGST)</div></div><span className="badge b-soft">Rate {db.settings.taxRate}%</span></div>
            <table className="table">
              <thead><tr><th>Date</th><th className="r">Bills</th><th className="r">Taxable value</th><th className="r">CGST {half}%</th><th className="r">SGST {half}%</th><th className="r">Total GST</th><th className="r">Invoice value</th></tr></thead>
              <tbody>
                {days.filter((d) => d.bills).reverse().map((d) => <tr key={d.date}><td>{d.label}</td><td className="r num">{d.bills}</td><td className="r num">{inr2(d.sales - d.tax)}</td><td className="r num">{inr2(d.tax / 2)}</td><td className="r num">{inr2(d.tax / 2)}</td><td className="r num semi">{inr2(d.tax)}</td><td className="r num">{inr2(d.sales)}</td></tr>)}
                <tr style={{ background: "var(--yellow-soft)" }}><td className="bold">Total</td><td className="r num bold">{num(S.count)}</td><td className="r num bold">{inr2(S.collected - S.tax)}</td><td className="r num bold">{inr2(S.tax / 2)}</td><td className="r num bold">{inr2(S.tax / 2)}</td><td className="r num bold">{inr2(S.tax)}</td><td className="r num bold">{inr2(S.collected)}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {tab === "cashiers" && (
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Cashier</th><th className="r">Bills</th><th className="r">Sales</th><th className="r">Avg bill</th><th className="r">Items</th><th className="r">Refunds</th><th className="r">Voids</th></tr></thead>
              <tbody>{cashiers.map((c) => <tr key={c.id}><td className="semi">{staffName(db, c.id)}</td><td className="r num">{num(c.bills)}</td><td className="r num semi">{inr(c.sales)}</td><td className="r num">{inr(c.bills ? c.sales / c.bills : 0)}</td><td className="r num">{num(c.items)}</td><td className="r num">{c.refunds}</td><td className="r num">{c.voids}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} width={760} title={open ? `Bill ${open.no}` : ""} sub={open ? `${fmtDateTime(open.date)} · ${staffName(db, open.cashierId)}` : ""}>
        {open && (
          <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20 }}>
            <div className="scroll" style={{ maxHeight: "62vh" }}><Receipt bill={open} settings={db.settings} customer={db.customers.find((c) => c.id === open.customerId)} cashier={staffName(db, open.cashierId)} /></div>
            <div className="col g12">
              <span className={cx("badge", open.status === "paid" ? "b-ok" : "b-err")} style={{ alignSelf: "flex-start" }}>{open.status}</span>
              <div className="display num" style={{ fontSize: 34, fontWeight: 800 }}>{inr(open.total)}</div>
              <div className="small ink2">{METHOD_LABEL[open.method]}{open.ref ? ` · ${open.ref}` : ""}</div>
              <button className="btn btn-outline" onClick={() => window.print()}><Icon name="printer" size={16} />Reprint receipt</button>
              {open.status === "paid" && can(db, "refunds") && (
                <div className="panel col g8" style={{ padding: 14, marginTop: 8 }}>
                  <b>Refund or void</b>
                  <div className="xs muted">Refund returns money for a completed sale. Void cancels a bill entered by mistake. Items are restocked and loyalty points reversed.</div>
                  <input className="input" placeholder="Reason (required for audit)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="row g8"><button className="btn btn-danger grow" onClick={() => doRefund("refunded")}>Refund {inr(open.total)}</button><button className="btn btn-outline" onClick={() => doRefund("void")}>Void</button></div>
                </div>
              )}
              {open.status === "paid" && !can(db, "refunds") && <div className="xs muted">Your role can&apos;t issue refunds.</div>}
            </div>
            <div className="print-only"><Receipt bill={open} settings={db.settings} customer={db.customers.find((c) => c.id === open.customerId)} cashier={staffName(db, open.cashierId)} /></div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
