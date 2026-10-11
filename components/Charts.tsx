"use client";
import { useEffect, useRef, useState } from "react";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const compact = (n: number) =>
  n >= 1e7 ? (n / 1e7).toFixed(1) + "Cr" : n >= 1e5 ? (n / 1e5).toFixed(1) + "L" : n >= 1000 ? (n / 1000).toFixed(n >= 1e4 ? 0 : 1) + "k" : String(Math.round(n));

export interface Pt { label: string; value: number; value2?: number }

export function AreaChart({ data, height = 240, format = (n: number) => String(n), name = "Sales", name2, prefix = "₹" }: {
  data: Pt[]; height?: number; format?: (n: number) => string; name?: string; name2?: string; prefix?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.value, d.value2 ?? 0))));
  const x = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = (k: "value" | "value2") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y((d[k] as number) ?? 0).toFixed(1)}`).join(" ");
  const area = `${line("value")} L${x(data.length - 1)} ${pad.t + ih} L${x(0)} ${pad.t + ih} Z`;
  const step = Math.ceil(data.length / Math.max(2, Math.floor(iw / 56)));
  const has2 = data.some((d) => d.value2 !== undefined);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg width={w} height={height} style={{ display: "block" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left - pad.l) / iw) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}>
        <defs>
          <linearGradient id="ib-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFC629" stopOpacity="0.42" />
            <stop offset="1" stopColor="#FFC629" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="#EFEFF1" strokeDasharray={t ? "3 4" : undefined} />
            <text x={pad.l - 8} y={y(max * t) + 4} textAnchor="end" fontSize="11" fill="#888">{prefix}{compact(max * t)}</text>
          </g>
        ))}
        {data.map((d, i) => i % step === 0 && (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="#888">{d.label}</text>
        ))}
        {has2 && <path d={line("value2")} fill="none" stroke="#B9B9BE" strokeWidth="2" strokeDasharray="5 5" />}
        <path d={area} fill="url(#ib-area)" />
        <path d={line("value")} fill="none" stroke="#E8BF00" strokeWidth="2.75" strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#13284B" strokeOpacity=".18" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5.5" fill="#FFC629" stroke="#13284B" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div style={{ position: "absolute", top: 4, left: Math.min(Math.max(x(hover) - 70, 0), w - 150), width: 150, pointerEvents: "none" }}
          className="card small">
          <div style={{ padding: "8px 10px" }}>
            <div className="semi">{data[hover].label}</div>
            <div className="row between"><span className="row g6"><span className="dot" style={{ color: "#FFC629" }} />{name}</span><b className="num">{format(data[hover].value)}</b></div>
            {has2 && <div className="row between muted"><span className="row g6"><span className="dot" style={{ color: "#B9B9BE" }} />{name2}</span><span className="num">{format(data[hover].value2 ?? 0)}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, height = 240, format = (n: number) => String(n), prefix = "₹" }: { data: Pt[]; height?: number; format?: (n: number) => string; prefix?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 8, t: 12, b: 28 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const bw = iw / Math.max(1, data.length);
  const peak = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);
  const step = Math.ceil(data.length / Math.max(2, Math.floor(iw / 44)));
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg width={w} height={height} style={{ display: "block" }} onMouseLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = pad.t + ih - t * ih;
          return (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={yy} y2={yy} stroke="#EFEFF1" strokeDasharray={t ? "3 4" : undefined} />
              <text x={pad.l - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="#888">{prefix}{compact(max * t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * ih;
          const bx = pad.l + i * bw + bw * 0.18, bwi = bw * 0.64;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={ih} fill="transparent" />
              <rect x={bx} y={pad.t + ih - h} width={bwi} height={Math.max(h, d.value ? 2 : 0)} rx={Math.min(6, bwi / 2)}
                fill={hover === i ? "#13284B" : i === peak ? "#FFC629" : "#FFDD7A"} />
              {i % step === 0 && <text x={bx + bwi / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#888">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="card small" style={{ position: "absolute", top: 4, left: Math.min(Math.max(pad.l + hover * bw + bw / 2 - 60, 0), w - 130), width: 130, padding: "8px 10px", pointerEvents: "none" }}>
          <div className="muted xs semi">{data[hover].label}</div>
          <div className="bold num">{format(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
}

export const DONUT_COLORS = ["#FFC629", "#13284B", "#A8D8DE", "#5B7BA8", "#FFDD7A"];

export function Donut({ data, size = 168, thickness = 26, center }: { data: { label: string; value: number; color?: string }[]; size?: number; thickness?: number; center?: React.ReactNode }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F1F3" strokeWidth={thickness} />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color ?? DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth={thickness} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </svg>
      {center && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>{center}</div>}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; value: string; sub?: string; color: string }[] }) {
  return (
    <div className="col g12" style={{ flex: 1, minWidth: 0 }}>
      {items.map((it) => (
        <div key={it.label} className="row between g12">
          <span className="row g8 ellipsis"><span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, border: "1px solid rgba(0,0,0,.08)", flexShrink: 0 }} /><span className="semi ellipsis">{it.label}</span></span>
          <span className="right"><b className="num">{it.value}</b>{it.sub && <span className="muted xs" style={{ marginLeft: 6 }}>{it.sub}</span>}</span>
        </div>
      ))}
    </div>
  );
}
