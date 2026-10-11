"use client";
import { useState } from "react";
import Link from "next/link";
import { Page } from "@/components/admin";
import { Icon, Logo } from "@/components/Icon";
import { Receipt } from "@/components/Receipt";
import { Field, SettingRow, Switch, confirmDialog, toast } from "@/components/ui";
import { addAudit, getDB, replaceDB, resetDB, setDB, useDB } from "@/lib/store";
import type { Bill, DB, Settings } from "@/lib/types";
import { DB_VERSION } from "@/lib/data";
import { cx, downloadFile, ymd } from "@/lib/util";

type Sec = "shop" | "brand" | "tax" | "receipt" | "payments" | "inventory" | "display" | "notify" | "data";
const SECS: [Sec, string, string][] = [
  ["shop", "Shop profile", "store"], ["brand", "Branding", "palette"], ["tax", "Tax & currency", "percent"], ["receipt", "Receipt printing", "printer"],
  ["payments", "Payment methods", "wallet"], ["inventory", "Inventory rules", "box"], ["display", "Customer display", "monitor"],
  ["notify", "Notifications", "bell"], ["data", "Data & backup", "database"],
];

const sample = (s: Settings): Bill => {
  const sub = 330, disc = 26, taxable = sub - disc, tax = Math.round(taxable * s.taxRate) / 100, total = Math.round(taxable + tax);
  return {
    id: "x", no: "IB-24117", date: new Date().toISOString(), status: "paid", method: "upi", ref: "UPI628193047215", cashierId: "",
    lines: [{ productId: "", categoryId: "", name: "Mango", variant: "Single", qty: 1, unitPrice: 70 }, { productId: "", categoryId: "", name: "Mojito", variant: "Pack of 4", qty: 1, unitPrice: 260 }],
    subtotal: sub, discounts: [{ id: "o", label: "Mocktail Hour", amount: disc }], discount: disc, taxable, tax, roundOff: Math.round((total - taxable - tax) * 100) / 100, total, pointsEarned: 0, pointsRedeemed: 0,
  };
};

export default function SettingsPage() {
  const db = useDB();
  const [sec, setSec] = useState<Sec>("shop");
  const [s, setS] = useState<Settings>(db.settings);
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings);
  const up = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));

  const save = () => {
    if (!(s.taxRate >= 0 && s.taxRate <= 28)) return toast("GST rate must be between 0 and 28%", "err");
    if (!Object.values(s.methods).some(Boolean)) return toast("Keep at least one payment method enabled", "err");
    if (s.upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(s.upiId)) return toast("UPI ID looks invalid (e.g. icebay@okaxis)", "err");
    setDB((d) => { d.settings = { ...s, permissions: d.settings.permissions }; addAudit(d, "Settings updated", SECS.find((x) => x[0] === sec)?.[1] ?? ""); });
    toast("Settings saved");
  };

  const exportData = () => { downloadFile(`icebay-backup-${ymd(new Date())}.json`, JSON.stringify(getDB(), null, 2), "application/json"); toast("Backup downloaded"); };
  const importData = (f: File) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const next = JSON.parse(String(r.result)) as DB;
        if (next.version !== DB_VERSION || !Array.isArray(next.products)) throw new Error();
        if (!(await confirmDialog({ title: "Restore this backup?", body: "Current demo data in this browser will be replaced.", confirm: "Restore" }))) return;
        replaceDB({ ...next, session: getDB().session });
        setS(next.settings);
        toast("Backup restored");
      } catch { toast("That file isn't a valid ICE BAY backup", "err"); }
    };
    r.readAsText(f);
  };
  const reset = async () => {
    if (!(await confirmDialog({ title: "Reset all demo data?", body: "Products, customers, offers, bills you created and settings return to the original demo state. You'll be signed out.", confirm: "Reset demo", danger: true }))) return;
    resetDB();
    try { sessionStorage.clear(); localStorage.removeItem("icebay-display"); } catch { /* ignore */ }
    window.location.href = "/";
  };

  return (
    <Page perm="settings" title="Settings" sub="Configure the shop, billing and devices">
      <div className="tabs" style={{ marginBottom: 16 }}>
        {SECS.map(([k, l, ic]) => <button key={k} className={cx(sec === k && "on")} onClick={() => setSec(k)}><span className="row g6"><Icon name={ic} size={15} />{l}</span></button>)}
      </div>

      <div className="grid" style={{ gridTemplateColumns: sec === "receipt" ? "minmax(0, 1fr) 360px" : "minmax(0, 1fr)", alignItems: "start", maxWidth: sec === "receipt" ? undefined : 860 }}>
        <div className="card card-pad">
          {sec === "shop" && (
            <div className="col g16">
              <div className="grid-2">
                <Field label="Shop name"><input className="input" value={s.shopName} onChange={(e) => up("shopName", e.target.value)} /></Field>
                <Field label="Tagline"><input className="input" value={s.tagline} onChange={(e) => up("tagline", e.target.value)} /></Field>
              </div>
              <Field label="Address"><textarea className="textarea" style={{ minHeight: 60 }} value={s.address} onChange={(e) => up("address", e.target.value)} /></Field>
              <div className="grid-2">
                <Field label="Phone"><input className="input" value={s.phone} onChange={(e) => up("phone", e.target.value)} /></Field>
                <Field label="Email"><input className="input" value={s.email} onChange={(e) => up("email", e.target.value)} /></Field>
                <Field label="GSTIN"><input className="input num" value={s.gstin} onChange={(e) => up("gstin", e.target.value.toUpperCase())} maxLength={15} /></Field>
                <Field label="FSSAI licence no."><input className="input num" value={s.fssai} onChange={(e) => up("fssai", e.target.value)} /></Field>
              </div>
            </div>
          )}

          {sec === "brand" && (
            <div className="col g16">
              <div className="row g24 wrap">
                <div className="panel" style={{ padding: 20 }}><Logo size={52} sub={s.tagline} /></div>
                <div className="panel" style={{ padding: 20, background: "#FFC629", borderColor: "#ecb20f" }}><Logo size={52} onYellow sub="On brand yellow" /></div>
              </div>
              <div>
                <div className="label">Brand palette (light theme)</div>
                <div className="row g12 wrap mt8">
                  {[["#FFC629", "Brand yellow"], ["#FFD45C", "Hover yellow"], ["#FFF6DC", "Soft yellow"], ["#13284B", "Primary navy"], ["#FFFFFF", "Background"], ["#F3F6FA", "Secondary bg"], ["#E8E8E8", "Border"], ["#16864A", "Success"], ["#D92D20", "Error"]].map(([c, n]) => (
                    <div key={c} className="col g4" style={{ width: 92 }}><span style={{ height: 44, borderRadius: 10, background: c, border: "1px solid var(--line)" }} /><span className="xs semi">{n}</span><span className="xs muted num">{c}</span></div>
                  ))}
                </div>
              </div>
              <div className="soft small" style={{ padding: "10px 14px" }}>ICE BAY uses a light theme everywhere. Black is reserved for text and accents, yellow for actions, highlights and selected states.</div>
            </div>
          )}

          {sec === "tax" && (
            <div className="col">
              <div className="grid-3" style={{ marginBottom: 8 }}>
                <Field label="GST rate %" hint={`Split as CGST ${s.taxRate / 2}% + SGST ${s.taxRate / 2}%`}><input className="input num" inputMode="decimal" value={s.taxRate} onChange={(e) => up("taxRate", Number(e.target.value.replace(/[^\d.]/g, "")))} /></Field>
                <Field label="HSN / SAC code"><input className="input num" value={s.hsn} onChange={(e) => up("hsn", e.target.value)} /></Field>
                <Field label="Currency"><select className="select" value={s.currency} disabled><option>INR</option></select></Field>
              </div>
              <SettingRow title="Prices include GST" sub="Off: GST is added on top of menu prices at checkout"><Switch on={s.taxInclusive} onChange={(v) => up("taxInclusive", v)} /></SettingRow>
              <SettingRow title="Round bill total to nearest ₹1" sub="Shows a round-off line on the bill"><Switch on={s.roundToRupee} onChange={(v) => up("roundToRupee", v)} /></SettingRow>
              <div className="xs muted mt12">Confirm the applicable GST rate for your products with your tax advisor before going live.</div>
            </div>
          )}

          {sec === "receipt" && (
            <div className="col">
              <div className="field" style={{ marginBottom: 8 }}><label>Paper width</label>
                <div className="pill-tabs" style={{ alignSelf: "flex-start" }}>{(["58", "80"] as const).map((w) => <button key={w} className={cx(s.receiptWidth === w && "on")} onClick={() => up("receiptWidth", w)}>{w} mm thermal</button>)}</div>
              </div>
              <SettingRow title="Print logo" sub="Monochrome logo at the top of the receipt"><Switch on={s.receiptShowLogo} onChange={(v) => up("receiptShowLogo", v)} /></SettingRow>
              <div className="grid-2 mt16">
                <Field label="Thank-you line"><input className="input" value={s.receiptHeader} onChange={(e) => up("receiptHeader", e.target.value)} /></Field>
                <Field label="Footer"><input className="input" value={s.receiptFooter} onChange={(e) => up("receiptFooter", e.target.value)} /></Field>
              </div>
              <div className="xs muted mt12">Printing uses the browser print dialog — select your thermal printer and set margins to “None”.</div>
            </div>
          )}

          {sec === "payments" && (
            <div className="col">
              {(["cash", "upi", "card", "other"] as const).map((m) => (
                <SettingRow key={m} title={m === "cash" ? "Cash" : m === "upi" ? "UPI (QR)" : m === "card" ? "Card terminal" : s.otherMethodName} sub={m === "upi" ? "Dynamic QR with the exact bill amount" : m === "card" ? "Integrated or standalone EDC terminal" : m === "other" ? "Gift cards, vouchers or wallets" : "Change calculation and drawer reconciliation"}>
                  <Switch on={s.methods[m]} onChange={(v) => up("methods", { ...s.methods, [m]: v })} />
                </SettingRow>
              ))}
              <div className="grid-3 mt16">
                <Field label="UPI ID (VPA)" hint="Leave empty for a demo QR"><input className="input" value={s.upiId} onChange={(e) => up("upiId", e.target.value.trim())} placeholder="icebay@okaxis" /></Field>
                <Field label="Card terminal name"><input className="input" value={s.cardTerminal} onChange={(e) => up("cardTerminal", e.target.value)} /></Field>
                <Field label="Other method label"><input className="input" value={s.otherMethodName} onChange={(e) => up("otherMethodName", e.target.value)} /></Field>
              </div>
              <div className="soft small mt16" style={{ padding: "10px 14px" }}><b>Prototype note:</b> payment confirmation is simulated. Production uses a payment gateway (e.g. Razorpay or PhonePe) to verify UPI and card payments server-side before a bill is marked paid.</div>
            </div>
          )}

          {sec === "inventory" && (
            <div className="col">
              <SettingRow title="Block sales when out of stock" sub="Sold-out items can't be added to the cart"><Switch on={s.blockOutOfStock} onChange={(v) => up("blockOutOfStock", v)} /></SettingRow>
              <SettingRow title="Default reorder level" sub="Used for new products"><input className="input num" style={{ width: 100 }} inputMode="numeric" value={s.lowStockDefault} onChange={(e) => up("lowStockDefault", Number(e.target.value.replace(/\D/g, "")))} /></SettingRow>
              <div className="small ink2 mt16">Loyalty rules live under <Link href="/admin/offers" className="semi" style={{ textDecoration: "underline" }}>Offers & Loyalty</Link>.</div>
            </div>
          )}

          {sec === "display" && (
            <div className="col g16">
              <Field label="Welcome headline" hint="The word “moment” gets the yellow highlight"><input className="input" value={s.display.headline} onChange={(e) => up("display", { ...s.display, headline: e.target.value })} /></Field>
              <Field label="Sub-headline"><input className="input" value={s.display.subheadline} onChange={(e) => up("display", { ...s.display, subheadline: e.target.value })} /></Field>
              <div>
                <SettingRow title="Show live promotions" sub="Offer cards on the idle screen"><Switch on={s.display.showPromos} onChange={(v) => up("display", { ...s.display, showPromos: v })} /></SettingRow>
                <SettingRow title="Rotate featured products every" sub="Seconds"><input className="input num" style={{ width: 90 }} inputMode="numeric" value={s.display.rotateSec} onChange={(e) => up("display", { ...s.display, rotateSec: Number(e.target.value.replace(/\D/g, "")) })} /></SettingRow>
              </div>
              <div className="row g8">
                <button className="btn btn-outline" onClick={() => window.open("/display", "icebay-display", "popup,width=1280,height=800")}><Icon name="monitor" size={16} />Open customer display</button>
                <span className="xs muted">Drag it to the customer-facing monitor and press the full-screen button.</span>
              </div>
            </div>
          )}

          {sec === "notify" && (
            <div className="col">
              {([["lowStock", "Low-stock alerts", "When a product reaches its reorder level"], ["refunds", "Refunds & voids", "Every reversed bill"], ["shiftVariance", "Cash variance", "When a shift closes short or over"], ["dailySummary", "Daily summary", "End-of-day sales digest"]] as const).map(([k, t, sub]) => (
                <SettingRow key={k} title={t} sub={sub}><Switch on={s.notify[k]} onChange={(v) => up("notify", { ...s.notify, [k]: v })} /></SettingRow>
              ))}
            </div>
          )}

          {sec === "data" && (
            <div className="col">
              <SettingRow title="Download backup" sub="All products, customers, offers, bills and settings as JSON"><button className="btn btn-outline" onClick={exportData}><Icon name="download" size={16} />Export</button></SettingRow>
              <SettingRow title="Restore from backup" sub="Replace data in this browser with a backup file">
                <label className="btn btn-outline" style={{ cursor: "pointer" }}><Icon name="upload" size={16} />Import<input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} /></label>
              </SettingRow>
              <SettingRow title="Reset demo data" sub="Start the client demo from a clean slate"><button className="btn btn-danger" onClick={reset}><Icon name="refresh" size={16} />Reset</button></SettingRow>
              <div className="xs muted mt12">This prototype stores data in the browser (localStorage). {db.bills.length} bills created in this demo · {db.products.length} products · {db.customers.length} customers.</div>
            </div>
          )}

          {sec !== "data" && sec !== "brand" && (
            <div className="row g8 mt24" style={{ justifyContent: "flex-end", borderTop: "1px solid var(--line2)", paddingTop: 16 }}>
              {dirty && <span className="small muted" style={{ marginRight: "auto" }}>Unsaved changes</span>}
              <button className="btn btn-outline" disabled={!dirty} onClick={() => setS(db.settings)}>Discard</button>
              <button className="btn btn-primary" disabled={!dirty} onClick={save}>Save changes</button>
            </div>
          )}
        </div>

        {sec === "receipt" && (
          <div className="col g8" style={{ position: "sticky", top: 84 }}>
            <div className="label">Live preview · {s.receiptWidth} mm</div>
            <Receipt bill={sample(s)} settings={s} cashier="Karthik Subramanian" />
          </div>
        )}
      </div>
    </Page>
  );
}
