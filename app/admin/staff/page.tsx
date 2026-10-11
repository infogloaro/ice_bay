"use client";
import { useState } from "react";
import { Page } from "@/components/admin";
import { Icon } from "@/components/Icon";
import { Empty, Field, Modal, Switch, toast } from "@/components/ui";
import { addAudit, currentStaff, setDB, staffName, useDB } from "@/lib/store";
import { allBills } from "@/lib/history";
import { cashSalesSince } from "@/lib/pos";
import type { Permission, Role, Staff } from "@/lib/types";
import { cx, fmtDate, fmtDateTime, initials, inr, uid, ymd } from "@/lib/util";

const PERMS: [Permission, string, string][] = [
  ["pos", "POS billing", "Ring up and collect payments"],
  ["discounts", "Manual discounts", "Apply coupons and redeem points"],
  ["refunds", "Refunds & voids", "Reverse completed bills"],
  ["products", "Products & categories", "Create and edit the menu"],
  ["inventory", "Inventory", "Stock, purchases and wastage"],
  ["customers", "Customers", "View and edit loyalty members"],
  ["offers", "Offers & loyalty", "Run promotions"],
  ["reports", "Dashboard & reports", "See sales numbers"],
  ["staff", "Staff & shifts", "Manage team and permissions"],
  ["settings", "Settings", "Shop, tax, payments, data"],
];
const ROLES: Role[] = ["Admin", "Manager", "Cashier"];
type Tab = "team" | "roles" | "shifts" | "audit";

export default function StaffPage() {
  const db = useDB();
  const me = currentStaff(db);
  const [tab, setTab] = useState<Tab>("team");
  const [edit, setEdit] = useState<Staff | null>(null);
  const today = ymd(new Date());
  const todays = allBills(db).filter((b) => ymd(new Date(b.date)) === today);

  const save = () => {
    if (!edit) return;
    if (edit.name.trim().length < 2 || !/^\d{4}$/.test(edit.pin)) return toast("Enter a name and a 4-digit PIN", "err");
    if (db.staff.some((s) => s.pin === edit.pin && s.id !== edit.id)) return toast("PIN already used by another staff member", "err");
    if (edit.id === me?.id && edit.role !== "Admin") return toast("You can't remove your own admin role", "err");
    setDB((d) => {
      if (edit.id) d.staff = d.staff.map((s) => (s.id === edit.id ? edit : s)); else d.staff.push({ ...edit, id: uid("s-"), joined: ymd(new Date()) });
      addAudit(d, edit.id ? "Staff updated" : "Staff added", `${edit.name} (${edit.role})`);
    });
    toast("Staff saved");
    setEdit(null);
  };

  const togglePerm = (role: Role, p: Permission) => {
    if (role === "Admin") return;
    setDB((d) => {
      const list = d.settings.permissions[role];
      d.settings.permissions[role] = list.includes(p) ? list.filter((x) => x !== p) : [...list, p];
      addAudit(d, "Permissions changed", `${role}: ${list.includes(p) ? "removed" : "granted"} ${p}`);
    });
  };

  return (
    <Page perm="staff" title="Staff & Shifts" sub="Team, role permissions, cash reconciliation and the audit trail"
      actions={<button className="btn btn-primary" onClick={() => setEdit({ id: "", name: "", role: "Cashier", phone: "", pin: "", active: true, joined: "" })}><Icon name="userPlus" size={16} />Add staff</button>}>
      <div className="tabs">{([["team", "Team"], ["roles", "Roles & permissions"], ["shifts", "Shifts & cash"], ["audit", "Audit log"]] as [Tab, string][]).map(([k, l]) => <button key={k} className={cx(tab === k && "on")} onClick={() => setTab(k)}>{l}</button>)}</div>

      <div className="mt16">
        {tab === "team" && (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {db.staff.map((s) => {
              const mine = todays.filter((b) => b.cashierId === s.id && b.status === "paid");
              const open = db.shifts.find((x) => x.staffId === s.id && !x.closedAt);
              return (
                <div key={s.id} className="card" style={{ padding: 18, opacity: s.active ? 1 : 0.55 }}>
                  <div className="row g12">
                    <span className="avatar" style={{ width: 46, height: 46, fontSize: 15 }}>{initials(s.name)}</span>
                    <div className="grow"><div className="h3">{s.name}</div><div className="xs muted num">{s.phone} · since {fmtDate(s.joined)}</div></div>
                    <span className={cx("badge", s.role === "Admin" ? "b-ink" : s.role === "Manager" ? "b-yellow" : "b-out")}>{s.role}</span>
                  </div>
                  <div className="grid-2 mt16" style={{ gap: 8 }}>
                    <div className="panel" style={{ padding: 10 }}><div className="xs muted semi">Bills today</div><div className="h3 num">{mine.length}</div></div>
                    <div className="panel" style={{ padding: 10 }}><div className="xs muted semi">Sales today</div><div className="h3 num">{inr(mine.reduce((a, b) => a + b.total, 0))}</div></div>
                  </div>
                  <div className="row between mt12">
                    {open ? <span className="badge b-ok"><span className="dot" />On shift since {fmtDateTime(open.openedAt).split(", ")[1]}</span> : <span className="badge b-out">Off shift</span>}
                    <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...s })}><Icon name="edit" size={14} />Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "roles" && (
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r} className="center">{r}</th>)}</tr></thead>
              <tbody>{PERMS.map(([p, label, sub]) => (
                <tr key={p}>
                  <td><div className="semi">{label}</div><div className="xs muted">{sub}</div></td>
                  {ROLES.map((r) => {
                    const on = db.settings.permissions[r].includes(p);
                    return <td key={r} className="center"><button className={cx("check", on && "on")} style={{ width: 22, height: 22, cursor: r === "Admin" ? "not-allowed" : "pointer" }} onClick={() => togglePerm(r, p)} aria-label={`${r} ${label}`} aria-pressed={on}>{on && <Icon name="check" size={13} stroke={3} />}</button></td>;
                  })}
                </tr>
              ))}</tbody>
            </table>
            <div className="xs muted" style={{ padding: 14 }}>Admins always have every permission. Changes apply immediately to signed-in staff.</div>
          </div>
        )}

        {tab === "shifts" && (
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Staff</th><th>Opened</th><th>Closed</th><th className="r">Opening float</th><th className="r">Cash sales</th><th className="r">Expected</th><th className="r">Counted</th><th className="r">Variance</th></tr></thead>
              <tbody>{db.shifts.map((s) => {
                const cash = cashSalesSince(db, s.staffId, s.openedAt);
                const expected = s.expectedCash ?? s.openingCash + cash;
                const variance = s.countedCash !== undefined ? s.countedCash - expected : null;
                return (
                  <tr key={s.id}>
                    <td className="semi">{staffName(db, s.staffId)}</td><td className="ink2 nowrap">{fmtDateTime(s.openedAt)}</td>
                    <td className="nowrap">{s.closedAt ? <span className="ink2">{fmtDateTime(s.closedAt)}</span> : <span className="badge b-ok"><span className="dot" />Open</span>}</td>
                    <td className="r num">{inr(s.openingCash)}</td><td className="r num">{inr(cash)}</td><td className="r num semi">{inr(expected)}</td>
                    <td className="r num">{s.countedCash !== undefined ? inr(s.countedCash) : "—"}</td>
                    <td className="r">{variance === null ? "—" : <span className={cx("badge", variance === 0 ? "b-ok" : Math.abs(variance) <= 50 ? "b-warn" : "b-err")}>{variance > 0 ? "+" : variance < 0 ? "−" : ""}{inr(Math.abs(variance))}</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
            {!db.shifts.length && <Empty icon="clock" title="No shifts yet" sub="Shifts open when a cashier signs in to the POS and close with a cash count." />}
          </div>
        )}

        {tab === "audit" && (
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
              <tbody>{db.audit.map((a) => <tr key={a.id}><td className="ink2 nowrap">{fmtDateTime(a.date)}</td><td className="semi nowrap">{staffName(db, a.by)}</td><td><span className="badge b-out">{a.action}</span></td><td className="ink2 small">{a.detail}</td></tr>)}</tbody>
            </table>
            {!db.audit.length && <Empty icon="shield" title="No activity yet" />}
          </div>
        )}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} width={480} title={edit?.id ? "Edit staff" : "Add staff"}
        footer={<><button className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        {edit && (
          <div className="modal-body col g12">
            <Field label="Full name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Mobile"><input className="input num" inputMode="numeric" maxLength={10} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="4-digit PIN"><input className="input num" inputMode="numeric" maxLength={4} value={edit.pin} onChange={(e) => setEdit({ ...edit, pin: e.target.value.replace(/\D/g, "") })} /></Field>
            </div>
            <div className="field"><label>Role</label><div className="pill-tabs" style={{ alignSelf: "flex-start" }}>{ROLES.map((r) => <button key={r} className={cx(edit.role === r && "on")} onClick={() => setEdit({ ...edit, role: r })}>{r}</button>)}</div></div>
            <div className="row between panel" style={{ padding: 12 }}><div><div className="semi">Active</div><div className="xs muted">Inactive staff can&apos;t sign in</div></div><Switch on={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} /></div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
