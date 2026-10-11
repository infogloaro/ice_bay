"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Kpi, Page, RangePicker, SectionCard, StockPill, useCatName } from "@/components/admin";
import { AreaChart, Donut, DONUT_COLORS, Legend } from "@/components/Charts";
import { Icon } from "@/components/Icon";
import { ProductArt } from "@/components/ProductArt";
import { Empty } from "@/components/ui";
import { currentStaff, staffName, useDB } from "@/lib/store";
import { allBills } from "@/lib/history";
import { byDay, byHour, byMethod, byOffer, inRange, METHOD_LABEL, pct, rangeFor, summarize, topProducts, type RangeKey } from "@/lib/stats";
import { addDays, fmtTime, inr, num } from "@/lib/util";

export default function Dashboard() {
  const db = useDB();
  const staff = currentStaff(db);
  const catName = useCatName();
  const bills = allBills(db);
  const now = new Date();
  const todayCount = useMemo(() => inRange(bills, rangeFor("today").from, now).length, [bills]); // eslint-disable-line react-hooks/exhaustive-deps
  const [range, setRange] = useState<RangeKey>(todayCount >= 8 ? "today" : "7d");
  const r = rangeFor(range, now);
  const span = r.to.getTime() - r.from.getTime();
  const cur = useMemo(() => inRange(bills, r.from, r.to), [bills, range]); // eslint-disable-line react-hooks/exhaustive-deps
  // Compare against the same-length period immediately before (yesterday up to the same time for "today").
  const prev = useMemo(() => inRange(bills, new Date(r.from.getTime() - (range === "today" ? 864e5 : span + 1)), new Date(r.to.getTime() - (range === "today" ? 864e5 : span + 1))), [bills, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const S = summarize(cur), P = summarize(prev);

  const trend = useMemo(() => {
    if (range === "today" || range === "yesterday") {
      const a = byHour(cur), b = byHour(range === "today" ? inRange(bills, addDays(r.from, -1), new Date(r.from.getTime() - 1)) : prev);
      return Array.from({ length: 13 }, (_, i) => i + 11).map((h) => ({ label: `${h % 12 || 12}${h < 12 ? "a" : "p"}`, value: a[h], value2: b[h] }));
    }
    return byDay(cur, r.from, r.to).map((d) => ({ label: d.label, value: d.sales }));
  }, [cur, prev, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const methods = byMethod(cur);
  const top = topProducts(cur).slice(0, 6);
  const offers = byOffer(cur);
  const low = db.products.filter((p) => p.active && p.stock <= p.lowStock).sort((a, b) => a.stock - b.stock).slice(0, 6);
  const recent = cur.slice(0, 8);
  const hr = now.getHours();
  const hello = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const maxTop = Math.max(1, ...top.map((t) => t.revenue));

  return (
    <Page perm="reports" title={`${hello}, ${staff?.name.split(" ")[0]}`}
      sub={<>{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {db.settings.shopName}, Chennai</>}
      actions={<RangePicker value={range} onChange={setRange} options={["today", "yesterday", "7d", "30d"]} />}>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Kpi icon="trend" label={`${r.label}'s sales`.replace("Last 7 days's", "7-day").replace("Last 30 days's", "30-day")} value={inr(S.collected)} delta={pct(S.collected, P.collected)} hint={range === "today" ? "vs yesterday, same time" : "vs previous period"} />
        <Kpi icon="receipt" label="Total bills" value={num(S.count)} delta={pct(S.count, P.count)} />
        <Kpi icon="bag" label="Average order value" value={inr(S.aov)} delta={pct(S.aov, P.aov)} />
        <Kpi icon="box" label="Products sold" value={num(S.items)} delta={pct(S.items, P.items)} />
        <Kpi icon="users" label="Active customers" value={num(S.customers)} delta={pct(S.customers, P.customers)} hint="loyalty members billed" />
      </div>

      <div className="grid mt16" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)" }}>
        <SectionCard title={range === "today" || range === "yesterday" ? "Hourly sales" : "Daily sales"} sub={range === "today" ? "Today vs yesterday · 11 am to 11 pm" : r.label}
          action={range === "today" ? <div className="row g12 xs semi ink2"><span className="row g6"><span style={{ width: 14, height: 3, background: "#E8BF00", borderRadius: 2 }} />Today</span><span className="row g6"><span style={{ width: 14, height: 0, borderTop: "2px dashed #B9B9BE" }} />Yesterday</span></div> : undefined}>
          <AreaChart data={trend} height={260} format={(n) => inr(n)} name={range === "today" ? "Today" : "Sales"} name2="Yesterday" />
        </SectionCard>
        <SectionCard title="Payment methods" sub={`${num(S.count)} paid bills`}>
          <div className="row g20 wrap" style={{ alignItems: "center" }}>
            <Donut data={methods.map((m, i) => ({ label: m.method, value: m.amount, color: DONUT_COLORS[i] }))}
              center={<div><div className="xs muted semi">Collected</div><div className="h3 num">{inr(S.collected)}</div></div>} />
            <Legend items={methods.map((m, i) => ({ label: METHOD_LABEL[m.method], value: inr(m.amount), sub: S.collected ? `${Math.round((m.amount / S.collected) * 100)}%` : "", color: DONUT_COLORS[i] }))} />
          </div>
        </SectionCard>
      </div>

      <div className="grid mt16" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)" }}>
        <SectionCard title="Best-selling products" sub={r.label} action={<Link href="/admin/reports" className="btn btn-ghost btn-sm">View report<Icon name="chevronRight" size={14} /></Link>}>
          {top.length ? (
            <div className="col g12">
              {top.map((t, i) => {
                const p = db.products.find((x) => x.id === t.id);
                return (
                  <div key={t.id} className="row g12">
                    <span className="xs bold muted num" style={{ width: 16 }}>{i + 1}</span>
                    <span className="thumb">{p && <ProductArt art={p.art} image={p.image} rounded={0} />}</span>
                    <div className="grow">
                      <div className="row between"><span className="semi ellipsis">{t.name}</span><b className="num">{inr(t.revenue)}</b></div>
                      <div className="row g8 mt4"><div className="bar grow"><span style={{ width: `${(t.revenue / maxTop) * 100}%` }} /></div><span className="xs muted num nowrap">{t.qty} sold · {catName(t.categoryId)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Empty icon="chart" title="No sales in this period" />}
        </SectionCard>
        <SectionCard title="Low-stock alerts" sub={`${low.length} items at or below reorder level`} action={<Link href="/admin/inventory" className="btn btn-ghost btn-sm">Inventory<Icon name="chevronRight" size={14} /></Link>}>
          {low.length ? (
            <div className="col g8">
              {low.map((p) => (
                <div key={p.id} className="row g12" style={{ padding: "4px 0" }}>
                  <span className="thumb"><ProductArt art={p.art} image={p.image} rounded={0} /></span>
                  <div className="grow"><div className="semi ellipsis">{p.name}</div><div className="xs muted">Reorder at {p.lowStock} · {catName(p.categoryId)}</div></div>
                  <StockPill p={p} />
                </div>
              ))}
            </div>
          ) : <Empty icon="check" title="All stocked up" sub="No product is below its reorder level." />}
        </SectionCard>
      </div>

      <div className="grid mt16" style={{ gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)" }}>
        <SectionCard title="Recent transactions" pad={false} action={<Link href="/admin/reports?tab=transactions" className="btn btn-ghost btn-sm">All bills<Icon name="chevronRight" size={14} /></Link>}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Bill</th><th>Time</th><th>Items</th><th>Cashier</th><th>Method</th><th className="r">Amount</th></tr></thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id}>
                    <td className="semi num">{b.no}</td>
                    <td className="ink2 num nowrap">{fmtTime(b.date)}</td>
                    <td className="ink2"><span className="ellipsis" style={{ display: "block", maxWidth: 220 }}>{b.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</span></td>
                    <td className="ink2 nowrap">{staffName(db, b.cashierId).split(" ")[0]}</td>
                    <td><span className="badge b-out">{METHOD_LABEL[b.method]}</span></td>
                    <td className="r num semi nowrap">{b.status !== "paid" ? <span className="badge b-err" style={{ marginRight: 6 }}>{b.status}</span> : null}{inr(b.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recent.length && <Empty icon="receipt" title="No bills yet" sub="Bills from the POS appear here instantly." />}
          </div>
        </SectionCard>
        <SectionCard title="Promotion performance" sub={r.label} action={<Link href="/admin/offers" className="btn btn-ghost btn-sm">Offers<Icon name="chevronRight" size={14} /></Link>} pad={false}>
          <table className="table">
            <thead><tr><th>Offer</th><th className="r">Uses</th><th className="r">Discount</th><th className="r">Sales</th></tr></thead>
            <tbody>
              {offers.slice(0, 6).map((o) => (
                <tr key={o.id}>
                  <td><span className="badge b-soft"><Icon name="tag" size={11} />{o.label}</span></td>
                  <td className="r num">{o.uses}</td>
                  <td className="r num ok">−{inr(o.amount)}</td>
                  <td className="r num semi">{inr(o.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!offers.length && <Empty icon="tag" title="No offers used" />}
        </SectionCard>
      </div>
    </Page>
  );
}
