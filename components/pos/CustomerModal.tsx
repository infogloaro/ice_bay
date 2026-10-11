"use client";
import { useMemo, useState } from "react";
import type { Customer } from "@/lib/types";
import { Field, Modal, toast } from "../ui";
import { Icon } from "../Icon";
import { addAudit, setDB, useDB } from "@/lib/store";
import { allBills } from "@/lib/history";
import { cx, fmtDate, initials, inr, uid, ymd } from "@/lib/util";

export type CustomerMode = "search" | "new" | "edit";
type Form = { name: string; phone: string; email: string; gender: "" | NonNullable<Customer["gender"]>; birthday: string; anniversary: string; address: string; city: string; pincode: string; notes: string };
const EMPTY: Form = { name: "", phone: "", email: "", gender: "", birthday: "", anniversary: "", address: "", city: "", pincode: "", notes: "" };
const fromCustomer = (c: Customer): Form => ({
  name: c.name, phone: c.phone, email: c.email ?? "", gender: c.gender ?? "", birthday: c.birthday ?? "", anniversary: c.anniversary ?? "",
  address: c.address ?? "", city: c.city ?? "", pincode: c.pincode ?? "", notes: c.notes ?? "",
});

export function CustomerModal({ open, onClose, selectedId, onSelect, initialMode = "search" }: {
  open: boolean; onClose: () => void; selectedId?: string; onSelect: (id: string | undefined) => void; initialMode?: CustomerMode;
}) {
  const db = useDB();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<CustomerMode>(initialMode === "edit" && !selectedId ? "new" : initialMode);
  const [viewId, setViewId] = useState<string | undefined>(selectedId);
  const [form, setForm] = useState<Form>(() => {
    const c = db.customers.find((x) => x.id === selectedId);
    return initialMode === "edit" && c ? fromCustomer(c) : EMPTY;
  });
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? db.customers.filter((c) => c.name.toLowerCase().includes(s) || c.phone.includes(s.replace(/\D/g, "") || "~")) : [...db.customers].sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));
    return list.slice(0, 8);
  }, [q, db.customers]);

  const view = db.customers.find((c) => c.id === viewId);
  const history = useMemo(() => (view ? allBills(db).filter((b) => b.customerId === view.id).slice(0, 5) : []), [db, view]);
  const fav = useMemo(() => {
    const m = new Map<string, number>();
    allBills(db).filter((b) => b.customerId === view?.id).forEach((b) => b.lines.forEach((l) => m.set(l.name, (m.get(l.name) ?? 0) + l.qty)));
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [db, view]);

  const editing = mode === "edit" && view;
  const phoneOk = /^[6-9]\d{9}$/.test(form.phone);
  const dup = db.customers.find((c) => c.phone === form.phone && c.id !== (editing ? view.id : undefined));
  const nameOk = form.name.trim().length >= 2;
  const emailOk = !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const pinOk = !form.pincode || /^\d{6}$/.test(form.pincode);
  const valid = phoneOk && nameOk && !dup && emailOk && pinOk;

  const details = (): Partial<Customer> => ({
    name: form.name.trim(), phone: form.phone, email: form.email.trim() || undefined, gender: form.gender || undefined,
    birthday: form.birthday || undefined, anniversary: form.anniversary || undefined, address: form.address.trim() || undefined,
    city: form.city.trim() || undefined, pincode: form.pincode || undefined, notes: form.notes.trim() || undefined,
  });

  const save = () => {
    setTouched(true);
    if (!valid) return;
    if (editing) {
      setDB((d) => { const c = d.customers.find((x) => x.id === view.id); if (c) Object.assign(c, details()); addAudit(d, "Customer updated", `${form.name} · ${form.phone}`); });
      toast(`${form.name.split(" ")[0]}'s details saved`);
      setMode("search");
      return;
    }
    const c: Customer = { id: uid("cu-"), points: 0, visits: 0, spent: 0, joined: ymd(new Date()), ...(details() as Pick<Customer, "name" | "phone">) };
    setDB((d) => { d.customers.unshift(c); addAudit(d, "Customer registered", `${c.name} · ${c.phone}`); });
    toast(`${c.name.split(" ")[0]} registered and added to bill`);
    onSelect(c.id);
    setForm(EMPTY); setTouched(false);
    onClose();
  };

  const startEdit = (c: Customer) => { setViewId(c.id); setForm(fromCustomer(c)); setTouched(false); setMode("edit"); };
  const startNew = (prefill?: Partial<Form>) => { setForm({ ...EMPTY, ...prefill }); setTouched(false); setMode("new"); };

  const L = db.settings.loyalty;
  const rewards = view ? Math.floor(view.points / L.redeemPoints) : 0;
  const err = (cond: boolean) => touched && cond;

  return (
    <Modal open={open} onClose={onClose} width={mode === "search" ? 860 : 760}
      title={mode === "new" ? "Add customer" : editing ? `Edit ${view.name.split(" ")[0]}'s details` : "Customer"}
      sub={mode === "search" ? "Search by mobile number or name. The current order stays as it is." : "Fill in the customer's details. Fields marked * are required."}>
      <div className="modal-body col g16">
        <div className="pill-tabs" style={{ alignSelf: "flex-start" }}>
          <button className={cx(mode !== "search" && "on")} onClick={() => !editing && startNew(/^\d+$/.test(q) ? { phone: q.slice(0, 10) } : {})}><Icon name="userPlus" size={15} style={{ marginRight: 6, verticalAlign: -3 }} />{editing ? "Edit details" : "New customer"}</button>
          <button className={cx(mode === "search" && "on")} onClick={() => setMode("search")}><Icon name="search" size={15} style={{ marginRight: 6, verticalAlign: -3 }} />Find existing</button>
        </div>

        {mode !== "search" ? (
          <div className="col g16">
            <div className="grid-2">
              <Field label="Mobile number *" error={err(!phoneOk) ? "Enter a valid 10-digit mobile number" : err(!!dup) ? `Already registered to ${dup!.name}` : undefined}>
                <input className={cx("input input-lg", err(!phoneOk || !!dup) && "invalid")} style={{ fontSize: 16 }} inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))} placeholder="98765 43210" autoFocus={mode === "new"} />
              </Field>
              <Field label="Full name *" error={err(!nameOk) ? "Enter the customer's name" : undefined}>
                <input className={cx("input input-lg", err(!nameOk) && "invalid")} style={{ fontSize: 16 }} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ananya Iyer" autoFocus={mode === "edit"} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Email" error={err(!emailOk) ? "Enter a valid email" : undefined}>
                <input className={cx("input", err(!emailOk) && "invalid")} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" />
              </Field>
              <Field label="Gender">
                <div className="row g6">
                  {(["Female", "Male", "Other"] as const).map((g) => (
                    <button key={g} type="button" className={cx("chip grow", form.gender === g && "on")} style={{ justifyContent: "center", height: 40 }} onClick={() => set("gender", form.gender === g ? "" : g)}>{g}</button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Birthday" hint="For birthday offers"><input className="input" type="date" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} /></Field>
              <Field label="Anniversary"><input className="input" type="date" value={form.anniversary} onChange={(e) => set("anniversary", e.target.value)} /></Field>
            </div>
            <Field label="Address"><input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Door no, street, area" /></Field>
            <div className="grid-2">
              <Field label="City"><input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Chennai" /></Field>
              <Field label="Pincode" error={err(!pinOk) ? "6 digits" : undefined}><input className={cx("input", err(!pinOk) && "invalid")} inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} placeholder="600004" /></Field>
            </div>
            <Field label="Notes"><textarea className="textarea" style={{ minHeight: 60 }} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Favourite flavours, allergies, party orders…" /></Field>
            <div className="row between wrap g12">
              <div className="xs muted">{editing ? "Changes apply to this customer's profile and future receipts." : `New members earn 1 point for every ₹${L.spendPerPoint} spent, starting with this bill.`}</div>
              <div className="row g8">
                <button className="btn btn-outline btn-lg" onClick={() => (editing ? setMode("search") : onClose())}>Cancel</button>
                <button className="btn btn-primary btn-lg" onClick={save}><Icon name={editing ? "check" : "userPlus"} />{editing ? "Save details" : "Save & add to bill"}</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="customize">
            <div className="col g12">
              <div className="search">
                <Icon name="search" />
                <input className="input input-lg" style={{ fontSize: 16, paddingLeft: 38 }} placeholder="Mobile number or name" value={q} onChange={(e) => setQ(e.target.value)} autoFocus inputMode="search" />
              </div>
              <div className="col g4 scroll" style={{ maxHeight: 340 }}>
                {results.map((c) => (
                  <button key={c.id} className={cx("staff-btn", viewId === c.id && "on")} onClick={() => setViewId(c.id)} style={{ padding: 10 }}>
                    <span className="avatar gray">{initials(c.name)}</span>
                    <span className="grow">
                      <span className="semi" style={{ display: "block" }}>{c.name}</span>
                      <span className="xs muted num">{c.phone} · {c.visits} visits</span>
                    </span>
                    <span className="badge b-soft num"><Icon name="star" size={12} />{c.points}</span>
                  </button>
                ))}
                {!results.length && (
                  <div className="empty" style={{ padding: 24 }}>
                    <div className="semi" style={{ color: "var(--ink)" }}>No customer found</div>
                    <button className="btn btn-primary btn-sm" onClick={() => startNew({ phone: q.replace(/\D/g, "").slice(0, 10), name: /\d/.test(q) ? "" : q })}>
                      <Icon name="userPlus" size={16} />Add “{q}” as new customer
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="panel" style={{ padding: 18, minHeight: 380, display: "flex", flexDirection: "column" }}>
              {view ? (
                <>
                  <div className="row g12">
                    <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(view.name)}</span>
                    <div className="grow">
                      <div className="h3">{view.name}</div>
                      <div className="small muted num">{view.phone} · Member since {fmtDate(view.joined)}</div>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => startEdit(view)}><Icon name="edit" size={14} />Edit</button>
                  </div>
                  {(view.email || view.city || view.birthday) && (
                    <div className="xs ink2 mt8 row g12 wrap">
                      {view.email && <span>{view.email}</span>}
                      {view.city && <span>{[view.address, view.city, view.pincode].filter(Boolean).join(", ")}</span>}
                      {view.birthday && <span>🎂 {fmtDate(view.birthday)}</span>}
                    </div>
                  )}
                  <div className="grid-3 mt16" style={{ gap: 8 }}>
                    <div className="card" style={{ padding: 10 }}><div className="xs muted semi">Points</div><div className="bold num" style={{ fontSize: 18 }}>{view.points}</div></div>
                    <div className="card" style={{ padding: 10 }}><div className="xs muted semi">Visits</div><div className="bold num" style={{ fontSize: 18 }}>{view.visits}</div></div>
                    <div className="card" style={{ padding: 10 }}><div className="xs muted semi">Spent</div><div className="bold num" style={{ fontSize: 18 }}>{inr(view.spent)}</div></div>
                  </div>
                  <div className="soft mt12" style={{ padding: "10px 12px" }}>
                    <div className="row between">
                      <span className="semi row g6"><Icon name="gift" size={16} />Eligible rewards</span>
                      <span className="badge b-yellow">{rewards ? `${rewards} × ₹${L.redeemValue} off` : "None yet"}</span>
                    </div>
                    <div className="xs ink2 mt4">{rewards ? `Redeem ${L.redeemPoints} points for ₹${L.redeemValue} off — apply it from the cart.` : `${L.redeemPoints - (view.points % L.redeemPoints)} more points to the next ₹${L.redeemValue} reward.`}</div>
                  </div>
                  {view.notes && <div className="small mt12"><span className="muted">Note: </span>{view.notes}</div>}
                  {fav && <div className="small mt12"><span className="muted">Usually orders </span><b>{fav}</b></div>}
                  <div className="h4 mt16">Recent purchases</div>
                  <div className="col g4 mt8" style={{ flex: 1 }}>
                    {history.length ? history.map((b) => (
                      <div key={b.id} className="row between small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line2)" }}>
                        <span className="ellipsis"><span className="muted">{fmtDate(b.date)}</span> · {b.lines.map((l) => l.name).join(", ")}</span>
                        <b className="num">{inr(b.total)}</b>
                      </div>
                    )) : <div className="small muted">No purchases yet.</div>}
                  </div>
                  <div className="row g8 mt16">
                    {selectedId === view.id ? (
                      <button className="btn btn-outline grow" onClick={() => { onSelect(undefined); onClose(); }}>Remove from bill</button>
                    ) : (
                      <button className="btn btn-primary grow btn-lg" onClick={() => { onSelect(view.id); toast(`${view.name.split(" ")[0]} added to bill`); onClose(); }}><Icon name="check" />Add to bill</button>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty" style={{ margin: "auto" }}>
                  <div className="ei"><Icon name="user" size={24} /></div>
                  <div className="semi" style={{ color: "var(--ink)" }}>Select a customer</div>
                  <div className="small">Their points, rewards and history appear here.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
