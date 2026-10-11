"use client";
import { useMemo, useState } from "react";
import { Page, StockPill, useCatName } from "@/components/admin";
import { Icon } from "@/components/Icon";
import { ProductArt } from "@/components/ProductArt";
import { Drawer, Empty, Field, Switch, confirmDialog, toast } from "@/components/ui";
import { addAudit, setDB, useDB } from "@/lib/store";
import type { ArtKind, Product } from "@/lib/types";
import { cx, inr, resizeImage, uid } from "@/lib/util";

const KINDS: ArtKind[] = ["scoop", "cone", "cup", "sundae", "shake", "falooda", "waffle", "cake", "pack", "drink", "topping", "combo"];
const SWATCHES = ["#F7E9BE", "#6B3E26", "#F4A6B8", "#E8B25E", "#FFB21E", "#B9D78C", "#F3EFE4", "#A77B58", "#B3262F", "#9FD3E6", "#D9D3CC", "#C9E36B"];

const blank = (cat: string): Product => ({
  id: "", sku: "", name: "", categoryId: cat, desc: "", variants: [{ id: uid("v"), name: "Regular", price: 100 }],
  art: { kind: "scoop", color: "#F7E9BE" }, stock: 50, lowStock: 10, toppings: true, active: true,
});

export default function Products() {
  const db = useDB();
  const catName = useCatName();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [edit, setEdit] = useState<Product | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const list = useMemo(() => db.products.filter((p) => {
    const s = q.trim().toLowerCase();
    if (s && !p.name.toLowerCase().includes(s) && !p.sku.toLowerCase().includes(s)) return false;
    if (cat !== "all" && p.categoryId !== cat) return false;
    if (status === "active" && !p.active) return false;
    if (status === "inactive" && p.active) return false;
    if (status === "low" && p.stock > p.lowStock) return false;
    return true;
  }), [db.products, q, cat, status]);

  const save = () => {
    if (!edit) return;
    const e: Record<string, string> = {};
    if (edit.name.trim().length < 2) e.name = "Enter a product name";
    if (!edit.variants.length) e.variants = "Add at least one variant";
    if (edit.variants.some((v) => !v.name.trim() || !(v.price > 0))) e.variants = "Every variant needs a name and a price above ₹0";
    const sku = edit.sku.trim() || `IB-${edit.categoryId.slice(0, 3).toUpperCase()}-${Math.floor(200 + Math.random() * 700)}`;
    if (db.products.some((p) => p.sku === sku && p.id !== edit.id)) e.sku = "SKU already used by another product";
    setErrors(e);
    if (Object.keys(e).length) return;
    const isNew = !edit.id;
    const p = { ...edit, sku, name: edit.name.trim(), id: edit.id || uid("p-") };
    setDB((d) => {
      if (isNew) d.products.unshift(p); else d.products = d.products.map((x) => (x.id === p.id ? p : x));
      addAudit(d, isNew ? "Product created" : "Product updated", `${p.name} (${p.sku})`);
    });
    toast(isNew ? "Product added" : "Product saved");
    setEdit(null);
  };

  const remove = async (p: Product) => {
    if (!(await confirmDialog({ title: `Delete ${p.name}?`, body: "It will disappear from the POS. Past bills keep their history.", confirm: "Delete product", danger: true }))) return;
    setDB((d) => { d.products = d.products.filter((x) => x.id !== p.id); addAudit(d, "Product deleted", p.name); });
    setEdit(null);
    toast("Product deleted", "info");
  };

  const upd = (patch: Partial<Product>) => setEdit((e) => (e ? { ...e, ...patch } : e));

  return (
    <Page perm="products" title="Products" sub={`${db.products.length} products across ${db.categories.length} categories`}
      actions={<button className="btn btn-primary" onClick={() => { setErrors({}); setEdit(blank(cat === "all" ? "fruit" : cat)); }}><Icon name="plus" size={16} />Add product</button>}>
      <div className="card">
        <div className="row g12 wrap" style={{ padding: 16, borderBottom: "1px solid var(--line2)" }}>
          <div className="search" style={{ flex: "1 1 260px" }}><Icon name="search" /><input className="input" placeholder="Search name or SKU" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="select" style={{ width: 200 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {db.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="pill-tabs">
            {[["all", "All"], ["active", "Active"], ["inactive", "Hidden"], ["low", "Low stock"]].map(([k, l]) => <button key={k} className={cx(status === k && "on")} onClick={() => setStatus(k)}>{l}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th>Category</th><th>Variants</th><th className="r">Price</th><th>Stock</th><th>On POS</th><th /></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => { setErrors({}); setEdit(structuredClone(p)); }}>
                  <td>
                    <div className="row g12">
                      <span className="thumb" style={{ width: 52, height: 40 }}><ProductArt art={p.art} image={p.image} rounded={0} /></span>
                      <div><div className="semi row g6">{p.name}{p.badge && <span className="badge b-yellow" style={{ height: 18, fontSize: 10.5 }}>{p.badge}</span>}</div><div className="xs muted num">{p.sku}</div></div>
                    </div>
                  </td>
                  <td className="ink2">{catName(p.categoryId)}</td>
                  <td className="ink2 small">{p.variants.map((v) => v.name).join(" · ")}</td>
                  <td className="r num semi nowrap">{p.variants.length > 1 ? `${inr(Math.min(...p.variants.map((v) => v.price)))} – ${inr(Math.max(...p.variants.map((v) => v.price)))}` : inr(p.variants[0]?.price ?? 0)}</td>
                  <td><StockPill p={p} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Switch on={p.active} label={`Show ${p.name} on POS`} onChange={(v) => { setDB((d) => { const x = d.products.find((x) => x.id === p.id); if (x) x.active = v; }); toast(v ? `${p.name} visible on POS` : `${p.name} hidden from POS`, "info"); }} />
                  </td>
                  <td className="r"><Icon name="chevronRight" size={16} style={{ color: "var(--muted)" }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <Empty icon="search" title="No products match" sub="Try another search or filter." />}
        </div>
      </div>

      <Drawer open={!!edit} onClose={() => setEdit(null)} width={560} title={edit?.id ? "Edit product" : "New product"} sub={edit?.id ? edit.sku : "Appears on the POS as soon as you save"}
        footer={<>
          {edit?.id && <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={() => edit && remove(edit)}><Icon name="trash" size={16} />Delete</button>}
          <button className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save product</button>
        </>}>
        {edit && (
          <div className="col g16">
            <div className="row g16 start">
              <div style={{ width: 168, flexShrink: 0 }}>
                <div style={{ aspectRatio: "4/3", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)" }}><ProductArt art={edit.art} image={edit.image} rounded={0} /></div>
                <label className="btn btn-outline btn-sm btn-block mt8" style={{ cursor: "pointer" }}>
                  <Icon name="upload" size={14} />{edit.image ? "Replace photo" : "Upload photo"}
                  <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) upd({ image: await resizeImage(f) }); }} />
                </label>
                {edit.image && <button className="btn btn-ghost btn-sm btn-block mt4" onClick={() => upd({ image: undefined })}>Use illustration</button>}
              </div>
              <div className="col g12 grow">
                <Field label="Product name" error={errors.name}><input className={cx("input", errors.name && "invalid")} value={edit.name} onChange={(e) => upd({ name: e.target.value })} placeholder="e.g. Salted Caramel Scoop" autoFocus={!edit.id} /></Field>
                <div className="grid-2" style={{ gap: 12 }}>
                  <Field label="SKU" error={errors.sku} hint={!edit.sku ? "Auto-generated if empty" : undefined}><input className={cx("input", errors.sku && "invalid")} value={edit.sku} onChange={(e) => upd({ sku: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Category">
                    <select className="select" value={edit.categoryId} onChange={(e) => upd({ categoryId: e.target.value })}>
                      {db.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </div>
            {!edit.image && (
              <div className="panel" style={{ padding: 12 }}>
                <div className="label">Illustration</div>
                <div className="row g6 wrap mt8">{KINDS.map((k) => <button key={k} className={cx("chip", edit.art.kind === k && "on")} style={{ height: 30, fontSize: 12, padding: "0 10px" }} onClick={() => upd({ art: { ...edit.art, kind: k } })}>{k}</button>)}</div>
                <div className="row g6 wrap mt8">{SWATCHES.map((c) => <button key={c} aria-label={`Colour ${c}`} onClick={() => upd({ art: { ...edit.art, color: c } })} style={{ width: 26, height: 26, borderRadius: 8, background: c, border: edit.art.color === c ? "2px solid var(--ink)" : "1px solid var(--line)" }} />)}</div>
              </div>
            )}
            <Field label="Description"><textarea className="textarea" style={{ minHeight: 64 }} value={edit.desc} onChange={(e) => upd({ desc: e.target.value })} /></Field>

            <div>
              <div className="row between"><span className="label">Variants & prices</span><button className="btn btn-ghost btn-sm" onClick={() => upd({ variants: [...edit.variants, { id: uid("v"), name: "", price: 0 }] })}><Icon name="plus" size={14} />Add variant</button></div>
              <div className="col g8 mt8">
                {edit.variants.map((v, i) => (
                  <div key={v.id} className="row g8">
                    <input className="input" value={v.name} placeholder="Size / variant" onChange={(e) => upd({ variants: edit.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <div className="search" style={{ width: 140 }}><span style={{ position: "absolute", left: 12, color: "var(--muted)" }}>₹</span><input className="input num" style={{ paddingLeft: 26 }} inputMode="decimal" value={v.price || ""} onChange={(e) => upd({ variants: edit.variants.map((x, j) => (j === i ? { ...x, price: Number(e.target.value.replace(/[^\d.]/g, "")) } : x)) })} /></div>
                    <button className="btn btn-ghost btn-icon" disabled={edit.variants.length === 1} onClick={() => upd({ variants: edit.variants.filter((_, j) => j !== i) })} aria-label="Remove variant"><Icon name="trash" size={16} /></button>
                  </div>
                ))}
              </div>
              {errors.variants && <div className="xs err semi mt4">{errors.variants}</div>}
              <div className="hint mt4">The first variant is the default for Quick Add.</div>
            </div>

            <div className="grid-3" style={{ gap: 12 }}>
              <Field label="Stock on hand"><input className="input num" inputMode="numeric" value={edit.stock} onChange={(e) => upd({ stock: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
              <Field label="Reorder level"><input className="input num" inputMode="numeric" value={edit.lowStock} onChange={(e) => upd({ lowStock: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
              <Field label="Badge">
                <select className="select" value={edit.badge ?? ""} onChange={(e) => upd({ badge: e.target.value || undefined })}>
                  {["", "Bestseller", "New", "Seasonal", "Buy 1 Get 1", "Limited"].map((b) => <option key={b} value={b}>{b || "None"}</option>)}
                </select>
              </Field>
            </div>
            <div className="panel col" style={{ padding: "4px 14px", gap: 0 }}>
              {([["toppings", "Allow toppings & add-ons", "Cashier can add toppings when billing"], ["featured", "Feature on customer display", "Rotates on the idle welcome screen"], ["active", "Available on POS", "Hidden products can't be billed"]] as const).map(([k, t, s], i) => (
                <div key={k} className="row between g16" style={{ padding: "12px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div><div className="semi">{t}</div><div className="xs muted">{s}</div></div>
                  <Switch on={!!edit[k]} onChange={(v) => upd({ [k]: v } as Partial<Product>)} label={t} />
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>
    </Page>
  );
}
