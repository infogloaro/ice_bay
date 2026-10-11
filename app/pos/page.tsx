"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CartAddOn, CartLine, PayMethod, Product, Variant } from "@/lib/types";
import { Icon, Logo } from "@/components/Icon";
import { ProductArt } from "@/components/ProductArt";
import { Dropdown, Empty, confirmDialog, toast, useClock } from "@/components/ui";
import { CustomizeModal } from "@/components/pos/CustomizeModal";
import { CustomerModal, type CustomerMode } from "@/components/pos/CustomerModal";
import { DailySales } from "@/components/DailySales";
import { PaymentModal, type PayStatus } from "@/components/pos/PaymentModal";
import { CloseShiftModal, OpenShiftModal } from "@/components/pos/ShiftModal";
import { can, currentStaff, setDB, useDB } from "@/lib/store";
import { computeTotals, offerLive } from "@/lib/calc";
import { nextBillNo } from "@/lib/history";
import { finalizeBill } from "@/lib/pos";
import { publishDisplay, type DisplayState } from "@/lib/sync";
import { cx, initials, inr, inr2, uid } from "@/lib/util";

const CART_KEY = "icebay-cart";

export default function POS() {
  const db = useDB();
  const router = useRouter();
  const staff = currentStaff(db);
  const now = useClock(15000);

  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<CartLine[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(CART_KEY) || "{}").lines ?? []; } catch { return []; }
  });
  const [customerId, setCustomerId] = useState<string | undefined>(() => {
    try { return JSON.parse(sessionStorage.getItem(CART_KEY) || "{}").customerId; } catch { return undefined; }
  });
  const [coupon, setCoupon] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [redeem, setRedeem] = useState(0);
  const [customizing, setCustomizing] = useState<Product | null>(null);
  const [showCust, setShowCust] = useState<CustomerMode | null>(null);
  const [view, setView] = useState<"menu" | "sales">("menu");
  const [paying, setPaying] = useState<{ billNo: string } | null>(null);
  const [pay, setPay] = useState<{ method: PayMethod; methodLabel: string; status: PayStatus; qr?: string; cashReceived?: number; change?: number } | null>(null);
  const [done, setDone] = useState<{ billNo: string; total: number; earn: number; method: string; at: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!staff) router.replace("/"); }, [staff, router]);
  useEffect(() => { try { sessionStorage.setItem(CART_KEY, JSON.stringify({ lines, customerId })); } catch { /* ignore */ } }, [lines, customerId]);

  const customer = db.customers.find((c) => c.id === customerId) ?? null;
  const totals = useMemo(
    () => computeTotals(lines, { offers: db.offers, settings: db.settings, coupon, redeemBlocks: redeem, customer }),
    [lines, db.offers, db.settings, coupon, redeem, customer],
  );
  useEffect(() => { if (redeem > totals.maxRedeemBlocks) setRedeem(totals.maxRedeemBlocks); }, [redeem, totals.maxRedeemBlocks]);
  useEffect(() => { if (!customerId) setRedeem(0); }, [customerId]);

  const cats = useMemo(() => [...db.categories].filter((c) => c.active).sort((a, b) => a.order - b.order), [db.categories]);
  const activeProducts = useMemo(() => db.products.filter((p) => p.active), [db.products]);
  const toppings = useMemo(() => activeProducts.filter((p) => p.categoryId === "toppings" && p.stock > 0), [activeProducts]);
  const liveOffers = useMemo(() => db.offers.filter((o) => offerLive(o, now)), [db.offers, now]);
  const offerProductIds = useMemo(() => {
    const s = new Set<string>();
    liveOffers.forEach((o) => { o.productIds.forEach((id) => s.add(id)); activeProducts.forEach((p) => o.categoryIds.includes(p.categoryId) && s.add(p.id)); });
    return s;
  }, [liveOffers, activeProducts]);

  const inCart = useMemo(() => {
    const m: Record<string, number> = {};
    lines.forEach((l) => (m[l.productId] = (m[l.productId] ?? 0) + l.qty));
    return m;
  }, [lines]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = activeProducts;
    if (s) list = list.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.desc.toLowerCase().includes(s));
    else if (cat === "combos") list = list.filter((p) => p.categoryId === "combos" || offerProductIds.has(p.id));
    else if (cat !== "all") list = list.filter((p) => p.categoryId === cat);
    return list;
  }, [activeProducts, q, cat, offerProductIds]);

  const countFor = (id: string) => id === "all" ? activeProducts.length : id === "combos"
    ? activeProducts.filter((p) => p.categoryId === "combos" || offerProductIds.has(p.id)).length
    : activeProducts.filter((p) => p.categoryId === id).length;

  const available = useCallback((p: Product) => (db.settings.blockOutOfStock ? Math.max(0, p.stock - (inCart[p.id] ?? 0)) : 999), [db.settings.blockOutOfStock, inCart]);

  const addLine = useCallback((p: Product, v: Variant, addOns: CartAddOn[], qty = 1) => {
    if (available(p) < qty) { toast(`Only ${p.stock} ${p.name} left in stock`, "err"); return; }
    const key = [p.id, v.id, ...addOns.map((a) => a.id).sort()].join("|");
    const unit = v.price + addOns.reduce((s, a) => s + a.price, 0);
    setLines((ls) => {
      const ex = ls.find((l) => l.key === key);
      if (ex) return ls.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
      return [...ls, { key, productId: p.id, categoryId: p.categoryId, name: p.name, variant: v.name, addOns, unitPrice: unit, qty }];
    });
    setFlash(p.id + "@" + Date.now());
    setDone(null);
  }, [available]);

  const tapProduct = (p: Product) => {
    if (available(p) < 1) { toast(p.stock ? `All ${p.stock} in stock are already in the cart` : `${p.name} is sold out`, "err"); return; }
    if (p.variants.length > 1 || (p.toppings && toppings.length)) setCustomizing(p);
    else addLine(p, p.variants[0], []);
  };

  const setQty = (key: string, qty: number) => {
    const l = lines.find((x) => x.key === key);
    if (!l) return;
    const p = db.products.find((x) => x.id === l.productId);
    if (p && qty > l.qty && available(p) < qty - l.qty) { toast(`Only ${p.stock} ${p.name} in stock`, "err"); return; }
    setLines((ls) => (qty <= 0 ? ls.filter((x) => x.key !== key) : ls.map((x) => (x.key === key ? { ...x, qty } : x))));
  };

  const resetOrder = () => { setLines([]); setCustomerId(undefined); setCoupon(""); setCouponInput(""); setRedeem(0); };
  const clearCart = async () => {
    if (!lines.length) return;
    if (await confirmDialog({ title: "Clear this order?", body: `${totals.itemCount} items will be removed from the cart.`, confirm: "Clear order", danger: true })) { resetOrder(); toast("Order cleared", "info"); }
  };

  const hold = () => {
    if (!lines.length) return;
    setDB((d) => { d.held.unshift({ id: uid("h-"), at: new Date().toISOString(), lines, customerId, label: customer?.name.split(" ")[0] ?? `Order ${d.held.length + 1}` }); });
    resetOrder();
    toast("Order put on hold", "info");
  };
  const recall = (id: string) => {
    const h = db.held.find((x) => x.id === id);
    if (!h) return;
    if (lines.length) setDB((d) => { d.held.push({ id: uid("h-"), at: new Date().toISOString(), lines, customerId, label: customer?.name.split(" ")[0] ?? "Swapped order" }); });
    setDB((d) => { d.held = d.held.filter((x) => x.id !== id); });
    setLines(h.lines); setCustomerId(h.customerId); setCoupon(""); setRedeem(0);
    toast(`Recalled ${h.label}`, "info");
  };

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const t = computeTotals(lines, { offers: db.offers, settings: db.settings, coupon: code, redeemBlocks: redeem, customer });
    if (t.couponApplied) { setCoupon(code); toast(`${code} applied`); }
    else toast(t.couponError ?? "Coupon not valid", "err");
  };
  useEffect(() => { if (coupon && !paying && !totals.couponApplied) { toast(totals.couponError ?? "Coupon removed", "err"); setCoupon(""); } }, [coupon, paying, totals.couponApplied, totals.couponError]);

  const startPayment = () => {
    if (!lines.length || paying) return;
    setPaying({ billNo: "IB-" + nextBillNo(db) });
  };

  const onPayStatus = useCallback((s: NonNullable<typeof pay>) => setPay(s), []);
  const onComplete = useCallback((p: { method: PayMethod; methodLabel?: string; ref?: string; cashReceived?: number; change?: number }) => {
    const bill = finalizeBill({ lines, totals, customerId, ...p });
    setDone({ billNo: bill.no, total: bill.total, earn: bill.pointsEarned, method: p.methodLabel ?? p.method, at: Date.now() });
    return bill;
  }, [lines, totals, customerId]);
  const newOrder = useCallback(() => { setPaying(null); setPay(null); resetOrder(); setTimeout(() => searchRef.current?.focus(), 50); }, []);

  // ---- customer display sync ----
  useEffect(() => {
    const productOf = (id: string) => db.products.find((p) => p.id === id);
    const base: DisplayState = {
      mode: "idle", lines: lines.map((l) => ({ name: l.name, variant: l.variant, addOns: l.addOns.map((a) => a.name), qty: l.qty, amount: l.qty * l.unitPrice, art: productOf(l.productId)?.art ?? { kind: "scoop", color: "#F7E9BE" }, image: productOf(l.productId)?.image })),
      itemCount: totals.itemCount, subtotal: totals.subtotal,
      discounts: [...totals.discounts.map((d) => ({ label: d.label, amount: d.amount })), ...(totals.pointsValue ? [{ label: `Loyalty points`, amount: totals.pointsValue }] : [])],
      tax: totals.tax, taxLabel: `GST ${db.settings.taxRate}%`, roundOff: totals.roundOff, total: totals.total,
      customerFirstName: customer?.name.split(" ")[0], points: customer?.points, earn: totals.earn, ts: 0,
    };
    if (done && Date.now() - done.at < 9000 && !lines.length) {
      publishDisplay({ ...base, mode: "success", billNo: done.billNo, total: done.total, earn: done.earn, methodLabel: done.method, lines: [] });
    } else if (paying && pay) {
      publishDisplay({ ...base, mode: pay.status === "verified" ? "success" : "payment", billNo: paying.billNo, method: pay.method, methodLabel: pay.methodLabel, qr: pay.qr, paymentStatus: pay.status, cashReceived: pay.cashReceived, change: pay.change });
    } else {
      publishDisplay({ ...base, mode: lines.length ? "order" : "idle" });
    }
  }, [lines, totals, customer, paying, pay, done, db.products, db.settings.taxRate]);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone((d) => (d && Date.now() - d.at >= 9000 ? null : d)), 9100);
    return () => clearTimeout(t);
  }, [done]);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if (e.key === "F2" || (e.key === "/" && !typing)) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F9" && !paying) { e.preventDefault(); startPayment(); }
      if (e.key === "Escape" && typing && q) setQ("");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (!staff) return null;
  const shift = db.shifts.find((s) => s.staffId === staff.id && !s.closedAt);
  const L = db.settings.loyalty;
  const openDisplay = () => window.open("/display", "icebay-display", "popup,width=1280,height=800");
  const signOut = () => { setDB((d) => { d.session.staffId = null; }); router.push("/"); };
  const catName = q ? `Results for “${q}”` : cat === "all" ? "All items" : cats.find((c) => c.id === cat)?.name;

  return (
    <div className="pos">
      {/* ---------- top bar ---------- */}
      <header className="pos-top on-dark">
        <Logo size={38} sub="Counter 1" dark />
        <div className="search grow" style={{ maxWidth: 520, marginLeft: 12 }}>
          <Icon name="search" />
          <input ref={searchRef} className="input" style={{ height: 44, borderRadius: 12, background: "var(--bg2)" }} placeholder="Search products or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
          {q ? <button className="btn btn-ghost btn-icon btn-sm" style={{ position: "absolute", right: 6 }} onClick={() => setQ("")} aria-label="Clear search"><Icon name="x" size={16} /></button> : <kbd className="hide-xs">F2</kbd>}
        </div>
        <div className="row g8" style={{ marginLeft: "auto" }}>
          <div className="hide-xs"><Dropdown width={300} trigger={() => (
            <button className="btn btn-outline" aria-label="Held orders"><Icon name="pause" size={16} /><span className="hide-sm">Held</span>{db.held.length > 0 && <span className="badge b-yellow">{db.held.length}</span>}</button>
          )}>
            {(close) => db.held.length ? db.held.map((h) => (
              <button key={h.id} className="menu-item" onClick={() => { recall(h.id); close(); }}>
                <Icon name="receipt" size={16} />
                <span className="grow"><span className="semi">{h.label}</span><span className="xs muted" style={{ display: "block" }}>{h.lines.reduce((s, l) => s + l.qty, 0)} items · {new Date(h.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></span>
                <span className="xs semi">Recall</span>
              </button>
            )) : <div className="small muted" style={{ padding: 12 }}>No held orders. Use “Hold” to park an order while serving someone else.</div>}
          </Dropdown></div>
          <button className="btn btn-outline hide-xs" onClick={openDisplay} title="Open customer display"><Icon name="monitor" size={16} /><span className="hide-sm">Display</span></button>
          <div className="hide-sm" style={{ textAlign: "right", padding: "0 6px", lineHeight: 1.2 }}>
            <div className="semi num">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
            <div className="xs muted">{now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</div>
          </div>
          <Dropdown width={240} trigger={() => (
            <button className="btn btn-ghost" style={{ paddingLeft: 6, height: 44 }} aria-label="Account menu">
              <span className="avatar">{initials(staff.name)}</span>
              <span className="hide-sm" style={{ textAlign: "left", lineHeight: 1.2 }}><span className="semi" style={{ display: "block" }}>{staff.name.split(" ")[0]}</span><span className="xs muted">{staff.role}</span></span>
              <Icon name="chevronDown" size={16} />
            </button>
          )}>
            {(close) => (<>
              {(can(db, "reports") || can(db, "products")) && <Link href="/admin" className="menu-item" onClick={close}><Icon name="chart" size={16} />Admin dashboard</Link>}
              <button className="menu-item" onClick={() => { openDisplay(); close(); }}><Icon name="monitor" size={16} />Customer display</button>
              {shift && <button className="menu-item" onClick={() => { setClosing(true); close(); }}><Icon name="lock" size={16} />Close shift</button>}
              <button className="menu-item" onClick={signOut}><Icon name="logout" size={16} />Sign out</button>
            </>)}
          </Dropdown>
          <button className="btn btn-primary cart-fab" onClick={() => setCartOpen((o) => !o)}><Icon name="bag" size={16} />{totals.itemCount}</button>
        </div>
      </header>

      {/* ---------- categories (horizontal) · last tab = daily sales ---------- */}
      <nav className="pos-cats" aria-label="Categories">
        <div className="cat-scroll scroll">
        {[{ id: "all", name: "All Items", icon: "grid" }, ...cats].map((c) => (
          <button key={c.id} className={cx("cat-btn", view === "menu" && !q && cat === c.id && "on")} onClick={() => { setCat(c.id); setQ(""); setView("menu"); }}>
            <span className="ci"><Icon name={c.icon} size={18} /></span>
            <span>{c.name}</span>
            <span className="cn num">{countFor(c.id)}</span>
          </button>
        ))}
        </div>
        <span className="cat-sep" />
        <button className={cx("cat-btn sales", view === "sales" && "on")} onClick={() => setView("sales")}>
          <span className="ci"><Icon name="chart" size={18} /></span>
          <span>Daily Sales</span>
        </button>
      </nav>

      <div className={cx("pos-body", view === "sales" && "full")}>
        {view === "sales" && <main className="pos-main scroll"><DailySales cashierName={staff.name} /></main>}
        {/* ---------- products ---------- */}
        <main className="pos-main" style={{ display: view === "sales" ? "none" : undefined }}>
          <div className="pos-main-head">
            <div className="grow">
              <div className="h2">{catName}</div>
              <div className="xs muted">{filtered.length} products · tap to pick size & add-ons, <b>+</b> to quick add</div>
            </div>
            {liveOffers.filter((o) => o.autoApply).slice(0, 2).map((o) => (
              <span key={o.id} className="badge b-soft hide-sm" style={{ height: 28 }}><Icon name="tag" size={13} />{o.name.split(" — ")[0]}</span>
            ))}
          </div>
          <div className="scroll" style={{ flex: 1 }}>
            {filtered.length ? (
              <div className="pgrid">
                {filtered.map((p) => {
                  const left = p.stock;
                  const out = left <= 0;
                  const low = !out && left <= p.lowStock;
                  const n = inCart[p.id];
                  return (
                    <div key={p.id} role="button" tabIndex={0} className={cx("pcard", out && "out", flash?.startsWith(p.id + "@") && "added")}
                      onClick={() => tapProduct(p)} onKeyDown={(e) => e.key === "Enter" && tapProduct(p)} aria-label={`${p.name}, from ${inr(p.variants[0].price)}`}>
                      <div className="pimg">
                        <ProductArt art={p.art} image={p.image} alt={p.name} rounded={0} />
                        {p.badge && <span className="badge b-yellow pbadge">{p.badge}</span>}
                        {out ? <span className="badge b-err pstock">Sold out</span> : low ? <span className="badge b-warn pstock">{left} left</span> : null}
                        {n ? <span className="incart">{n}</span> : null}
                      </div>
                      <div className="pinfo">
                        <div className="pname">{p.name}</div>
                        <div className="pvar ellipsis">{p.variants.length > 1 ? p.variants.map((v) => v.name).join(" · ") : p.variants[0].name}{!out && !low ? " · In stock" : ""}</div>
                        <div className="pfoot">
                          <span className="pprice num">{p.variants.length > 1 && <span className="xs muted" style={{ fontWeight: 600, fontFamily: "var(--font)" }}>from </span>}{inr(p.variants[0].price)}</span>
                          <button className="qadd" disabled={out} aria-label={`Quick add ${p.name}`} onClick={(e) => { e.stopPropagation(); if (available(p) < 1) return tapProduct(p); addLine(p, p.variants[0], []); }}>
                            <Icon name="plus" size={18} stroke={2.6} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty icon="search" title="No products match" sub="Try a different name or SKU, or clear the search." action={<button className="btn btn-outline btn-sm" onClick={() => setQ("")}>Clear search</button>} />
            )}
          </div>
        </main>

        {/* ---------- cart ---------- */}
        <aside className={cx("cart", cartOpen && "open")} aria-label="Current order" style={{ display: view === "sales" ? "none" : undefined }}>
          <div className="cart-head">
            <div className="row between">
              <div className="row g8">
                <span className="h2">Current order</span>
                <span className="badge b-ink num">{totals.itemCount}</span>
              </div>
              <div className="row g4">
                <button className="btn btn-ghost btn-sm" onClick={hold} disabled={!lines.length}><Icon name="pause" size={15} /><span className="lbl">Hold</span></button>
                <button className="btn btn-ghost btn-sm" onClick={clearCart} disabled={!lines.length} style={{ color: lines.length ? "var(--err)" : undefined }}><Icon name="trash" size={15} /><span className="lbl">Clear</span></button>
              </div>
            </div>
            {customer ? (
              <div className="row g6" style={{ marginTop: 10 }}>
                <button className="cust-chip set" style={{ marginTop: 0 }} onClick={() => setShowCust("search")}>
                  <span className="avatar">{initials(customer.name)}</span>
                  <span className="grow"><span className="semi" style={{ display: "block" }}>{customer.name}</span><span className="xs ink2 num">{customer.phone} · <Icon name="star" size={11} style={{ verticalAlign: -1 }} /> {customer.points} pts</span></span>
                  <span className="xs semi">Change</span>
                </button>
                <button className="btn btn-outline btn-icon" style={{ height: 52 }} onClick={() => setShowCust("edit")} title="Edit customer details" aria-label="Edit customer details"><Icon name="edit" size={16} /></button>
              </div>
            ) : (
              <div className="row g6" style={{ marginTop: 10 }}>
                <button className="cust-chip" style={{ marginTop: 0 }} onClick={() => setShowCust("new")}>
                  <span className="avatar"><Icon name="userPlus" size={16} /></span>
                  <span className="grow"><span className="semi" style={{ display: "block" }}>Add customer</span><span className="xs muted">Fill in name, mobile & details</span></span>
                  <Icon name="chevronRight" size={16} />
                </button>
                <button className="btn btn-outline" style={{ height: 52 }} onClick={() => setShowCust("search")} title="Find an existing customer"><Icon name="search" size={16} /><span className="lbl">Find</span></button>
              </div>
            )}
          </div>

          <div className="cart-lines scroll">
            {lines.length ? lines.map((l) => {
              const p = db.products.find((x) => x.id === l.productId);
              return (
                <div key={l.key} className="cline">
                  <div className="thumb">{p && <ProductArt art={p.art} image={p.image} rounded={0} />}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="semi" style={{ lineHeight: 1.25 }}>{l.name}</div>
                    <div className="xs muted">{l.variant} · {inr(l.unitPrice)}</div>
                    {l.addOns.length > 0 && <div className="xs ink2">+ {l.addOns.map((a) => a.name).join(", ")}</div>}
                    <div className="stepper mt8">
                      <button onClick={() => setQty(l.key, l.qty - 1)} aria-label="Decrease quantity"><Icon name={l.qty === 1 ? "trash" : "minus"} size={15} /></button>
                      <span>{l.qty}</span>
                      <button onClick={() => setQty(l.key, l.qty + 1)} aria-label="Increase quantity"><Icon name="plus" size={15} /></button>
                    </div>
                  </div>
                  <div className="col" style={{ alignItems: "flex-end", gap: 2 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 26, height: 26, color: "var(--muted)" }} onClick={() => setQty(l.key, 0)} aria-label={`Remove ${l.name}`}><Icon name="x" size={14} /></button>
                    <b className="num" style={{ marginTop: 18 }}>{inr(l.qty * l.unitPrice)}</b>
                  </div>
                </div>
              );
            }) : (
              <Empty icon="bag" title="Cart is empty" sub="Tap a product to start the order. Shortcuts: F2 search · F9 pay." />
            )}
          </div>

          <div className="cart-sum">
            {lines.length > 0 && (
              <>
                {!coupon ? (
                  <div className="coupon-row">
                    <div className="search grow"><Icon name="tag" size={16} />
                      <input className="input" style={{ height: 36, textTransform: "uppercase" }} placeholder="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyCoupon()} aria-label="Coupon code" />
                    </div>
                    <button className="btn btn-outline btn-sm" style={{ height: 36 }} onClick={applyCoupon} disabled={!couponInput.trim()}>Apply</button>
                  </div>
                ) : null}
                {customer && L.enabled && (totals.maxRedeemBlocks > 0 || redeem > 0) && (
                  <div className="soft row between" style={{ padding: "8px 10px", marginBottom: 8 }}>
                    <span className="small"><b>Redeem points</b><span className="ink2"> · {L.redeemPoints} pts = ₹{L.redeemValue}</span></span>
                    <div className="stepper" style={{ height: 28 }}>
                      <button style={{ width: 26, height: 26 }} onClick={() => setRedeem((r) => Math.max(0, r - 1))} disabled={!redeem} aria-label="Redeem fewer"><Icon name="minus" size={13} /></button>
                      <span className="small">{redeem}</span>
                      <button style={{ width: 26, height: 26 }} onClick={() => setRedeem((r) => Math.min(totals.maxRedeemBlocks, r + 1))} disabled={redeem >= totals.maxRedeemBlocks} aria-label="Redeem more"><Icon name="plus" size={13} /></button>
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="sum-row"><span className="ink2">Subtotal</span><span className="num">{inr2(totals.subtotal)}</span></div>
            {totals.discounts.map((d) => (
              <div key={d.id} className="sum-row">
                <span className="applied"><span className="badge b-soft" style={{ height: 20 }}><Icon name="tag" size={11} />{d.label}</span>
                  {coupon && d.id === db.offers.find((o) => o.code?.toUpperCase() === coupon)?.id && <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 22, height: 22 }} onClick={() => { setCoupon(""); setCouponInput(""); }} aria-label="Remove coupon"><Icon name="x" size={12} /></button>}
                </span>
                <span className="num ok">−{inr2(d.amount)}</span>
              </div>
            ))}
            {totals.pointsValue > 0 && <div className="sum-row"><span className="applied"><span className="badge b-soft" style={{ height: 20 }}><Icon name="star" size={11} />Loyalty · {totals.pointsUsed} pts</span></span><span className="num ok">−{inr2(totals.pointsValue)}</span></div>}
            <div className="sum-row"><span className="ink2">CGST {db.settings.taxRate / 2}%</span><span className="num">{inr2(totals.cgst)}</span></div>
            <div className="sum-row"><span className="ink2">SGST {db.settings.taxRate / 2}%</span><span className="num">{inr2(totals.sgst)}</span></div>
            {totals.roundOff !== 0 && <div className="sum-row"><span className="ink2">Round off</span><span className="num">{totals.roundOff > 0 ? "+" : "−"}{inr2(Math.abs(totals.roundOff))}</span></div>}
            <div className="total-box">
              <div><div className="semi">Total payable</div>{customer && totals.earn > 0 && <div className="xs ink2">Earns {totals.earn} pts</div>}</div>
              <span className="tv num">{inr(totals.total)}</span>
            </div>
            <button className="btn btn-primary btn-xl btn-block mt12" disabled={!lines.length} onClick={startPayment}>
              Proceed to payment <kbd style={{ marginLeft: 4, background: "rgba(255,255,255,.5)" }}>F9</kbd>
            </button>
          </div>
        </aside>
      </div>

      <CustomizeModal product={customizing} toppings={toppings} maxQty={customizing ? available(customizing) : 0} onClose={() => setCustomizing(null)} onAdd={addLine} />
      <CustomerModal key={showCust ?? "c"} open={!!showCust} initialMode={showCust ?? "search"} onClose={() => setShowCust(null)} selectedId={customerId} onSelect={(id) => { setCustomerId(id); setRedeem(0); }} />
      {paying && (
        <PaymentModal billNo={paying.billNo} lines={lines} totals={totals} customer={customer} settings={db.settings} cashierName={staff.name}
          onClose={() => { setPaying(null); setPay(null); }} onStatus={onPayStatus} onComplete={onComplete} onNewOrder={newOrder} />
      )}
      {!shift && !closing && <OpenShiftModal staff={staff} onCancel={signOut} />}
      {closing && shift && <CloseShiftModal shift={shift} staff={staff} onClose={() => setClosing(false)} onDone={() => { setClosing(false); router.push("/"); }} />}
    </div>
  );
}
