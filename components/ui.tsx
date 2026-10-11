"use client";
import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "./Icon";
import { cx } from "@/lib/util";

/* ---------------- Modal / Drawer ---------------- */
export function Modal({ open, onClose, title, sub, children, footer, width = 560, className, closeOnBackdrop = true }: {
  open: boolean; onClose: () => void; title?: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode;
  width?: number; className?: string; closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}>
      <div className={cx("modal", className)} style={{ width: `min(${width}px, 100%)` }} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="modal-head">
            <div>
              <div className="h2">{title}</div>
              {sub && <div className="ink2 small mt4">{sub}</div>}
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </div>
        )}
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, sub, children, footer, width = 520 }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" style={{ width: `min(${width}px, 100vw)` }} role="dialog" aria-modal="true">
        <div className="modal-head" style={{ borderBottom: "1px solid var(--line2)", paddingBottom: 16 }}>
          <div className="grow">
            <div className="h2">{title}</div>
            {sub && <div className="ink2 small mt4">{sub}</div>}
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="scroll" style={{ flex: 1, padding: "16px 24px 24px" }}>{children}</div>
        {footer && <div className="modal-foot" style={{ borderRadius: 0 }}>{footer}</div>}
      </aside>
    </div>
  );
}

/* ---------------- Toasts ---------------- */
type Toast = { id: number; kind: "ok" | "err" | "info"; text: string };
let toasts: Toast[] = [];
const tl = new Set<() => void>();
const emitT = () => tl.forEach((l) => l());
export function toast(text: string, kind: Toast["kind"] = "ok") {
  const id = Date.now() + Math.random();
  toasts = [...toasts.slice(-2), { id, kind, text }];
  emitT();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emitT(); }, 2600);
}
export function Toasts() {
  const list = useSyncExternalStore((l) => { tl.add(l); return () => tl.delete(l); }, () => toasts, () => toasts);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={cx("toast", t.kind)}>
          <span className="ti"><Icon name={t.kind === "ok" ? "check" : t.kind === "err" ? "alert" : "info"} size={15} stroke={2.5} /></span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Confirm ---------------- */
type Conf = { title: string; body?: string; confirm?: string; danger?: boolean; resolve: (v: boolean) => void } | null;
let conf: Conf = null;
const cl = new Set<() => void>();
export function confirmDialog(o: { title: string; body?: string; confirm?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => { conf = { ...o, resolve }; cl.forEach((l) => l()); });
}
export function ConfirmHost() {
  const c = useSyncExternalStore((l) => { cl.add(l); return () => cl.delete(l); }, () => conf, () => conf);
  const close = (v: boolean) => { c?.resolve(v); conf = null; cl.forEach((l) => l()); };
  return (
    <Modal open={!!c} onClose={() => close(false)} title={c?.title} width={440}
      footer={<>
        <button className="btn btn-outline" onClick={() => close(false)}>Cancel</button>
        <button className={cx("btn", c?.danger ? "btn-danger" : "btn-primary")} onClick={() => close(true)} autoFocus>{c?.confirm ?? "Confirm"}</button>
      </>}>
      <div className="modal-body ink2">{c?.body}</div>
    </Modal>
  );
}

/* ---------------- Small pieces ---------------- */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx("switch", on && "on")} onClick={() => onChange(!on)} />;
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error ? <span className="xs err semi">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Empty({ icon = "box", title, sub, action }: { icon?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ei"><Icon name={icon} size={24} /></div>
      <div className="h3" style={{ color: "var(--ink)" }}>{title}</div>
      {sub && <div className="small" style={{ maxWidth: 280 }}>{sub}</div>}
      {action}
    </div>
  );
}

export function SettingRow({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="row between g16" style={{ padding: "14px 0", borderBottom: "1px solid var(--line2)" }}>
      <div className="grow"><div className="semi">{title}</div>{sub && <div className="small muted">{sub}</div>}</div>
      {children}
    </div>
  );
}

export function Dropdown({ trigger, children, align = "right", width }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    window.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); window.removeEventListener("keydown", k); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && <div className="menu" style={{ [align]: 0, ...(align === "left" ? { right: "auto" } : {}), minWidth: width }}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Delta({ v }: { v: number }) {
  if (!isFinite(v)) return null;
  const up = v >= 0;
  return <span className={cx("delta", up ? "up" : "down")}>{up ? "▲" : "▼"} {Math.abs(v).toFixed(1)}%</span>;
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function useClock(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
