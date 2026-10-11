"use client";
import { useState } from "react";
import type { Shift, Staff } from "@/lib/types";
import { Field, Modal, toast } from "../ui";
import { Icon } from "../Icon";
import { addAudit, setDB, useDB } from "@/lib/store";
import { cashSalesSince } from "@/lib/pos";
import { fmtDateTime, inr, uid } from "@/lib/util";

export function OpenShiftModal({ staff, onCancel }: { staff: Staff; onCancel: () => void }) {
  const [cash, setCash] = useState("2000");
  const open = () => {
    const s: Shift = { id: uid("sh-"), staffId: staff.id, openedAt: new Date().toISOString(), openingCash: Number(cash) || 0 };
    setDB((d) => { d.shifts.unshift(s); addAudit(d, "Shift opened", `${staff.name} · float ${inr(s.openingCash)}`); });
    toast("Shift started — have a sweet one!");
  };
  return (
    <Modal open onClose={onCancel} width={460} title="Open your shift" sub={`Hi ${staff.name.split(" ")[0]}, count the cash drawer before you start billing.`}
      footer={<><button className="btn btn-outline" onClick={onCancel}>Sign out</button><button className="btn btn-primary" onClick={open}><Icon name="play" size={16} />Start shift</button></>}>
      <div className="modal-body col g12">
        <Field label="Opening cash in drawer (₹)" hint="Float counted at the start of the shift">
          <input className="input input-lg num" inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))} autoFocus />
        </Field>
        <div className="row g8 wrap">{[1000, 2000, 3000, 5000].map((v) => <button key={v} className="chip" onClick={() => setCash(String(v))}>{inr(v)}</button>)}</div>
      </div>
    </Modal>
  );
}

export function CloseShiftModal({ shift, staff, onClose, onDone }: { shift: Shift; staff: Staff; onClose: () => void; onDone: () => void }) {
  const db = useDB();
  const bills = db.bills.filter((b) => b.cashierId === staff.id && b.date >= shift.openedAt);
  const paid = bills.filter((b) => !db.billStatus[b.id]);
  const cashSales = cashSalesSince(db, staff.id, shift.openedAt);
  const expected = shift.openingCash + cashSales;
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const variance = counted === "" ? null : Number(counted) - expected;
  const byMethod = (m: string) => paid.filter((b) => b.method === m).reduce((s, b) => s + b.total, 0);

  const close = () => {
    setDB((d) => {
      const s = d.shifts.find((x) => x.id === shift.id);
      if (s) { s.closedAt = new Date().toISOString(); s.countedCash = Number(counted); s.expectedCash = expected; s.note = note; }
      addAudit(d, "Shift closed", `${staff.name} · expected ${inr(expected)} · counted ${inr(Number(counted))}`);
      d.session.staffId = null;
    });
    toast("Shift closed and reconciled");
    onDone();
  };

  return (
    <Modal open onClose={onClose} width={560} title="Close shift & reconcile" sub={`Opened ${fmtDateTime(shift.openedAt)}`}
      footer={<><button className="btn btn-outline" onClick={onClose}>Keep billing</button><button className="btn btn-primary" disabled={counted === ""} onClick={close}>Close shift & sign out</button></>}>
      <div className="modal-body col g16">
        <div className="grid-3" style={{ gap: 10 }}>
          <div className="panel" style={{ padding: 12 }}><div className="xs muted semi">Bills</div><div className="h2 num">{paid.length}</div></div>
          <div className="panel" style={{ padding: 12 }}><div className="xs muted semi">Sales</div><div className="h2 num">{inr(paid.reduce((s, b) => s + b.total, 0))}</div></div>
          <div className="panel" style={{ padding: 12 }}><div className="xs muted semi">UPI · Card</div><div className="h3 num mt4">{inr(byMethod("upi"))} · {inr(byMethod("card"))}</div></div>
        </div>
        <div className="col g6">
          <div className="sum-row"><span className="ink2">Opening float</span><b className="num">{inr(shift.openingCash)}</b></div>
          <div className="sum-row"><span className="ink2">Cash sales</span><b className="num">+ {inr(cashSales)}</b></div>
          <div className="sum-row" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}><span className="semi">Expected in drawer</span><b className="num" style={{ fontSize: 18 }}>{inr(expected)}</b></div>
        </div>
        <Field label="Counted cash (₹)">
          <input className="input input-lg num" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ""))} placeholder={String(expected)} autoFocus />
        </Field>
        {variance !== null && (
          <div className={`status-line ${variance === 0 ? "okk" : Math.abs(variance) <= 50 ? "wait" : "bad"}`} style={{ justifyContent: "space-between" }}>
            <span>{variance === 0 ? "Drawer balanced" : variance > 0 ? "Excess in drawer" : "Short in drawer"}</span>
            <b className="num">{variance > 0 ? "+" : variance < 0 ? "−" : ""}{inr(Math.abs(variance))}</b>
          </div>
        )}
        <Field label="Note (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ₹20 given as change from personal float" /></Field>
      </div>
    </Modal>
  );
}
