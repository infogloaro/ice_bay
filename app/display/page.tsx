"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon, Logo } from "@/components/Icon";
import { ProductArt } from "@/components/ProductArt";
import { QRCode } from "@/components/Receipt";
import { useClock } from "@/components/ui";
import { useDB } from "@/lib/store";
import { useDisplayState } from "@/lib/sync";
import { describeOffer, offerLive } from "@/lib/calc";
import { inr, inr2 } from "@/lib/util";

export default function CustomerDisplay() {
  const s = useDisplayState();
  const db = useDB();
  const now = useClock(30000);
  const featured = useMemo(() => db.products.filter((p) => p.featured && p.active && p.stock > 0), [db.products]);
  const promos = useMemo(() => db.offers.filter((o) => offerLive(o, now)).slice(0, 3), [db.offers, now]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), Math.max(3, db.settings.display.rotateSec) * 1000);
    return () => clearInterval(t);
  }, [db.settings.display.rotateSec]);
  const hero = featured.length ? featured[i % featured.length] : null;
  const D = db.settings.display;
  const fs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());

  const words = D.headline.split(" ");
  const hlIdx = words.findIndex((w) => /moment/i.test(w));

  return (
    <div className="cd">
      <header className="cd-top">
        <Logo size={44} sub={db.settings.tagline} />
        <div className="row g16">
          {s.customerFirstName && s.mode !== "idle" && (
            <span className="badge b-soft" style={{ height: 34, fontSize: 14, padding: "0 14px" }}><Icon name="star" size={15} />Hi {s.customerFirstName}{s.points !== undefined ? ` · ${s.points} pts` : ""}</span>
          )}
          <span className="semi ink2 num" style={{ fontSize: 18 }}>{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          <button className="btn btn-ghost btn-icon" onClick={fs} aria-label="Toggle full screen" title="Full screen"><Icon name="maximize" /></button>
        </div>
      </header>

      {s.mode === "idle" && (
        <>
          <section className="cd-idle">
            <div className="cd-hero-l">
              <span className="eyebrow" style={{ fontSize: 13 }}>Welcome to {db.settings.shopName}</span>
              <h1 className="cd-headline">
                {words.map((w, k) => <span key={k}>{k === hlIdx ? <mark>{w}</mark> : w}{" "}</span>)}
              </h1>
              <p style={{ fontSize: 20, color: "var(--ink2)", margin: 0, maxWidth: 520 }}>{D.subheadline}</p>
              {D.showPromos && promos.length > 0 && (
                <div className="cd-promos">
                  {promos.map((o) => (
                    <div key={o.id} className="cd-promo">
                      <div className="row g6 xs semi" style={{ color: "#6b4e00" }}><Icon name="tag" size={14} />{o.code ? `Use code ${o.code}` : "Today's offer"}</div>
                      <div className="display" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{describeOffer(o)}</div>
                      <div className="small ink2">{o.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="cd-hero-r">
              <div className="disc" />
              {hero && (
                <>
                  <div key={hero.id} className="cd-feature" style={{ animation: "pop .6s ease" }}>
                    <ProductArt art={hero.art} image={hero.image} alt={hero.name} bg={false} rounded={24} />
                  </div>
                  <div className="card" style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", padding: "14px 22px", display: "flex", alignItems: "center", gap: 18, boxShadow: "var(--sh-3)", whiteSpace: "nowrap" }}>
                    <div><div className="xs muted semi">{hero.badge ?? "Featured"}</div><div className="h2">{hero.name}</div></div>
                    <div className="display num" style={{ fontSize: 28, fontWeight: 800 }}>{inr(hero.variants[0].price)}</div>
                  </div>
                </>
              )}
            </div>
          </section>
          <footer className="cd-strip">
            <span className="eyebrow nowrap">Fan favourites</span>
            {featured.slice(0, 6).map((p) => (
              <span key={p.id} className="row g8 nowrap">
                <span className="thumb" style={{ width: 40, height: 32 }}><ProductArt art={p.art} image={p.image} rounded={0} /></span>
                <span className="semi">{p.name}</span><span className="muted num">{inr(p.variants[0].price)}</span>
              </span>
            ))}
          </footer>
        </>
      )}

      {s.mode === "order" && (
        <section className="cd-order">
          <div className="cd-lines scroll">
            <div className="row between" style={{ marginBottom: 8 }}>
              <h2 className="h1">Your order</h2>
              <span className="badge b-ink num" style={{ height: 30, fontSize: 14, padding: "0 12px" }}>{s.itemCount} items</span>
            </div>
            {s.lines.map((l, k) => (
              <div key={k + l.name + l.variant} className="cd-line">
                <div className="thumb"><ProductArt art={l.art} image={l.image} rounded={0} /></div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{l.name}</div>
                  <div className="ink2" style={{ fontSize: 16 }}>{l.variant}{l.addOns.length ? ` · + ${l.addOns.join(", ")}` : ""}</div>
                </div>
                <div className="right">
                  <div className="num ink2" style={{ fontSize: 16 }}>× {l.qty}</div>
                  <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{inr(l.amount)}</div>
                </div>
              </div>
            ))}
          </div>
          <aside className="cd-side">
            <Totals s={s} />
          </aside>
        </section>
      )}

      {s.mode === "payment" && (
        <section className="cd-center">
          <span className="eyebrow" style={{ fontSize: 14 }}>Amount payable · {s.billNo}</span>
          <div className="cd-amount num">{inr(s.total)}</div>
          {s.method === "upi" && s.qr && (
            <div className="row g24 start" style={{ textAlign: "left" }}>
              <div className="qr-box" style={{ padding: 18 }}><QRCode text={s.qr} size={280} /></div>
              <div className="col g12" style={{ maxWidth: 320 }}>
                <div className="h1">Scan to pay</div>
                <div style={{ fontSize: 18 }} className="ink2">Open GPay, PhonePe, Paytm or any UPI app and scan this code.</div>
                <PayStatus status={s.paymentStatus} />
              </div>
            </div>
          )}
          {s.method === "card" && (
            <div className="col g12" style={{ alignItems: "center" }}>
              <div className="kpi ic" style={{ width: 84, height: 84, borderRadius: 24, display: "grid", placeItems: "center", background: "var(--yellow-soft)", border: "1px solid var(--yellow-line)" }}><Icon name="card" size={42} /></div>
              <div className="h1">Tap, insert or swipe your card</div>
              <PayStatus status={s.paymentStatus === "idle" ? "waiting" : s.paymentStatus} card />
            </div>
          )}
          {s.method === "cash" && (
            <div className="col g12" style={{ alignItems: "center" }}>
              <div className="h1">Paying by cash</div>
              {!!s.cashReceived && (
                <div className="row g24">
                  <div className="panel" style={{ padding: "14px 22px" }}><div className="small ink2 semi">Received</div><div className="display num" style={{ fontSize: 34, fontWeight: 800 }}>{inr2(s.cashReceived)}</div></div>
                  <div className="soft" style={{ padding: "14px 22px" }}><div className="small ink2 semi">Your change</div><div className="display num" style={{ fontSize: 34, fontWeight: 800 }}>{inr2(s.change ?? 0)}</div></div>
                </div>
              )}
            </div>
          )}
          {s.method === "other" && <div className="h1">Paying with {s.methodLabel}</div>}
        </section>
      )}

      {s.mode === "success" && (
        <section className="cd-center">
          <div className="success-mark" style={{ width: 120, height: 120 }}><Icon name="check" size={64} stroke={3} /></div>
          <div className="cd-headline" style={{ fontSize: "clamp(48px, 6vw, 92px)" }}>Thank you{s.customerFirstName ? `, ${s.customerFirstName}` : ""}!</div>
          <div style={{ fontSize: 22 }} className="ink2">Payment of <b className="num" style={{ color: "var(--ink)" }}>{inr(s.total)}</b> received{s.methodLabel ? ` via ${s.methodLabel}` : ""} · Bill {s.billNo}</div>
          {!!s.earn && s.customerFirstName && <span className="badge b-yellow" style={{ height: 40, fontSize: 17, padding: "0 18px" }}><Icon name="star" size={18} />You earned {s.earn} loyalty points</span>}
          <div className="h2 ink2" style={{ fontWeight: 600 }}>Enjoy your treat — see you again soon!</div>
        </section>
      )}
    </div>
  );
}

function PayStatus({ status, card }: { status?: string; card?: boolean }) {
  if (status === "failed") return <div className="status-line bad" style={{ fontSize: 17 }}><Icon name="alert" />Payment didn&apos;t go through. Please try again.</div>;
  if (status === "processing") return <div className="status-line wait" style={{ fontSize: 17 }}><span className="spinner" />{card ? "Processing — please don't remove your card" : "Confirming your payment…"}</div>;
  if (status === "verified") return <div className="status-line okk" style={{ fontSize: 17 }}><Icon name="check" />Payment received</div>;
  return <div className="status-line wait" style={{ fontSize: 17 }}><span className="spinner" />Waiting for payment…</div>;
}

function Totals({ s }: { s: ReturnType<typeof useDisplayState> }) {
  return (
    <>
      <div className="h2">Bill summary</div>
      <div className="col g6" style={{ fontSize: 18 }}>
        <div className="row between"><span className="ink2">Subtotal</span><span className="num semi">{inr2(s.subtotal)}</span></div>
        {s.discounts.map((d, k) => <div key={k} className="row between"><span className="ink2">{d.label}</span><span className="num semi ok">−{inr2(d.amount)}</span></div>)}
        <div className="row between"><span className="ink2">{s.taxLabel}</span><span className="num semi">{inr2(s.tax)}</span></div>
        {s.roundOff !== 0 && <div className="row between"><span className="ink2">Round off</span><span className="num semi">{s.roundOff > 0 ? "+" : "−"}{inr2(Math.abs(s.roundOff))}</span></div>}
      </div>
      {s.discounts.length > 0 && (
        <div className="soft row g8" style={{ padding: "10px 14px", fontSize: 15 }}><Icon name="sparkle" />You save <b className="num">{inr2(s.discounts.reduce((a, d) => a + d.amount, 0))}</b> on this order</div>
      )}
      <div className="cd-total">
        <div className="semi ink2" style={{ fontSize: 18 }}>Total to pay</div>
        <div className="v num">{inr(s.total)}</div>
        {!!s.earn && s.customerFirstName && <div className="small ink2 mt8">You&apos;ll earn {s.earn} points with this order</div>}
      </div>
    </>
  );
}
