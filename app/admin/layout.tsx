"use client";
import { ReactNode, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Logo } from "@/components/Icon";
import { Dropdown } from "@/components/ui";
import { can, currentStaff, setDB, useDB } from "@/lib/store";
import { allBills } from "@/lib/history";
import type { Permission } from "@/lib/types";
import { cx, fmtTime, initials, inr } from "@/lib/util";

const NAV: { href: string; label: string; icon: string; perm?: Permission; pri: string }[] = [
  { href: "/admin", label: "Dashboard", icon: "home", perm: "reports", pri: "pd" },
  { href: "/admin/products", label: "Products", icon: "box", perm: "products", pri: "p0" },
  { href: "/admin/categories", label: "Categories", icon: "grid", perm: "products", pri: "p2" },
  { href: "/admin/inventory", label: "Inventory", icon: "layers", perm: "inventory", pri: "p1" },
  { href: "/admin/customers", label: "Customers", icon: "users", perm: "customers", pri: "p1" },
  { href: "/admin/offers", label: "Offers & Loyalty", icon: "tag", perm: "offers", pri: "p2" },
  { href: "/admin/reports", label: "Sales & Reports", icon: "chart", perm: "reports", pri: "p0" },
  { href: "/admin/staff", label: "Staff", icon: "shield", perm: "staff", pri: "p2" },
  { href: "/admin/settings", label: "Settings", icon: "settings", perm: "settings", pri: "p2" },
  { href: "/admin/daily-sales", label: "Daily Sales", icon: "receipt", perm: "reports", pri: "p0" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const db = useDB();
  const path = usePathname();
  const router = useRouter();
  const staff = currentStaff(db);
  useEffect(() => { if (!staff) router.replace("/"); }, [staff, router]);

  const items = NAV.filter((n) => !n.perm || can(db, n.perm));
  const low = useMemo(() => db.products.filter((p) => p.active && p.stock <= p.lowStock).sort((a, b) => a.stock - b.stock), [db.products]);
  const recentRefunds = useMemo(() => allBills(db).filter((b) => b.status !== "paid").slice(0, 3), [db]);
  const isOn = (href: string) => (href === "/admin" ? path === "/admin" : path?.startsWith(href));
  const signOut = () => { setDB((d) => { d.session.staffId = null; }); router.push("/"); };

  if (!staff) return null;
  const noAccess = !items.length;
  const notif = (db.settings.notify.lowStock ? low.length : 0) + (db.settings.notify.refunds ? recentRefunds.length : 0);

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="topnav on-dark">
        <div className="topnav-in">
          <Link href="/admin" aria-label="ICE BAY dashboard"><Logo size={38} dark /></Link>
          <nav className="navlinks" aria-label="Admin">
            {items.map((n) => (
              <Link key={n.href} href={n.href} className={cx("navlink", n.pri, isOn(n.href) && "on")}>{n.label}</Link>
            ))}
            {items.length > 1 && (
              <div className="navmore">
                <Dropdown align="left" width={230} trigger={(o) => <button className={cx("navlink", o && "on")}>More<Icon name="chevronDown" size={15} /></button>}>
                  {(close) => items.map((n) => (
                    <Link key={n.href} href={n.href} onClick={close} className={cx("menu-item", isOn(n.href) && "on")}><Icon name={n.icon} size={16} />{n.label}</Link>
                  ))}
                </Dropdown>
              </div>
            )}
          </nav>
          <div className="row g8">
            <Link href="/pos" className="btn btn-primary"><Icon name="cart" size={16} /><span className="hide-sm">POS / Billing</span></Link>
            <Dropdown width={330} trigger={() => (
              <button className="btn btn-ghost btn-icon" aria-label="Notifications" style={{ position: "relative" }}>
                <Icon name="bell" />
                {notif > 0 && <span style={{ position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 99, background: "var(--err)", color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 4px" }}>{notif}</span>}
              </button>
            )}>
              {(close) => (
                <div>
                  <div className="row between" style={{ padding: "8px 10px" }}><b>Notifications</b><span className="xs muted">{notif} new</span></div>
                  {db.settings.notify.lowStock && low.slice(0, 5).map((p) => (
                    <Link key={p.id} href="/admin/inventory" onClick={close} className="menu-item">
                      <span className="badge b-warn" style={{ width: 28, height: 28, padding: 0, justifyContent: "center", borderRadius: 8 }}><Icon name="alert" size={14} /></span>
                      <span className="grow"><span className="semi">{p.stock ? "Low stock" : "Out of stock"}: {p.name}</span><span className="xs muted" style={{ display: "block" }}>{p.stock} left · reorder at {p.lowStock}</span></span>
                    </Link>
                  ))}
                  {db.settings.notify.refunds && recentRefunds.map((b) => (
                    <Link key={b.id} href="/admin/reports" onClick={close} className="menu-item">
                      <span className="badge b-err" style={{ width: 28, height: 28, padding: 0, justifyContent: "center", borderRadius: 8 }}><Icon name="undo" size={14} /></span>
                      <span className="grow"><span className="semi">Bill {b.no} {b.status}</span><span className="xs muted" style={{ display: "block" }}>{inr(b.total)} · {fmtTime(b.date)}</span></span>
                    </Link>
                  ))}
                  {!notif && <div className="small muted" style={{ padding: 12 }}>You&apos;re all caught up.</div>}
                </div>
              )}
            </Dropdown>
            <Dropdown width={240} trigger={() => (
              <button className="btn btn-ghost" style={{ paddingLeft: 4, height: 44 }} aria-label="Account">
                <span className="avatar">{initials(staff.name)}</span>
                <span className="hide-sm" style={{ textAlign: "left", lineHeight: 1.2 }}><span className="semi" style={{ display: "block" }}>{staff.name.split(" ")[0]}</span><span className="xs muted">{staff.role}</span></span>
                <Icon name="chevronDown" size={16} />
              </button>
            )}>
              {(close) => (<>
                <div style={{ padding: "8px 10px" }}><div className="semi">{staff.name}</div><div className="xs muted">{staff.role} · {db.settings.shopName}</div></div>
                <Link href="/pos" className="menu-item" onClick={close}><Icon name="cart" size={16} />Open POS</Link>
                <button className="menu-item" onClick={() => { window.open("/display", "icebay-display", "popup,width=1280,height=800"); close(); }}><Icon name="monitor" size={16} />Customer display</button>
                {can(db, "settings") && <Link href="/admin/settings" className="menu-item" onClick={close}><Icon name="settings" size={16} />Settings</Link>}
                <button className="menu-item" onClick={signOut}><Icon name="logout" size={16} />Sign out</button>
              </>)}
            </Dropdown>
          </div>
        </div>
      </header>
      {noAccess ? (
        <div className="page"><div className="card card-pad center" style={{ maxWidth: 480, margin: "60px auto" }}>
          <div className="empty"><div className="ei"><Icon name="lock" size={24} /></div><div className="h3" style={{ color: "var(--ink)" }}>No admin access</div><div className="small">Your role ({staff.role}) can use the POS only.</div>
            <Link href="/pos" className="btn btn-primary mt8">Go to POS</Link></div>
        </div></div>
      ) : children}
    </div>
  );
}
