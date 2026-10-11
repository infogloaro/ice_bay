"use client";
import { useMemo, useState } from "react";
import { Page, SectionCard } from "@/components/admin";
import { Icon } from "@/components/Icon";
import { Empty, Field, Modal, Switch, confirmDialog, toast } from "@/components/ui";
import { addAudit, setDB, useDB } from "@/lib/store";
import { allBills } from "@/lib/history";
import { byOffer, inRange, rangeFor } from "@/lib/stats";
import { describeOffer, offerStatus } from "@/lib/calc";
import type { Offer, OfferType } from "@/lib/types";
import { addDays, cx, fmtDate, inr, uid, ymd } from "@/lib/util";

const TYPES: { k: OfferType; label: string; help: string }[] = [
  { k: "percent", label: "Percentage off", help: "e.g. 10% off mocktail pops" },
  { k: "fixed", label: "Flat amount off", help: "e.g. ₹50 off above ₹400" },
  { k: "bogo", label: "Buy 1 Get 1", help: "Cheapest of each pair is free" },
  { k: "combo", label: "Combo deal", help: "Discount when all items are bought together" },
];

const statusBadge: Record<string, string> = { Live: "b-ok", Scheduled: "b-soft", Expired: "b-out", Paused: "b-out", "Limit reached": "b-warn" };

export default function Offers() {
  const db = useDB();
  const [edit, setEdit] = useState<Offer | null>(null);
  const [filter, setFilter] = useState("all");
  const r = rangeFor("30d");
  const perf = useMemo(() => byOffer(inRange(allBills(db), r.from, r.to)), [db]); // eslint-disable-line react-hooks/exhaustive-deps
  const L = db.settings.loyalty;
  const [loy, setLoy] = useState(L);

  const offers = db.offers.filter((o) => filter === "all" || (filter === "live" ? offerStatus(o) === "Live" : offerStatus(o) !== "Live"));

  const save = () => {
    if (!edit) return;
    if (edit.name.trim().length < 3) return toast("Give the offer a name", "err");
    if ((edit.type === "percent" && !(edit.value > 0 && edit.value <= 100)) || ((edit.type === "fixed" || edit.type === "combo") && !(edit.value > 0))) return toast("Enter a valid discount value", "err");
    if ((edit.type === "bogo" || edit.type === "combo") && !edit.productIds.length && !edit.categoryIds.length) return toast("Choose the products this offer applies to", "err");
    if (edit.type === "combo" && edit.productIds.length < 2) return toast("A combo needs at least two products", "err");
    if (!edit.autoApply && !edit.code?.trim()) return toast("Coupon offers need a code", "err");
    if (edit.code && db.offers.some((o) => o.code?.toUpperCase() === edit.code!.toUpperCase() && o.id !== edit.id)) return toast("That coupon code is already in use", "err");
    if (edit.end < edit.start) return toast("End date must be after the start date", "err");
    const isNew = !edit.id;
    const o = { ...edit, id: edit.id || uid("o-"), code: edit.autoApply ? undefined : edit.code?.toUpperCase() };
    setDB((d) => { if (isNew) d.offers.unshift(o); else d.offers = d.offers.map((x) => (x.id === o.id ? o : x)); addAudit(d, isNew ? "Offer created" : "Offer updated", o.name); });
    toast(isNew ? "Offer created" : "Offer saved");
    setEdit(null);
  };

  const toggle = (o: Offer, v: boolean) => setDB((d) => { const x = d.offers.find((x) => x.id === o.id); if (x) x.active = v; addAudit(d, v ? "Offer activated" : "Offer paused", o.name); });
  const upd = (p: Partial<Offer>) => setEdit((e) => (e ? { ...e, ...p } : e));
  const pickable = db.products.filter((p) => p.categoryId !== "toppings");

  return (
    <Page perm="offers" title="Offers & Loyalty" sub="Promotions apply automatically at the POS when a cart qualifies"
      actions={<button className="btn btn-primary" onClick={() => setEdit({ id: "", name: "", type: "percent", value: 10, productIds: [], categoryIds: [], minOrder: 0, start: ymd(new Date()), end: ymd(addDays(new Date(), 30)), usageLimit: 0, used: 0, stackable: true, autoApply: true, active: true })}><Icon name="plus" size={16} />Create offer</button>}>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)", alignItems: "start" }}>
        <div className="col g12">
          <div className="pill-tabs" style={{ alignSelf: "flex-start" }}>{[["all", `All (${db.offers.length})`], ["live", "Live"], ["other", "Scheduled & ended"]].map(([k, l]) => <button key={k} className={cx(filter === k && "on")} onClick={() => setFilter(k)}>{l}</button>)}</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {offers.map((o) => {
              const st = offerStatus(o);
              const p = perf.find((x) => x.id === o.id);
              return (
                <div key={o.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, background: st === "Live" ? "linear-gradient(180deg, var(--yellow-soft), #fff 46%)" : undefined }}>
                  <div className="row between">
                    <span className={cx("badge", statusBadge[st])}><span className="dot" />{st}</span>
                    <Switch on={o.active} onChange={(v) => toggle(o, v)} label={`Activate ${o.name}`} />
                  </div>
                  <div>
                    <div className="display" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{describeOffer(o)}</div>
                    <div className="semi mt4">{o.name}</div>
                    <div className="small ink2">{o.desc}</div>
                  </div>
                  <div className="row g6 wrap">
                    {o.code ? <span className="badge b-ink"><Icon name="tag" size={11} />{o.code}</span> : <span className="badge b-out">Auto-applied</span>}
                    {o.minOrder > 0 && <span className="badge b-out">Min {inr(o.minOrder)}</span>}
                    <span className="badge b-out">{o.stackable ? "Stackable" : "Not stackable"}</span>
                  </div>
                  <div className="xs muted">{fmtDate(o.start)} → {fmtDate(o.end)}</div>
                  {o.usageLimit > 0 && <div><div className="row between xs"><span className="muted">Usage</span><span className="num semi">{o.used} / {o.usageLimit}</span></div><div className="bar mt4"><span style={{ width: `${Math.min(100, (o.used / o.usageLimit) * 100)}%` }} /></div></div>}
                  <div className="row between" style={{ borderTop: "1px solid var(--line2)", paddingTop: 10, marginTop: "auto" }}>
                    <span className="xs ink2">30 days: <b className="num">{p?.uses ?? 0}</b> uses · <b className="num">{inr(p?.amount ?? 0)}</b> off</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEdit(structuredClone(o))}><Icon name="edit" size={14} />Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
          {!offers.length && <div className="card"><Empty icon="tag" title="No offers here" /></div>}
        </div>

        <div className="col g16">
          <SectionCard title="Loyalty programme" sub="Applies to registered customers at the POS">
            <div className="col g12">
              <div className="row between"><span className="semi">Programme enabled</span><Switch on={loy.enabled} onChange={(v) => setLoy({ ...loy, enabled: v })} /></div>
              <div className="grid-2" style={{ gap: 10 }}>
                <Field label="Earn 1 point per ₹"><input className="input num" inputMode="numeric" value={loy.spendPerPoint} onChange={(e) => setLoy({ ...loy, spendPerPoint: Math.max(1, Number(e.target.value.replace(/\D/g, ""))) })} /></Field>
                <Field label="Min. bill to redeem ₹"><input className="input num" inputMode="numeric" value={loy.minBill} onChange={(e) => setLoy({ ...loy, minBill: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
                <Field label="Redeem points"><input className="input num" inputMode="numeric" value={loy.redeemPoints} onChange={(e) => setLoy({ ...loy, redeemPoints: Math.max(1, Number(e.target.value.replace(/\D/g, ""))) })} /></Field>
                <Field label="…for ₹ off"><input className="input num" inputMode="numeric" value={loy.redeemValue} onChange={(e) => setLoy({ ...loy, redeemValue: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
              </div>
              <div className="soft small" style={{ padding: "10px 12px" }}>A ₹{loy.spendPerPoint * 100} bill earns <b>100 points</b>; {loy.redeemPoints} points = <b>₹{loy.redeemValue} off</b> (≈{((loy.redeemValue / (loy.redeemPoints * loy.spendPerPoint)) * 100).toFixed(1)}% back).</div>
              <button className="btn btn-primary" disabled={JSON.stringify(loy) === JSON.stringify(L)} onClick={() => { setDB((d) => { d.settings.loyalty = loy; addAudit(d, "Loyalty rules updated", `1 pt/₹${loy.spendPerPoint}, ${loy.redeemPoints} pts = ₹${loy.redeemValue}`); }); toast("Loyalty rules saved"); }}>Save loyalty rules</button>
            </div>
          </SectionCard>
          <SectionCard title="How offers combine" sub="Stacking rules at checkout">
            <ul className="small ink2" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              <li>Every <b>stackable</b> offer the cart qualifies for is applied.</li>
              <li>Of the <b>non-stackable</b> offers (incl. coupons), only the one giving the biggest discount applies.</li>
              <li>Loyalty points are redeemed after offers, before GST.</li>
              <li>Discounts can never exceed the order subtotal.</li>
            </ul>
          </SectionCard>
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} width={680} title={edit?.id ? "Edit offer" : "Create offer"}
        footer={<>
          {edit?.id && <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={async () => { if (edit && (await confirmDialog({ title: "Delete this offer?", confirm: "Delete", danger: true }))) { setDB((d) => { d.offers = d.offers.filter((x) => x.id !== edit.id); addAudit(d, "Offer deleted", edit.name); }); setEdit(null); } }}>Delete</button>}
          <button className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save offer</button>
        </>}>
        {edit && (
          <div className="modal-body col g16">
            <Field label="Offer name"><input className="input" value={edit.name} onChange={(e) => upd({ name: e.target.value })} placeholder="e.g. Monsoon Madness — 20% off sundaes" autoFocus /></Field>
            <div className="grid-4" style={{ gap: 8 }}>
              {TYPES.map((t) => (
                <button key={t.k} className={cx("chip", edit.type === t.k && "on")} style={{ height: "auto", padding: 10, flexDirection: "column", alignItems: "flex-start", textAlign: "left" }} onClick={() => upd({ type: t.k })}>
                  <span>{t.label}</span><span className="xs muted" style={{ fontWeight: 500 }}>{t.help}</span>
                </button>
              ))}
            </div>
            <div className="grid-3" style={{ gap: 12 }}>
              {edit.type !== "bogo" && <Field label={edit.type === "percent" ? "Discount %" : "Discount ₹"}><input className="input num" inputMode="decimal" value={edit.value} onChange={(e) => upd({ value: Number(e.target.value.replace(/[^\d.]/g, "")) })} /></Field>}
              <Field label="Minimum order ₹"><input className="input num" inputMode="numeric" value={edit.minOrder} onChange={(e) => upd({ minOrder: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
              <Field label="Usage limit" hint="0 = unlimited"><input className="input num" inputMode="numeric" value={edit.usageLimit} onChange={(e) => upd({ usageLimit: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Starts"><input className="input" type="date" value={edit.start} onChange={(e) => upd({ start: e.target.value })} /></Field>
              <Field label="Ends"><input className="input" type="date" value={edit.end} onChange={(e) => upd({ end: e.target.value })} /></Field>
            </div>
            <div className="field">
              <label>Applies to {edit.type === "percent" || edit.type === "fixed" ? <span className="muted">(leave empty for whole order)</span> : null}</label>
              <div className="row g6 wrap">
                {db.categories.filter((c) => c.id !== "toppings").map((c) => (
                  <button key={c.id} className={cx("chip", edit.categoryIds.includes(c.id) && "on")} style={{ height: 30, fontSize: 12.5 }} disabled={edit.type === "combo"}
                    onClick={() => upd({ categoryIds: edit.categoryIds.includes(c.id) ? edit.categoryIds.filter((x) => x !== c.id) : [...edit.categoryIds, c.id] })}>{c.name}</button>
                ))}
              </div>
              <select className="select mt8" value="" onChange={(e) => e.target.value && upd({ productIds: [...new Set([...edit.productIds, e.target.value])] })}>
                <option value="">+ Add a specific product</option>
                {pickable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="row g6 wrap">{edit.productIds.map((id) => <span key={id} className="badge b-soft">{db.products.find((p) => p.id === id)?.name}<button className="btn btn-ghost" style={{ height: 16, width: 16, padding: 0 }} onClick={() => upd({ productIds: edit.productIds.filter((x) => x !== id) })} aria-label="Remove"><Icon name="x" size={11} /></button></span>)}</div>
            </div>
            <div className="panel" style={{ padding: "4px 14px" }}>
              <div className="row between g16" style={{ padding: "12px 0" }}>
                <div><div className="semi">Apply automatically</div><div className="xs muted">Off = cashier enters a coupon code</div></div>
                <Switch on={edit.autoApply} onChange={(v) => upd({ autoApply: v })} />
              </div>
              {!edit.autoApply && <div style={{ paddingBottom: 12 }}><Field label="Coupon code"><input className="input" style={{ textTransform: "uppercase" }} value={edit.code ?? ""} onChange={(e) => upd({ code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="e.g. SCOOP20" /></Field></div>}
              <div className="row between g16" style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                <div><div className="semi">Stackable</div><div className="xs muted">Can combine with other offers</div></div>
                <Switch on={edit.stackable} onChange={(v) => upd({ stackable: v })} />
              </div>
            </div>
            <Field label="Customer-facing description"><input className="input" value={edit.desc ?? ""} onChange={(e) => upd({ desc: e.target.value })} placeholder="Shown on the customer display" /></Field>
          </div>
        )}
      </Modal>
    </Page>
  );
}
