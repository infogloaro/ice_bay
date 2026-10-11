"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon, Logo } from "@/components/Icon";
import { ProductArt } from "@/components/ProductArt";
import { addAudit, setDB, useDB } from "@/lib/store";
import { cx, initials } from "@/lib/util";

export default function Login() {
  const db = useDB();
  const router = useRouter();
  const staff = db.staff.filter((s) => s.active);
  const [sel, setSel] = useState(staff.find((s) => s.role === "Cashier")?.id ?? staff[0]?.id);
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  const who = staff.find((s) => s.id === sel);

  const press = (k: string) => {
    setBad(false);
    if (k === "del") return setPin((p) => p.slice(0, -1));
    if (k === "clr") return setPin("");
    setPin((p) => (p.length < 4 ? p + k : p));
  };

  useEffect(() => {
    if (pin.length !== 4 || !who) return;
    if (pin === who.pin) {
      setPin("");
      setDB((d) => { d.session.staffId = who.id; addAudit(d, "Signed in", `${who.name} (${who.role})`); });
      router.push(who.role === "Cashier" ? "/pos" : "/admin");
    } else {
      setBad(true);
      setTimeout(() => setPin(""), 350);
    }
  }, [pin, who, router]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") press("del");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const featured = db.products.filter((p) => p.featured).slice(0, 4);

  return (
    <main className="login">
      <section className="login-art">
        <Logo size={44} sub="Point of Sale" onYellow />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 className="display" style={{ fontSize: "clamp(36px, 4.4vw, 64px)", lineHeight: 1, margin: 0, fontWeight: 800, letterSpacing: "-0.035em" }}>
            Billing that keeps<br />up with the queue.
          </h1>
          <p style={{ fontSize: 16, maxWidth: 440, marginTop: 16, color: "#3d2e00", fontWeight: 500 }}>
            Ring up fruit pops, mocktail pops and party boxes in seconds, show customers their order live, and see the day&apos;s numbers as they happen.
          </p>
        </div>
        <div className="row g12 wrap hide-sm" style={{ position: "relative", zIndex: 1 }}>
          {featured.map((p) => (
            <div key={p.id} style={{ width: 120, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.08)" }}>
              <div style={{ aspectRatio: "4/3" }}><ProductArt art={p.art} image={p.image} rounded={0} /></div>
              <div style={{ padding: "6px 10px 8px" }} className="xs semi ellipsis">{p.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="login-form">
        <div style={{ width: "min(440px, 100%)" }}>
          <div className="eyebrow">Staff sign-in</div>
          <h2 className="h1" style={{ marginTop: 6 }}>Who&apos;s on the counter?</h2>
          <div className="staff-pick mt24">
            {staff.map((s) => (
              <button key={s.id} className={cx("staff-btn", sel === s.id && "on")} onClick={() => { setSel(s.id); setPin(""); setBad(false); }}>
                <span className="avatar">{initials(s.name)}</span>
                <span className="grow">
                  <span className="semi ellipsis" style={{ display: "block" }}>{s.name.split(" ")[0]}</span>
                  <span className="xs muted">{s.role} · PIN {s.pin}</span>
                </span>
              </button>
            ))}
          </div>

          <div className={cx("mt24 center", bad && "shake-x")}>
            <div className="small ink2 semi">Enter 4-digit PIN for {who?.name.split(" ")[0]}</div>
            <div className="pin-dots mt12">{[0, 1, 2, 3].map((i) => <span key={i} className={cx(i < pin.length && "f")} style={bad ? { borderColor: "var(--err)", background: i < pin.length ? "var(--err)" : undefined } : undefined} />)}</div>
            <div className="small err semi mt8" style={{ height: 18 }}>{bad ? "Incorrect PIN. Try again." : ""}</div>
          </div>

          <div className="keypad mt8">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clr", "0", "del"].map((k) => (
              <button key={k} onClick={() => press(k)} aria-label={k === "del" ? "Delete" : k === "clr" ? "Clear" : k}>
                {k === "del" ? <Icon name="arrowLeft" /> : k === "clr" ? <span className="small semi">Clear</span> : k}
              </button>
            ))}
          </div>

          <div className="panel mt24" style={{ padding: 14 }}>
            <div className="row between g12">
              <div>
                <div className="semi">Customer display</div>
                <div className="xs muted">Open on the second screen facing customers</div>
              </div>
              <Link href="/display" target="_blank" className="btn btn-outline btn-sm"><Icon name="monitor" size={16} />Open</Link>
            </div>
          </div>
          <p className="xs muted center mt16">Demo prototype · data is stored in this browser only</p>
        </div>
      </section>
    </main>
  );
}
