"use client";
import { useMemo, useState } from "react";
import { Kpi, Page, StockPill, useCatName } from "@/components/admin";
import { Icon } from "@/components/Icon";
import { ProductArt } from "@/components/ProductArt";
import { Empty, Field, Modal, toast } from "@/components/ui";
import { addAudit, setDB, staffName, useDB } from "@/lib/store";
import type { MoveType, Purchase, Supplier } from "@/lib/types";
import { cx, downloadFile, fmtDate, fmtDateTime, inr, toCSV, uid } from "@/lib/util";

type Tab = "stock" | "purchases" | "suppliers" | "wastage" | "history";

export default function Inventory() {
  const db = useDB();
  const catName = useCatName();
  const [tab, setTab] = useState<Tab>("stock");
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [adj, setAdj] = useState<{ productId: string; type: MoveType; qty: string; note: string } | null>(null);
  const [pur, setPur] = useState<{ supplierId: string; invoice: string; items: { productId: string; qty: string; cost: string }[] } | null>(null);
  const [sup, setSup] = useState<Supplier | null>(null);

  const products = useMemo(() => db.products.filter((p) => p.categoryId !== "combos").filter((p) => {
    const s = q.trim().toLowerCase();
    return (!s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)) && (!onlyLow || p.stock <= p.lowStock);
  }).sort((a, b) => a.stock / Math.max(1, a.lowStock) - b.stock / Math.max(1, b.lowStock)), [db.products, q, onlyLow]);

  const low = db.products.filter((p) => p.active && p.stock > 0 && p.stock <= p.lowStock).length;
  const out = db.products.filter((p) => p.active && p.stock <= 0).length;
  const units = db.products.reduce((s, p) => s + p.stock, 0);
  const wastage = db.stockMoves.filter((m) => m.type === "wastage");
  const pname = (id: string) => db.products.find((p) => p.id === id)?.name ?? "—";

  const saveAdj = () => {
    if (!adj) return;
    const n = Number(adj.qty);
    if (!adj.productId || !(n >= 0) || adj.qty === "") return toast("Enter a valid quantity", "err");
    setDB((d) => {
      const p = d.products.find((x) => x.id === adj.productId);
      if (!p) return;
      const delta = adj.type === "adjust" ? n - p.stock : adj.type === "wastage" ? -n : n;
      p.stock = Math.max(0, p.stock + delta);
      d.stockMoves.unshift({ id: uid("m-"), productId: p.id, type: adj.type, qty: delta, note: adj.note, date: new Date().toISOString(), by: d.session.staffId ?? "system" });
      addAudit(d, adj.type === "wastage" ? "Wastage recorded" : adj.type === "adjust" ? "Stock count adjusted" : "Stock received", `${p.name}: ${delta > 0 ? "+" : ""}${delta}${adj.note ? " · " + adj.note : ""}`);
    });
    toast(adj.type === "wastage" ? "Wastage recorded" : "Stock updated");
    setAdj(null);
  };

  const savePur = () => {
    if (!pur) return;
    const items = pur.items.filter((i) => i.productId && Number(i.qty) > 0).map((i) => ({ productId: i.productId, qty: Number(i.qty), cost: Number(i.cost) || 0 }));
    if (!pur.supplierId || !items.length || !pur.invoice.trim()) return toast("Choose a supplier, add an invoice number and at least one item", "err");
    const p: Purchase = { id: uid("pu-"), supplierId: pur.supplierId, invoice: pur.invoice.trim(), date: new Date().toISOString(), items, total: items.reduce((s, i) => s + i.qty * i.cost, 0), by: db.session.staffId ?? "system" };
    setDB((d) => {
      d.purchases.unshift(p);
      items.forEach((i) => {
        const x = d.products.find((x) => x.id === i.productId);
        if (x) x.stock += i.qty;
        d.stockMoves.unshift({ id: uid("m-"), productId: i.productId, type: "purchase", qty: i.qty, note: p.invoice, date: p.date, by: p.by });
      });
      addAudit(d, "Stock purchase", `Invoice ${p.invoice} · ${inr(p.total)}`);
    });
    toast(`Purchase saved · ${items.length} items restocked`);
    setPur(null);
  };

  const saveSup = () => {
    if (!sup || sup.name.trim().length < 2 || !/^\d{10}$/.test(sup.phone)) return toast("Enter a supplier name and 10-digit phone", "err");
    setDB((d) => { if (sup.id) d.suppliers = d.suppliers.map((s) => (s.id === sup.id ? sup : s)); else d.suppliers.push({ ...sup, id: uid("sp-") }); });
    toast("Supplier saved");
    setSup(null);
  };

  const exportStock = () => downloadFile("icebay-stock.csv", toCSV([["SKU", "Product", "Category", "Stock", "Reorder level", "Status"], ...db.products.map((p) => [p.sku, p.name, catName(p.categoryId), p.stock, p.lowStock, p.stock <= 0 ? "Out" : p.stock <= p.lowStock ? "Low" : "OK"])]));

  return (
    <Page perm="inventory" title="Inventory" sub="Stock levels update automatically with every bill"
      actions={<>
        <button className="btn btn-outline" onClick={exportStock}><Icon name="download" size={16} />Export</button>
        <button className="btn btn-outline" onClick={() => setAdj({ productId: "", type: "wastage", qty: "", note: "" })}><Icon name="trash" size={16} />Record wastage</button>
        <button className="btn btn-primary" onClick={() => setPur({ supplierId: db.suppliers[0]?.id ?? "", invoice: "", items: [{ productId: "", qty: "", cost: "" }] })}><Icon name="truck" size={16} />New purchase</button>
      </>}>
      <div className="grid-4">
        <Kpi icon="box" label="Units on hand" value={units.toLocaleString("en-IN")} hint={`${db.products.length} SKUs`} />
        <Kpi icon="alert" label="Low stock" value={low} hint="at or below reorder level" />
        <Kpi icon="x" label="Out of stock" value={out} hint="blocked on POS" />
        <Kpi icon="truck" label="Purchases this month" value={inr(db.purchases.filter((p) => new Date(p.date).getMonth() === new Date().getMonth()).reduce((s, p) => s + p.total, 0))} hint={`${db.purchases.length} invoices`} />
      </div>

      {(low > 0 || out > 0) && (
        <div className="soft row g12 mt16" style={{ padding: "12px 16px" }}>
          <Icon name="alert" />
          <span className="grow"><b>{low + out} products need restocking.</b> <span className="ink2">{db.products.filter((p) => p.active && p.stock <= p.lowStock).slice(0, 4).map((p) => p.name).join(", ")}{low + out > 4 ? "…" : ""}</span></span>
          <button className="btn btn-outline btn-sm" onClick={() => { setTab("stock"); setOnlyLow(true); }}>Show them</button>
        </div>
      )}

      <div className="card mt16">
        <div className="tabs" style={{ padding: "0 12px" }}>
          {([["stock", "Stock levels"], ["purchases", "Purchases"], ["suppliers", "Suppliers"], ["wastage", "Wastage"], ["history", "Inventory history"]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} className={cx(tab === k && "on")} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === "stock" && (
          <>
            <div className="row g12 wrap" style={{ padding: 16 }}>
              <div className="search" style={{ flex: "1 1 260px" }}><Icon name="search" /><input className="input" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <button className={cx("chip", onlyLow && "on")} onClick={() => setOnlyLow((v) => !v)}><Icon name="alert" size={15} />Low & out only</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th>Category</th><th style={{ width: 220 }}>Level</th><th>Status</th><th className="r">Actions</th></tr></thead>
                <tbody>
                  {products.map((p) => {
                    const ratio = Math.min(1, p.stock / Math.max(1, p.lowStock * 4));
                    return (
                      <tr key={p.id}>
                        <td><div className="row g12"><span className="thumb"><ProductArt art={p.art} image={p.image} rounded={0} /></span><div><div className="semi">{p.name}</div><div className="xs muted num">{p.sku}</div></div></div></td>
                        <td className="ink2">{catName(p.categoryId)}</td>
                        <td><div className="row g8"><div className="bar grow"><span style={{ width: `${ratio * 100}%`, background: p.stock <= 0 ? "var(--err)" : p.stock <= p.lowStock ? "#F5A524" : undefined }} /></div><span className="num semi" style={{ minWidth: 34, textAlign: "right" }}>{p.stock}</span></div><div className="xs muted">Reorder at {p.lowStock}</div></td>
                        <td><StockPill p={p} /></td>
                        <td className="r nowrap">
                          <button className="btn btn-ghost btn-sm" onClick={() => setAdj({ productId: p.id, type: "purchase", qty: "", note: "" })}><Icon name="plus" size={14} />Receive</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setAdj({ productId: p.id, type: "adjust", qty: String(p.stock), note: "Physical count" })}><Icon name="edit" size={14} />Adjust</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!products.length && <Empty icon="box" title="Nothing to show" />}
            </div>
          </>
        )}

        {tab === "purchases" && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Invoice</th><th>Supplier</th><th>Items</th><th>Entered by</th><th className="r">Total</th></tr></thead>
              <tbody>{db.purchases.map((p) => (
                <tr key={p.id}>
                  <td className="nowrap">{fmtDate(p.date)}</td><td className="semi num">{p.invoice}</td>
                  <td>{db.suppliers.find((s) => s.id === p.supplierId)?.name}</td>
                  <td className="ink2 small">{p.items.map((i) => `${i.qty} × ${pname(i.productId)}`).join(", ")}</td>
                  <td className="ink2">{staffName(db, p.by)}</td><td className="r num semi">{inr(p.total)}</td>
                </tr>
              ))}</tbody>
            </table>
            {!db.purchases.length && <Empty icon="truck" title="No purchases yet" />}
          </div>
        )}

        {tab === "suppliers" && (
          <div style={{ padding: 16 }}>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {db.suppliers.map((s) => {
                const total = db.purchases.filter((p) => p.supplierId === s.id).reduce((a, p) => a + p.total, 0);
                return (
                  <div key={s.id} className="panel" style={{ padding: 16 }}>
                    <div className="row between"><div className="h3">{s.name}</div><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSup({ ...s })} aria-label="Edit supplier"><Icon name="edit" size={15} /></button></div>
                    <div className="small ink2 mt4">{s.supplies}</div>
                    <div className="row g12 mt12 small"><span className="row g6"><Icon name="user" size={14} />{s.contact}</span><span className="row g6 num"><Icon name="phone" size={14} />{s.phone}</span></div>
                    <div className="xs muted mt8">Purchases: <b className="num" style={{ color: "var(--ink)" }}>{inr(total)}</b></div>
                  </div>
                );
              })}
              <button className="panel empty" style={{ border: "1px dashed #cfcfcf", cursor: "pointer" }} onClick={() => setSup({ id: "", name: "", contact: "", phone: "", supplies: "" })}><Icon name="plus" />Add supplier</button>
            </div>
          </div>
        )}

        {(tab === "wastage" || tab === "history") && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="r">Qty</th><th>Note / ref</th><th>By</th></tr></thead>
              <tbody>{(tab === "wastage" ? wastage : db.stockMoves).slice(0, 150).map((m) => (
                <tr key={m.id}>
                  <td className="nowrap ink2">{fmtDateTime(m.date)}</td><td className="semi">{pname(m.productId)}</td>
                  <td><span className={cx("badge", m.type === "sale" ? "b-out" : m.type === "purchase" ? "b-ok" : m.type === "wastage" ? "b-err" : m.type === "refund" ? "b-soft" : "b-warn")}>{m.type}</span></td>
                  <td className={cx("r num semi", m.qty < 0 ? "err" : "ok")}>{m.qty > 0 ? "+" : ""}{m.qty}</td>
                  <td className="ink2 small">{m.note}</td><td className="ink2">{staffName(db, m.by)}</td>
                </tr>
              ))}</tbody>
            </table>
            {!(tab === "wastage" ? wastage : db.stockMoves).length && <Empty icon="list" title={tab === "wastage" ? "No wastage recorded" : "No stock movements yet"} sub="Sales, purchases, wastage and adjustments appear here." />}
          </div>
        )}
      </div>

      <Modal open={!!adj} onClose={() => setAdj(null)} width={480} title={adj?.type === "wastage" ? "Record wastage" : adj?.type === "adjust" ? "Adjust stock count" : "Receive stock"}
        footer={<><button className="btn btn-outline" onClick={() => setAdj(null)}>Cancel</button><button className="btn btn-primary" onClick={saveAdj}>Save</button></>}>
        {adj && (
          <div className="modal-body col g12">
            <Field label="Product">
              <select className="select" value={adj.productId} onChange={(e) => setAdj({ ...adj, productId: e.target.value })}>
                <option value="">Select product</option>
                {db.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stock} on hand)</option>)}
              </select>
            </Field>
            <div className="pill-tabs" style={{ alignSelf: "flex-start" }}>
              {([["purchase", "Receive"], ["wastage", "Wastage"], ["adjust", "Set count"]] as [MoveType, string][]).map(([k, l]) => <button key={k} className={cx(adj.type === k && "on")} onClick={() => setAdj({ ...adj, type: k })}>{l}</button>)}
            </div>
            <Field label={adj.type === "adjust" ? "Counted quantity" : "Quantity"}><input className="input input-lg num" inputMode="numeric" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value.replace(/\D/g, "") })} autoFocus /></Field>
            <Field label={adj.type === "wastage" ? "Reason" : "Note"}>
              {adj.type === "wastage" ? (
                <select className="select" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })}>
                  {["", "Melted / temperature", "Expired", "Dropped / damaged", "Quality issue", "Staff tasting"].map((r) => <option key={r} value={r}>{r || "Choose a reason"}</option>)}
                </select>
              ) : <input className="input" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />}
            </Field>
          </div>
        )}
      </Modal>

      <Modal open={!!pur} onClose={() => setPur(null)} width={680} title="New purchase entry" sub="Received items are added to stock immediately"
        footer={<><span className="grow semi">Total <span className="num">{inr(pur?.items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.cost || 0), 0) ?? 0)}</span></span><button className="btn btn-outline" onClick={() => setPur(null)}>Cancel</button><button className="btn btn-primary" onClick={savePur}>Save purchase</button></>}>
        {pur && (
          <div className="modal-body col g12">
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Supplier"><select className="select" value={pur.supplierId} onChange={(e) => setPur({ ...pur, supplierId: e.target.value })}>{db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Invoice number"><input className="input" value={pur.invoice} onChange={(e) => setPur({ ...pur, invoice: e.target.value })} placeholder="e.g. ADP/2026/4519" /></Field>
            </div>
            <div className="label">Items</div>
            {pur.items.map((it, i) => (
              <div key={i} className="row g8">
                <select className="select" value={it.productId} onChange={(e) => setPur({ ...pur, items: pur.items.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)) })}>
                  <option value="">Product</option>{db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="input num" style={{ width: 90 }} placeholder="Qty" inputMode="numeric" value={it.qty} onChange={(e) => setPur({ ...pur, items: pur.items.map((x, j) => (j === i ? { ...x, qty: e.target.value.replace(/\D/g, "") } : x)) })} />
                <input className="input num" style={{ width: 110 }} placeholder="Unit cost ₹" inputMode="decimal" value={it.cost} onChange={(e) => setPur({ ...pur, items: pur.items.map((x, j) => (j === i ? { ...x, cost: e.target.value.replace(/[^\d.]/g, "") } : x)) })} />
                <button className="btn btn-ghost btn-icon" disabled={pur.items.length === 1} onClick={() => setPur({ ...pur, items: pur.items.filter((_, j) => j !== i) })} aria-label="Remove row"><Icon name="trash" size={16} /></button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setPur({ ...pur, items: [...pur.items, { productId: "", qty: "", cost: "" }] })}><Icon name="plus" size={14} />Add item</button>
          </div>
        )}
      </Modal>

      <Modal open={!!sup} onClose={() => setSup(null)} width={480} title={sup?.id ? "Edit supplier" : "Add supplier"}
        footer={<><button className="btn btn-outline" onClick={() => setSup(null)}>Cancel</button><button className="btn btn-primary" onClick={saveSup}>Save</button></>}>
        {sup && (
          <div className="modal-body col g12">
            <Field label="Business name"><input className="input" value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} autoFocus /></Field>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Contact person"><input className="input" value={sup.contact} onChange={(e) => setSup({ ...sup, contact: e.target.value })} /></Field>
              <Field label="Phone"><input className="input num" inputMode="numeric" maxLength={10} value={sup.phone} onChange={(e) => setSup({ ...sup, phone: e.target.value.replace(/\D/g, "") })} /></Field>
            </div>
            <Field label="Supplies"><input className="input" value={sup.supplies} onChange={(e) => setSup({ ...sup, supplies: e.target.value })} placeholder="e.g. Cones, cups, spoons" /></Field>
          </div>
        )}
      </Modal>
    </Page>
  );
}
