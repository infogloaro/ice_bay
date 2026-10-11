import type { CSSProperties } from "react";

// Stroke icons drawn on a 24px grid (2px stroke, round caps) for a consistent set.
const P: Record<string, string> = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  x: "M6 6l12 12 M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21a7 7 0 0 1 14 0 M16 3.5a4 4 0 0 1 0 7.5 M22 21a7 7 0 0 0-4-6.3",
  userPlus: "M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M3 21a7 7 0 0 1 12.5-4.3 M19 14v6 M16 17h6",
  cart: "M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-.01 M18 20a1 1 0 1 0 0-.01",
  bag: "M5 8h14l-1 13H6L5 8z M9 8V6a3 3 0 0 1 6 0v2",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3z M9 8h6 M9 12h6 M9 16h4",
  printer: "M7 9V3h10v6 M7 17H4v-7h16v7h-3 M7 14h10v7H7z",
  cash: "M3 6h18v12H3z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 9v.01 M18 15v.01",
  card: "M3 6h18v12H3z M3 10h18 M7 15h4",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2 M14 18h2 M18 18h2v2 M7 7v.01 M17 7v.01 M7 17v.01",
  gift: "M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7c-2-4-6-3-5 0 M12 7c2-4 6-3 5 0",
  tag: "M3 12V4h8l10 10-8 8L3 12z M7.5 8v.01",
  percent: "M19 5L5 19 M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z M10 21h4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  home: "M3 11l9-7 9 7 M5 10v10h14V10",
  chart: "M4 20V4 M4 20h16 M8 16v-4 M12 16V8 M16 16v-6",
  trend: "M3 17l6-6 4 4 8-8 M15 7h6v6",
  box: "M3 7l9-4 9 4-9 4-9-4z M3 7v10l9 4 9-4V7 M12 11v10",
  layers: "M12 3l9 5-9 5-9-5 9-5z M3 13l9 5 9-5 M3 17l9 5 9-5",
  grid: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6v.01 M3 12v.01 M3 18v.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  calendar: "M4 6h16v15H4z M4 10h16 M8 3v5 M16 3v5",
  logout: "M15 4h4v16h-4 M10 17l5-5-5-5 M15 12H3",
  monitor: "M3 4h18v12H3z M8 21h8 M12 16v5",
  pause: "M8 5v14 M16 5v14",
  play: "M7 5l12 7-12 7V5z",
  edit: "M4 20h4L19 9l-4-4L4 16v4z M13.5 6.5l4 4",
  download: "M12 4v12 M7 11l5 5 5-5 M4 20h16",
  upload: "M12 20V8 M7 13l5-5 5 5 M4 4h16",
  filter: "M4 5h16l-6 8v6l-4-2v-4L4 5z",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  arrowLeft: "M19 12H5 M11 6l-6 6 6 6",
  arrowRight: "M5 12h14 M13 6l6 6-6 6",
  alert: "M12 3l10 18H2L12 3z M12 10v5 M12 18v.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v6 M12 7.5v.01",
  refresh: "M20 11a8 8 0 0 0-14.9-3 M4 4v4h4 M4 13a8 8 0 0 0 14.9 3 M20 20v-4h-4",
  undo: "M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
  key: "M15 9a4 4 0 1 1-1 2.7L4 21H3v-3l2-2h2v-2h2l2.3-2.3 M17 7v.01",
  store: "M3 9l2-5h14l2 5 M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9z M5 13v8h14v-8 M10 21v-5h4v5",
  truck: "M3 6h11v10H3z M14 10h4l3 3v3h-7 M7 19a2 2 0 1 0 0-.01 M17 19a2 2 0 1 0 0-.01",
  phone: "M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z",
  database: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  palette: "M12 3a9 9 0 0 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4-4-7.5-9-7.5z M7.5 11v.01 M10 7.5v.01 M15 7.5v.01",
  more: "M5 12v.01 M12 12v.01 M19 12v.01",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  maximize: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5",
  wifi: "M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5v.01",
  scan: "M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M4 12h16",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  lock: "M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M3 7l12-4v4 M16 13.5v.01",
  // category glyphs
  pop: "M8 3h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M11 17v4h2v-4 M10 7v6 M14 7v6",
  scoop: "M7 12a5 5 0 0 1 10 0 M5 12h14l-1.5 8h-11L5 12z M9 8.5c.5-1 1.5-1.5 3-1.5",
  cone: "M7 10a5 5 0 0 1 10 0 M7 10h10l-5 11-5-11z M9.5 13.5l4 2 M10.5 16.5l2.5 1.2",
  cup: "M5 9h14l-1.5 11h-11L5 9z M7.5 9a4.5 4 0 0 1 9 0 M8 14h8",
  sundae: "M6 11a6 5 0 0 1 12 0 M4 11h16 M6 11c0 3 2.7 5 6 5s6-2 6-5 M12 16v4 M8 21h8 M11 5.5l1-2",
  shake: "M7 7h10l-1.5 14h-7L7 7z M6 7h12 M14 7l2-5 M9 4.5a3 2.5 0 0 1 6 0",
  falooda: "M7 3h10l-2 18H9L7 3z M7.6 9h8.8 M8.5 15h7 M11 12v.01 M13 18v.01",
  waffle: "M4 6h16v12H4z M8 6v12 M12 6v12 M16 6v12 M4 10h16 M4 14h16",
  cake: "M4 11h16v9H4z M4 15c2.7 1.5 5.3 1.5 8 0s5.3-1.5 8 0 M12 4v4 M12 4c-1 1-1 2 0 2s1-1 0-2",
  pack: "M5 8h14v12H5z M4 5h16v3H4z M9 12h6",
  drink: "M6 4h12l-1.5 17h-9L6 4z M6.6 10h10.8 M14 4l2-2",
  topping: "M8 7l1.5 1.5 M15 6l-1 2 M5 13l2 .5 M18 12l1.5 1.5 M11 12l.5 2 M14 16l2 .5 M7 18l1-1.5 M11 18.5l1.5.5 M12 3v2",
};

export function Icon({ name, size = 18, stroke = 2, style, className }: { name: string; size?: number; stroke?: number; style?: CSSProperties; className?: string }) {
  const d = P[name] ?? P.info;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }} className={className}>
      <path d={d} />
    </svg>
  );
}

/** Brand mark: the ICE BAY drip-pop logo (public/logo.png). `dark` = placed on the navy header. */
export function Logo({ size = 32, word = true, sub, onYellow, dark }: { size?: number; word?: boolean; sub?: string; onYellow?: boolean; dark?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3 }}>
      <span style={{ width: size, height: size, borderRadius: size * 0.28, background: dark ? "#fff" : "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="ICE BAY" style={{ height: size * (dark ? 0.86 : 1), width: "auto", display: "block" }} />
      </span>
      {word && (
        <span className="logo-word" style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span className="display" style={{ fontSize: size * 0.56, fontWeight: 800, letterSpacing: "0.02em", color: dark ? "#fff" : "var(--ink)" }}>
            ICE<span style={{ display: "inline-block", width: size * 0.16 }} /><span style={{ color: dark ? "var(--yellow)" : undefined }}>BAY</span>
          </span>
          {sub && <span style={{ fontSize: Math.max(10, size * 0.3), color: dark ? "var(--ice)" : onYellow ? "#5a4300" : "var(--muted)", marginTop: 3, fontWeight: 600 }}>{sub}</span>}
        </span>
      )}
    </span>
  );
}
