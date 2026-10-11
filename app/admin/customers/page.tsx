"use client";
import { useMemo, useState } from "react";
import { Kpi, Page } from "@/components/admin";
import { Icon } from "@/components/Icon";
import { Drawer, Empty, Field, Modal, confirmDialog, toast } from "@/components/ui";
import { addAudit, setDB, useDB } from "@/lib/store";
import { allBills } from "@/lib/history";
import type { Customer } from "@/lib/types";
import { addDays, cx, downloadFile, fmtDate, initials, inr, toCSV, uid, ymd } from "@/lib/util";

export default function Customers() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("all");
  const [sort, setSort] = useState<"recent" | "spent" | "points">("recent");
  const [view, setView] = useState<string | null>(null);
  const [form, setForm] = useState<Customer | null>(null);
  const [pts, setPts] = useState("");
  const L = db.settings.loyalty;
  const bills = allBills(db);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const cutoff = addDays(new Date(), -21).toISOString();
    return db.customers.filter((c) => {
      if (s && !c.name.toLowerCase().includes(s) && !c.phone.includes(s)) return false;
      if (seg === "rewards" && c.points < L.redeemPoints) return false;
      if (seg === "vip" && c.spent < 6000) return false;
      if (seg === "lapsed" && (c.lastVisit ?? "") > cutoff) return false;
      return true;
    }).sort((a, b) => sort === "spent" ? b.spent - a.spent : sort === "points" ? b.points - a.points : (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));
  }, [db.customers, q, seg, sort, L.redeemPoints]);

  const c = db.customers.find((x) => x.id === view);
  const history = useMemo(() => (c ? bills.filter((b) => b.customerId === c.id) : []), [bills, c]);
  const totalPts = db.customers.reduce((s, c) => s + c.points, 0);

  const saveForm = () => {
    if (!form) return;
    if (form.name.trim().length < 2 || !/^[6-9]\d{9}$/.test(form.phone)) return toast("Enter a name and a valid 10-digit mobile", "err");
    if (db.customers.some((x) => x.phone === form.phone && x.id !== form.id)) return toast("This mobile is already registered", "err");
    setDB((d) => {
      if (form.id) d.customers = d.customers.map((x) => (x.id === form.id ? form : x));
      else d.customers.unshift({ ...form, id: uid("cu-"), joined: ymd(new Date()) });
      addAudit(d, form.id ? "Customer updated" : "Customer registered", form.name);
    });
    toast("Customer saved");
    setForm(null);
  };

  const adjustPoints = (sign: 1 | -1) => {
    const n = Number(pts);
    if (!c || !(n > 0)) return;
    setDB((d) => { const x = d.customers.find((x) => x.id === c.id); if (x) x.points = Math.max(0, x.points + sign * n); addAudit(d, "Points adjusted", `${c.name}: ${sign > 0 ? "+" : "−"}${n}`); });
    setPts("");
    toast(`${sign > 0 ? "Added" : "Removed"} ${n} points`);
  };

  const exportCSV = () => downloadFile("icebay-customers.csv", toCSV([["Name", "Mobile", "Email", "Points", "Visits", "Total spent", "Joined", "Last visit"], ...db.customers.map((c) => [c.name, c.phone, c.email ?? "", c.points, c.visits, c.spent, c.joined, c.lastVisit ? ymd(new Date(c.lastVisit)) : ""])]));

  return (
    <Page perm="customers" title="Customers" sub="Loyalty members, purchase history and points"
      actions={<><button className="btn btn-outline" onClick={exportCSV}><Icon name="download" size={16} />Export</button><button className="btn btn-primary" onClick={() => setForm({ id: "", name: "", phone: "", email: "", points: 0, visits: 0, spent: 0, joined: "" })}><Icon name="userPlus" size={16} />Add customer</button></>}>
      <div className="grid-4">
        <Kpi icon="users" label="Members" value={db.customers.length} hint="registered customers" />
        <Kpi icon="star" label="Points outstanding" value={totalPts.toLocaleString("en-IN")} hint={`worth ${inr((totalPts / L.redeemPoints) * L.redeemValue)}`} />
        <Kpi icon="gift" label="Reward-ready" value={db.customers.filter((c) => c.points >= L.redeemPoints).length} hint={`${L.redeemPoints}+ points`} />
        <Kpi icon="bag" label="Avg. lifetime spend" value={inr(db.customers.reduce((s, c) => s + c.spent, 0) / Math.max(1, db.customers.length))} />
      </div>

      <div className="card mt16">
        <div className="row g12 wrap" style={{ padding: 16, borderBottom: "1px solid var(--line2)" }}>
          <div className="search" style={{ flex: "1 1 260px" }}><Icon name="search" /><input className="input" placeholder="Search by name or mobile" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="pill-tabs">{[["all", "All"], ["rewards", "Has rewards"], ["vip", "Top spenders"], ["lapsed", "Not seen 3 wks"]].map(([k, l]) => <button key={k} className={cx(seg === k && "on")} onClick={() => setSeg(k)}>{l}</button>)}</div>
          <select className="select" style={{ width: 170 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort"><option value="recent">Recent visit</option><option value="spent">Highest spend</option><option value="points">Most points</option></select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Customer</th><th>Mobile</th><th className="r">Points</th><th className="r">Visits</th><th className="r">Spent</th><th>Last visit</th><th /></tr></thead>
            <tbody>{list.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => setView(c.id)}>
                <td><div className="row g12"><span className="avatar gray">{initials(c.name)}</span><div><div className="semi">{c.name}</div><div className="xs muted">Since {fmtDate(c.joined)}</div></div></div></td>
                <td className="num ink2">{c.phone}</td>
                <td className="r">{c.points >= L.redeemPoints ? <span className="badge b-yellow num">{c.points}</span> : <span className="num">{c.points}</span>}</td>
                <td className="r num">{c.visits}</td><td className="r num semi">{inr(c.spent)}</td>
                <td className="ink2 nowrap">{c.lastVisit ? fmtDate(c.lastVisit) : "—"}</td>
                <td className="r"><Icon name="chevronRight" size={16} style={{ color: "var(--muted)" }} /></td>
              </tr>
            ))}</tbody>
          </table>
          {!list.length && <Empty icon="users" title="No customers found" />}
        </div>
      </div>

      <Drawer open={!!c} onClose={() => setView(null)} width={540} title={c?.name ?? ""} sub={c ? `${c.phone}${c.email ? " · " + c.email : ""}` : ""}
        footer={c && <>
          <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={async () => { if (await confirmDialog({ title: `Delete ${c.name}?`, body: "Their bills stay in reports without a linked customer.", confirm: "Delete", danger: true })) { setDB((d) => { d.customers = d.customers.filter((x) => x.id !== c.id); addAudit(d, "Customer deleted", c.name); }); setView(null); } }}>Delete</button>
          <button className="btn btn-outline" onClick={() => setForm({ ...c })}><Icon name="edit" size={15} />Edit details</button>
        </>}>
        {c && (
          <div className="col g16">
            <div className="grid-3" style={{ gap: 10 }}>
              <div className="soft" style={{ padding: 12 }}><div className="xs semi ink2">Points</div><div className="h2 num">{c.points}</div></div>
              <div className="panel" style={{ padding: 12 }}><div className="xs semi ink2">Visits</div><div className="h2 num">{c.visits}</div></div>
              <div className="panel" style={{ padding: 12 }}><div className="xs semi ink2">Lifetime spend</div><div className="h2 num">{inr(c.spent)}</div></div>
            </div>
            <div className="panel" style={{ padding: 14 }}>
              <div className="row between"><b>Loyalty</b><span className="badge b-soft">{Math.floor(c.points / L.redeemPoints)} reward{Math.floor(c.points / L.redeemPoints) === 1 ? "" : "s"} available</span></div>
              <div className="bar mt8"><span style={{ width: `${((c.points % L.redeemPoints) / L.redeemPoints) * 100}%` }} /></div>
              <div className="xs muted mt4">{L.redeemPoints - (c.points % L.redeemPoints)} points to the next ₹{L.redeemValue} reward</div>
              <div className="row g8 mt12">
                <input className="input num" style={{ width: 120, height: 36 }} placeholder="Points" inputMode="numeric" value={pts} onChange={(e) => setPts(e.target.value.replace(/\D/g, ""))} />
                <button className="btn btn-outline btn-sm" onClick={() => adjustPoints(1)} disabled={!pts}>Add</button>
                <button className="btn btn-outline btn-sm" onClick={() => adjustPoints(-1)} disabled={!pts}>Deduct</button>
              </div>
            </div>
            <div className="row g16 small ink2"><span>Joined {fmtDate(c.joined)}</span>{c.birthday && <span>Birthday {new Date(c.birthday).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</span>}</div>
            <div>
              <div className="h3">Purchase history <span className="muted small">({history.length})</span></div>
              <div className="col mt8">
                {history.slice(0, 20).map((b) => (
                  <div key={b.id} className="row between g12" style={{ padding: "10px 0", borderBottom: "1px solid var(--line2)" }}>
                    <div className="grow"><div className="semi small">{b.no} <span className="muted">· {fmtDate(b.date)}</span>{b.status !== "paid" && <span className="badge b-err" style={{ marginLeft: 6 }}>{b.status}</span>}</div><div className="xs ink2 ellipsis">{b.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div></div>
                    <div className="right"><div className="num semi">{inr(b.total)}</div>{b.pointsEarned > 0 && <div className="xs ok">+{b.pointsEarned} pts</div>}</div>
                  </div>
                ))}
                {!history.length && <div className="small muted">No purchases yet.</div>}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal open={!!form} onClose={() => setForm(null)} width={480} title={form?.id ? "Edit customer" : "Add customer"}
        footer={<><button className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" onClick={saveForm}>Save</button></>}>
        {form && (
          <div className="modal-body col g12">
            <Field label="Full name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
            <Field label="Mobile number"><input className="input num" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} /></Field>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Email"><input className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Birthday"><input className="input" type="date" value={form.birthday ?? ""} onChange={(e) => setForm({ ...form, birthday: e.target.value })} /></Field>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
