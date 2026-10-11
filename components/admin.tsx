"use client";
import { ReactNode } from "react";
import Link from "next/link";
import type { Permission, Product } from "@/lib/types";
import type { RangeKey } from "@/lib/stats";
import { can, useDB } from "@/lib/store";
import { Icon } from "./Icon";
import { Delta } from "./ui";
import { cx } from "@/lib/util";

export function Page({ title, sub, actions, children, perm }: { title: string; sub?: ReactNode; actions?: ReactNode; children: ReactNode; perm?: Permission }) {
  const db = useDB();
  if (perm && !can(db, perm)) {
    return (
      <div className="page"><div className="card card-pad" style={{ maxWidth: 460, margin: "60px auto" }}>
        <div className="empty"><div className="ei"><Icon name="lock" size={24} /></div><div className="h3" style={{ color: "var(--ink)" }}>You don&apos;t have access to {title}</div><div className="small">Ask an admin to update your role permissions.</div>
          <Link href="/admin" className="btn btn-outline btn-sm mt8">Back to dashboard</Link></div>
      </div></div>
    );
  }
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">{title}</h1>
          {sub && <div className="ink2 mt4">{sub}</div>}
        </div>
        {actions && <div className="toolbar">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Kpi({ icon, label, value, delta, hint }: { icon: string; label: string; value: ReactNode; delta?: number; hint?: string }) {
  return (
    <div className="card kpi">
      <div className="row between">
        <span className="small semi ink2">{label}</span>
        <span className="ic"><Icon name={icon} size={17} /></span>
      </div>
      <div className="v num">{value}</div>
      <div className="row g6 mt4" style={{ minHeight: 18 }}>
        {delta !== undefined && <Delta v={delta} />}
        {hint && <span className="xs muted">{hint}</span>}
      </div>
    </div>
  );
}

export function RangePicker({ value, onChange, custom, onCustom, options = ["today", "yesterday", "7d", "30d", "month", "custom"] }: {
  value: RangeKey; onChange: (r: RangeKey) => void; custom?: { from: string; to: string }; onCustom?: (c: { from: string; to: string }) => void; options?: RangeKey[];
}) {
  const L: Record<RangeKey, string> = { today: "Today", yesterday: "Yesterday", "7d": "7 days", "30d": "30 days", month: "This month", custom: "Custom" };
  return (
    <div className="row g8 wrap">
      <div className="pill-tabs">
        {options.map((o) => <button key={o} className={cx(value === o && "on")} onClick={() => onChange(o)}>{L[o]}</button>)}
      </div>
      {value === "custom" && custom && onCustom && (
        <div className="row g6">
          <input type="date" className="input" style={{ height: 36, width: 150 }} value={custom.from} onChange={(e) => onCustom({ ...custom, from: e.target.value })} aria-label="From date" />
          <span className="muted">–</span>
          <input type="date" className="input" style={{ height: 36, width: 150 }} value={custom.to} onChange={(e) => onCustom({ ...custom, to: e.target.value })} aria-label="To date" />
        </div>
      )}
    </div>
  );
}

export function StockPill({ p }: { p: Product }) {
  if (p.stock <= 0) return <span className="badge b-err"><span className="dot" />Out of stock</span>;
  if (p.stock <= p.lowStock) return <span className="badge b-warn"><span className="dot" />Low · {p.stock}</span>;
  return <span className="badge b-ok"><span className="dot" />{p.stock} in stock</span>;
}

export function useCatName() {
  const db = useDB();
  return (id: string) => db.categories.find((c) => c.id === id)?.name ?? id;
}

export function SectionCard({ title, sub, action, children, pad = true }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <section className="card" style={{ minWidth: 0 }}>
      <div className="card-head">
        <div><div className="h3">{title}</div>{sub && <div className="xs muted mt4">{sub}</div>}</div>
        {action}
      </div>
      <div className={pad ? "card-body" : undefined}>{children}</div>
    </section>
  );
}
