"use client";
import { useState } from "react";
import { Page } from "@/components/admin";
import { Icon } from "@/components/Icon";
import { ProductArt } from "@/components/ProductArt";
import { Field, Modal, Switch, confirmDialog, toast } from "@/components/ui";
import { addAudit, setDB, useDB } from "@/lib/store";
import type { Category } from "@/lib/types";
import { allBills } from "@/lib/history";
import { byCategory, inRange, rangeFor } from "@/lib/stats";
import { cx, inr } from "@/lib/util";

const ICONS = ["pop", "scoop", "cone", "cup", "sundae", "shake", "falooda", "waffle", "cake", "pack", "drink", "topping", "tag", "star", "gift", "sparkle", "box"];

export default function Categories() {
  const db = useDB();
  const [edit, setEdit] = useState<Category | null>(null);
  const [err, setErr] = useState("");
  const cats = [...db.categories].sort((a, b) => a.order - b.order);
  const r = rangeFor("30d");
  const perf = byCategory(inRange(allBills(db), r.from, r.to));

  const move = (id: string, dir: -1 | 1) => setDB((d) => {
    const s = [...d.categories].sort((a, b) => a.order - b.order);
    const i = s.findIndex((c) => c.id === id), j = i + dir;
    if (j < 0 || j >= s.length) return;
    [s[i].order, s[j].order] = [s[j].order, s[i].order];
  });

  const save = () => {
    if (!edit) return;
    if (edit.name.trim().length < 2) return setErr("Enter a category name");
    const isNew = !edit.id;
    const id = edit.id || edit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (isNew && db.categories.some((c) => c.id === id)) return setErr("A category with this name already exists");
    setDB((d) => {
      const c = { ...edit, id, name: edit.name.trim() };
      if (isNew) d.categories.push({ ...c, order: d.categories.length + 1 }); else d.categories = d.categories.map((x) => (x.id === id ? c : x));
      addAudit(d, isNew ? "Category created" : "Category updated", c.name);
    });
    toast(isNew ? "Category added" : "Category saved");
    setEdit(null);
  };

  const remove = async (c: Category) => {
    const n = db.products.filter((p) => p.categoryId === c.id).length;
    if (n) return toast(`Move or delete its ${n} products first`, "err");
    if (!(await confirmDialog({ title: `Delete ${c.name}?`, confirm: "Delete", danger: true }))) return;
    setDB((d) => { d.categories = d.categories.filter((x) => x.id !== c.id); addAudit(d, "Category deleted", c.name); });
    setEdit(null);
  };

  return (
    <Page perm="products" title="Categories" sub="Order here is the order cashiers see on the POS"
      actions={<button className="btn btn-primary" onClick={() => { setErr(""); setEdit({ id: "", name: "", icon: "scoop", order: 99, active: true }); }}><Icon name="plus" size={16} />Add category</button>}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {cats.map((c, i) => {
          const prods = db.products.filter((p) => p.categoryId === c.id);
          const p = perf.find((x) => x.id === c.id);
          return (
            <div key={c.id} className="card" style={{ padding: 18, opacity: c.active ? 1 : 0.6 }}>
              <div className="row g12">
                <span className="kpi ic" style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--yellow-soft)", border: "1px solid var(--yellow-line)" }}><Icon name={c.icon} size={22} /></span>
                <div className="grow"><div className="h3">{c.name}</div><div className="xs muted">{prods.length} products · position {i + 1}</div></div>
                <Switch on={c.active} label={`Show ${c.name}`} onChange={(v) => setDB((d) => { const x = d.categories.find((x) => x.id === c.id); if (x) x.active = v; })} />
              </div>
              <div className="row g6 mt12" style={{ minHeight: 40 }}>
                {prods.slice(0, 5).map((p) => <span key={p.id} className="thumb" title={p.name}><ProductArt art={p.art} image={p.image} rounded={0} /></span>)}
                {prods.length > 5 && <span className="badge b-out">+{prods.length - 5}</span>}
              </div>
              <div className="row between mt12" style={{ paddingTop: 12, borderTop: "1px solid var(--line2)" }}>
                <span className="small ink2">30-day sales <b className="num" style={{ color: "var(--ink)" }}>{inr(p?.revenue ?? 0)}</b></span>
                <div className="row g4">
                  <button className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => move(c.id, -1)} aria-label="Move up"><Icon name="chevronLeft" size={16} style={{ transform: "rotate(90deg)" }} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" disabled={i === cats.length - 1} onClick={() => move(c.id, 1)} aria-label="Move down"><Icon name="chevronDown" size={16} /></button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setErr(""); setEdit({ ...c }); }}><Icon name="edit" size={14} />Edit</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} width={480} title={edit?.id ? "Edit category" : "New category"}
        footer={<>
          {edit?.id && <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={() => edit && remove(edit)}>Delete</button>}
          <button className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </>}>
        {edit && (
          <div className="modal-body col g16">
            <Field label="Name" error={err}><input className={cx("input", err && "invalid")} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
            <div className="field">
              <label>Icon</label>
              <div className="row g6 wrap">
                {ICONS.map((ic) => <button key={ic} className={cx("chip", edit.icon === ic && "on")} style={{ width: 44, height: 44, padding: 0, justifyContent: "center" }} onClick={() => setEdit({ ...edit, icon: ic })} aria-label={ic}><Icon name={ic} size={20} /></button>)}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
