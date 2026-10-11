"use client";
import { useEffect, useState } from "react";
import type { CartAddOn, Product, Variant } from "@/lib/types";
import { Modal } from "../ui";
import { Icon } from "../Icon";
import { ProductArt } from "../ProductArt";
import { cx, inr } from "@/lib/util";

export function CustomizeModal({ product, toppings, maxQty, onClose, onAdd }: {
  product: Product | null; toppings: Product[]; maxQty: number;
  onClose: () => void; onAdd: (p: Product, v: Variant, addOns: CartAddOn[], qty: number) => void;
}) {
  const [v, setV] = useState<Variant | null>(null);
  const [adds, setAdds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  useEffect(() => { if (product) { setV(product.variants[0]); setAdds([]); setQty(1); } }, [product]);
  if (!product || !v) return null;
  const chosen = toppings.filter((t) => adds.includes(t.id)).map((t) => ({ id: t.id, name: t.name, price: t.variants[0].price }));
  const unit = v.price + chosen.reduce((s, a) => s + a.price, 0);
  const add = () => { onAdd(product, v, chosen, qty); onClose(); };

  return (
    <Modal open onClose={onClose} width={720} title={undefined}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 260px) 1fr" }} className="customize">
        <div style={{ background: "var(--bg2)", borderRight: "1px solid var(--line)", borderRadius: "22px 0 0 22px", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
            <ProductArt art={product.art} image={product.image} alt={product.name} rounded={0} />
          </div>
          <div>
            {product.badge && <span className="badge b-yellow">{product.badge}</span>}
            <div className="h2 mt8">{product.name}</div>
            <div className="small ink2 mt4">{product.desc}</div>
          </div>
          <div className="xs muted mt8">SKU {product.sku} · {product.stock} in stock</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", minHeight: 420 }}>
          <div className="row between" style={{ padding: "16px 20px 0" }}>
            <span className="eyebrow">Customise</span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </div>
          <div className="scroll" style={{ padding: "8px 20px 16px", flex: 1, maxHeight: "60vh" }}>
            <div className="h4">Size / variant</div>
            <div className="row wrap g8 mt8">
              {product.variants.map((x) => (
                <button key={x.id} className={cx("chip", v.id === x.id && "on")} onClick={() => setV(x)} style={{ height: 52, flexDirection: "column", gap: 0, alignItems: "flex-start", minWidth: 110 }}>
                  <span>{x.name}</span><span className="xs muted num">{inr(x.price)}</span>
                </button>
              ))}
            </div>
            {product.toppings && (
              <>
                <div className="row between mt24"><div className="h4">Toppings & add-ons</div><span className="xs muted">Optional · pick any</span></div>
                <div className="grid mt8" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                  {toppings.map((t) => {
                    const on = adds.includes(t.id);
                    return (
                      <button key={t.id} className={cx("chip", on && "on")} style={{ height: 48, justifyContent: "space-between", paddingLeft: 8 }}
                        onClick={() => setAdds((a) => (on ? a.filter((x) => x !== t.id) : [...a, t.id]))}>
                        <span className="row g8" style={{ minWidth: 0 }}><span className="thumb" style={{ width: 32, height: 32, borderRadius: 8 }}><ProductArt art={t.art} rounded={0} /></span><span className="ellipsis">{t.name}</span></span>
                        <span className="row g6 nowrap"><span className="xs ink2 num">+{inr(t.variants[0].price)}</span><span className={cx("check", on && "on")}>{on && <Icon name="check" size={12} stroke={3} />}</span></span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="row between g12" style={{ padding: "14px 20px", borderTop: "1px solid var(--line2)" }}>
            <div className="stepper" style={{ height: 48 }}>
              <button style={{ width: 44, height: 46 }} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease"><Icon name="minus" /></button>
              <span style={{ minWidth: 34, fontSize: 17 }}>{qty}</span>
              <button style={{ width: 44, height: 46 }} onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase"><Icon name="plus" /></button>
            </div>
            <button className="btn btn-primary btn-lg grow" onClick={add} disabled={maxQty < 1} autoFocus>
              Add to order · <span className="num">{inr(unit * qty)}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
