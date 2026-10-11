"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Bill, CartLine, Customer, PayMethod, Settings } from "@/lib/types";
import type { Totals } from "@/lib/calc";
import { Icon } from "../Icon";
import { Receipt, QRCode, upiPayload } from "../Receipt";
import { cx, inr, inr2 } from "@/lib/util";

export type PayStatus = "idle" | "waiting" | "processing" | "failed" | "verified";

export function PaymentModal({ billNo, lines, totals, customer, settings, cashierName, onClose, onStatus, onComplete, onNewOrder }: {
  billNo: string; lines: CartLine[]; totals: Totals; customer?: Customer | null; settings: Settings; cashierName: string;
  onClose: () => void;
  onStatus: (s: { method: PayMethod; methodLabel: string; status: PayStatus; qr?: string; cashReceived?: number; change?: number }) => void;
  onComplete: (p: { method: PayMethod; methodLabel?: string; ref?: string; cashReceived?: number; change?: number }) => Bill;
  onNewOrder: () => void;
}) {
  const enabled = (["cash", "upi", "card", "other"] as PayMethod[]).filter((m) => settings.methods[m]);
  const [method, setMethod] = useState<PayMethod>(enabled.includes("upi") ? "upi" : enabled[0]);
  const [status, setStatus] = useState<PayStatus>("idle");
  const [cash, setCash] = useState("");
  const [gift, setGift] = useState("");
  const [autoVerify, setAutoVerify] = useState(true);
  const [error, setError] = useState("");
  const [bill, setBill] = useState<Bill | null>(null);
  const [rw, setRw] = useState<"58" | "80">(settings.receiptWidth);
  const lock = useRef(false);
  const timers = useRef<number[]>([]);
  const total = totals.total;
  const qr = useMemo(() => upiPayload(settings, total, billNo), [settings, total, billNo]);
  const received = Number(cash || 0);
  const change = Math.max(0, received - total);
  const label = method === "cash" ? "Cash" : method === "upi" ? "UPI" : method === "card" ? "Card" : settings.otherMethodName;

  const clearTimers = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = []; };
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => clearTimers, []);

  // UPI: show QR and wait for the (simulated) bank confirmation.
  useEffect(() => {
    clearTimers(); setError("");
    if (bill) return;
    if (method === "upi") {
      setStatus("waiting");
      if (autoVerify) later(() => setStatus((s) => (s === "waiting" ? "processing" : s)), 5000);
    } else setStatus("idle");
  }, [method, autoVerify, bill]);

  useEffect(() => {
    if (status === "processing" && method === "upi") later(() => setStatus("verified"), 1300);
  }, [status, method]);

  // Mirror payment state on the customer display.
  useEffect(() => {
    onStatus({ method, methodLabel: label, status, qr: method === "upi" ? qr : undefined, cashReceived: method === "cash" ? received : undefined, change: method === "cash" ? change : undefined });
  }, [method, status, qr, received, change, label, onStatus]);

  // Only a verified payment creates the bill — exactly once.
  useEffect(() => {
    if (status !== "verified" || lock.current) return;
    lock.current = true;
    const ref = method === "upi" ? "UPI" + String(Math.floor(Math.random() * 1e12)).padStart(12, "0")
      : method === "card" ? `AUTH${Math.floor(100000 + Math.random() * 899999)} ••${Math.floor(1000 + Math.random() * 8999)}`
      : method === "other" ? "GC-" + gift.slice(-6).toUpperCase() : undefined;
    const b = onComplete({ method, methodLabel: label, ref, cashReceived: method === "cash" ? received : undefined, change: method === "cash" ? change : undefined });
    setBill(b);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter" && bill) { e.preventDefault(); onNewOrder(); }
      if (e.key === "Escape" && !bill && status !== "processing") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [bill, status, onNewOrder, onClose]);

  const busy = status === "processing";
  const keypad = (k: string) => {
    if (k === "del") return setCash((c) => c.slice(0, -1));
    if (k === "." && cash.includes(".")) return;
    setCash((c) => (c + k).replace(/^0+(?=\d)/, "").slice(0, 8));
  };
  const quick = useMemo(() => {
    const s = new Set<number>([total]);
    [50, 100, 200, 500, 2000].forEach((n) => { const v = Math.ceil(total / n) * n; if (v >= total) s.add(v); });
    return [...s].sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  if (bill) {
    return (
      <div className="backdrop">
        <div className="modal pay pay-done" style={{ width: "min(980px, 100%)", gridTemplateColumns: "1fr 380px" }}>
          <div className="pay-main" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 10 }}>
            <div className="success-mark"><Icon name="check" size={44} stroke={3} /></div>
            <div className="h1 mt8">Payment successful</div>
            <div className="ink2">{bill.no} · {label}{bill.ref ? ` · ${bill.ref}` : ""}</div>
            <div className="display num" style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.03em" }}>{inr(bill.total)}</div>
            {bill.method === "cash" && (
              <div className="soft" style={{ padding: "12px 20px" }}>
                <div className="xs semi ink2">Change to return</div>
                <div className="display num" style={{ fontSize: 30, fontWeight: 800 }}>{inr2(bill.change ?? 0)}</div>
              </div>
            )}
            {customer && bill.pointsEarned > 0 && <div className="badge b-soft" style={{ height: 28, fontSize: 13 }}><Icon name="star" size={14} />{customer.name.split(" ")[0]} earned {bill.pointsEarned} points</div>}
            <div className="row g12 mt16">
              <button className="btn btn-outline btn-lg" onClick={() => window.print()}><Icon name="printer" />Print receipt</button>
              <button className="btn btn-primary btn-lg" onClick={onNewOrder} autoFocus>New order <kbd>Enter</kbd></button>
            </div>
          </div>
          <div className="pay-sum scroll" style={{ borderRight: 0, borderLeft: "1px solid var(--line)", maxHeight: "86vh" }}>
            <div className="row between"><span className="h4">Receipt preview</span>
              <div className="pill-tabs">{(["58", "80"] as const).map((w) => <button key={w} className={cx(rw === w && "on")} onClick={() => setRw(w)}>{w} mm</button>)}</div>
            </div>
            <div style={{ transform: rw === "80" ? "scale(.92)" : undefined, transformOrigin: "top center" }}>
              <Receipt bill={bill} settings={settings} customer={customer ?? undefined} cashier={cashierName} width={rw} />
            </div>
          </div>
          <div className="print-only"><Receipt bill={bill} settings={settings} customer={customer ?? undefined} cashier={cashierName} width={rw} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop">
      <div className="modal pay" role="dialog" aria-modal="true" aria-label="Payment">
        <aside className="pay-sum">
          <div className="row between">
            <span className="eyebrow">Bill {billNo}</span>
            <span className="badge b-out">{totals.itemCount} items</span>
          </div>
          <div className="col g6 scroll" style={{ maxHeight: 220 }}>
            {lines.map((l) => (
              <div key={l.key} className="row between small g12">
                <span className="ellipsis"><b className="num">{l.qty}×</b> {l.name} <span className="muted">{l.variant}</span></span>
                <span className="num semi">{inr(l.qty * l.unitPrice)}</span>
              </div>
            ))}
          </div>
          <div className="divider" style={{ margin: "4px 0" }} />
          <div className="sum-row"><span className="ink2">Subtotal</span><span className="num">{inr2(totals.subtotal)}</span></div>
          {totals.discounts.map((d) => <div key={d.id} className="sum-row"><span className="ink2">{d.label}</span><span className="num ok">−{inr2(d.amount)}</span></div>)}
          {totals.pointsValue > 0 && <div className="sum-row"><span className="ink2">Loyalty ({totals.pointsUsed} pts)</span><span className="num ok">−{inr2(totals.pointsValue)}</span></div>}
          <div className="sum-row"><span className="ink2">GST {settings.taxRate}% (CGST + SGST){settings.taxInclusive ? " incl." : ""}</span><span className="num">{inr2(totals.tax)}</span></div>
          {totals.roundOff !== 0 && <div className="sum-row"><span className="ink2">Round off</span><span className="num">{totals.roundOff > 0 ? "+" : "−"}{inr2(Math.abs(totals.roundOff))}</span></div>}
          <div className="total-box" style={{ marginTop: "auto" }}>
            <span className="semi">Payable</span>
            <span className="tv num">{inr(total)}</span>
          </div>
          {customer && <div className="small ink2 row g6"><Icon name="user" size={14} />{customer.name} · +{totals.earn} pts on this bill</div>}
        </aside>

        <section className="pay-main">
          <div className="row between">
            <div className="h2">Collect payment</div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}><Icon name="arrowLeft" size={16} />Back to order</button>
          </div>
          <div className="methods mt16">
            {enabled.map((m) => (
              <button key={m} className={cx("method", method === m && "on")} onClick={() => !busy && setMethod(m)} disabled={busy && method !== m}>
                <Icon name={m === "cash" ? "cash" : m === "upi" ? "qr" : m === "card" ? "card" : "gift"} size={22} />
                {m === "cash" ? "Cash" : m === "upi" ? "UPI" : m === "card" ? "Card" : settings.otherMethodName}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, marginTop: 20 }}>
            {method === "cash" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20 }}>
                <div className="col g12">
                  <div className="field">
                    <label>Amount received</label>
                    <div className="input input-lg num row" style={{ fontSize: 28, height: 64, fontWeight: 800 }}>₹{cash || <span className="muted">0</span>}</div>
                  </div>
                  <div className="qbtns">{quick.map((v) => <button key={v} onClick={() => setCash(String(v))}>{v === total ? "Exact " : ""}{inr(v)}</button>)}</div>
                  <div className={cx("status-line", received >= total ? "okk" : "wait")} style={{ justifyContent: "space-between", marginTop: 4 }}>
                    <span>{received >= total ? "Change to return" : received ? "Still due" : "Enter cash received"}</span>
                    <span className="display num" style={{ fontSize: 26, fontWeight: 800 }}>{inr2(received >= total ? change : Math.max(0, total - received))}</span>
                  </div>
                </div>
                <div className="keypad">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"].map((k) => (
                    <button key={k} onClick={() => keypad(k)} aria-label={k === "del" ? "Delete" : k}>{k === "del" ? <Icon name="arrowLeft" /> : k}</button>
                  ))}
                </div>
              </div>
            )}

            {method === "upi" && (
              <div className="row g24 start wrap">
                <div className="qr-box"><QRCode text={qr} size={220} /></div>
                <div className="col g12" style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div><div className="xs semi ink2">Amount payable</div><div className="display num" style={{ fontSize: 38, fontWeight: 800 }}>{inr2(total)}</div></div>
                  <div className="small ink2">Ask the customer to scan with any UPI app — the QR is also on the customer display.</div>
                  {!settings.upiId && <div className="xs muted">Demo QR — add your UPI ID in Settings → Payments to make it live.</div>}
                  {status === "waiting" && <div className="status-line wait"><span className="spinner" />Waiting for payment confirmation…</div>}
                  {status === "processing" && <div className="status-line wait"><span className="spinner" />Verifying with bank…</div>}
                  {status === "failed" && <div className="status-line bad"><Icon name="alert" />Payment not received or declined. Ask the customer to retry.</div>}
                  <div className="row g8 wrap">
                    {status === "failed"
                      ? <button className="btn btn-primary" onClick={() => setStatus("waiting")}><Icon name="refresh" size={16} />Retry</button>
                      : <button className="btn btn-primary" disabled={busy} onClick={() => setStatus("processing")}><Icon name="check" size={16} />Check status</button>}
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { clearTimers(); setStatus("failed"); }}>Simulate failure</button>
                  </div>
                  <label className="row g8 xs ink2" style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={autoVerify} onChange={(e) => setAutoVerify(e.target.checked)} /> Auto-confirm after 5 s (demo)
                  </label>
                </div>
              </div>
            )}

            {method === "card" && (
              <div className="col g16" style={{ maxWidth: 520 }}>
                <div className="panel row g16" style={{ padding: 18 }}>
                  <div className="kpi ic" style={{ width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center", background: "var(--yellow-soft)", border: "1px solid var(--yellow-line)" }}><Icon name="card" size={26} /></div>
                  <div>
                    <div className="semi">{settings.cardTerminal}</div>
                    <div className="small ink2">Tap, insert or swipe the card on the terminal.</div>
                  </div>
                </div>
                <div><div className="xs semi ink2">Amount</div><div className="display num" style={{ fontSize: 38, fontWeight: 800 }}>{inr2(total)}</div></div>
                {status === "processing" && <div className="status-line wait"><span className="spinner" />Processing on terminal — do not remove card…</div>}
                {status === "failed" && <div className="status-line bad"><Icon name="alert" />{error || "Card declined by issuer. Try another card or method."}</div>}
                <div className="row g8">
                  <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => { setError(""); setStatus("processing"); later(() => setStatus((s) => (s === "processing" ? "verified" : s)), 2800); }}>
                    {status === "failed" ? "Retry on terminal" : "Send to terminal"}
                  </button>
                  {busy && <button className="btn btn-ghost btn-sm" onClick={() => { clearTimers(); setError("Card declined by issuer (demo)."); setStatus("failed"); }}>Simulate decline</button>}
                </div>
              </div>
            )}

            {method === "other" && (
              <div className="col g12" style={{ maxWidth: 440 }}>
                <div className="field">
                  <label>{settings.otherMethodName} number</label>
                  <input className="input input-lg" value={gift} onChange={(e) => setGift(e.target.value.toUpperCase())} placeholder="e.g. ICEB-4821-7730" autoFocus />
                  <span className="hint">Demo: any code of 6+ characters is accepted.</span>
                </div>
                {status === "processing" && <div className="status-line wait"><span className="spinner" />Validating…</div>}
              </div>
            )}
          </div>

          {(method === "cash" || method === "other") && (
            <button className="btn btn-primary btn-xl btn-block mt16" disabled={busy || (method === "cash" ? received < total : gift.length < 6)}
              onClick={() => { if (method === "cash") setStatus("verified"); else { setStatus("processing"); later(() => setStatus("verified"), 900); } }}>
              <Icon name="check" />Confirm {inr(total)} {method === "cash" ? "cash payment" : "payment"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
