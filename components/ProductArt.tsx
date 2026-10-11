import { memo, useId } from "react";
import type { Art } from "@/lib/types";

function mix(hex: string, w: number, target = 255) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * (1 - w) + target * w));
  return `rgb(${ch.join(",")})`;
}
const shade = (hex: string, w = 0.18) => mix(hex, w, 0);

function Scoop({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const dark = shade(color, 0.12);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} />
      {[-0.66, -0.22, 0.22, 0.66].map((k, i) => (
        <circle key={i} cx={cx + k * r} cy={cy + r * 0.62 + (i % 2) * r * 0.08} r={r * 0.3} fill={color} />
      ))}
      <path d={`M${cx - r * 0.95} ${cy + r * 0.25} Q${cx} ${cy + r * 1.05} ${cx + r * 0.95} ${cy + r * 0.25}`} fill="none" stroke={dark} strokeWidth={r * 0.08} opacity="0.45" strokeLinecap="round" />
      <ellipse cx={cx - r * 0.38} cy={cy - r * 0.42} rx={r * 0.32} ry={r * 0.2} fill="#fff" opacity="0.45" transform={`rotate(-28 ${cx - r * 0.38} ${cy - r * 0.42})`} />
    </g>
  );
}

function Cherry({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y - 5} q3 -9 9 -11`} stroke="#5B7B2A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx={x} cy={y} r="6.5" fill="#D7263D" />
      <circle cx={x - 2} cy={y - 2} r="1.8" fill="#fff" opacity=".6" />
    </g>
  );
}

function Body({ art, gid }: { art: Art; gid: string }) {
  const { kind, color } = art;
  const c2 = art.color2 ?? color;
  const glass = "rgba(214,232,240,0.55)";
  const glassStroke = "rgba(140,170,185,0.7)";
  switch (kind) {
    case "scoop":
      return (
        <g>
          <path d="M58 92h84l-9 30a8 8 0 0 1-7.6 5.5H74.6A8 8 0 0 1 67 122L58 92z" fill="#fff" stroke="#E2E2E2" strokeWidth="2" />
          <rect x="54" y="88" width="92" height="8" rx="4" fill="#FFD600" />
          <Scoop cx={100} cy={70} r={27} color={color} />
        </g>
      );
    case "cone": {
      const coneC = art.accent ? "#D99A4E" : "#E2A75A";
      return (
        <g>
          <path d="M76 82h48l-24 56z" fill={coneC} />
          <path d={`M80 90l30 14 M83 99l22 10 M88 110l13 6 M120 90l-28 14 M117 99l-20 10 M112 110l-11 6`} stroke={shade(coneC, 0.2)} strokeWidth="2" strokeLinecap="round" />
          {art.color2 && <Scoop cx={100} cy={48} r={19} color={c2} />}
          <Scoop cx={100} cy={art.color2 ? 74 : 66} r={art.color2 ? 22 : 25} color={color} />
          {art.accent && <path d="M75 62a25 25 0 0 1 50 0c-6 4-9-2-13 4-4-6-8 2-12-2-4 5-8-3-12 2-5-4-8 2-13-4z" fill={art.accent} />}
          {art.accent && [82, 92, 104, 114].map((x, i) => <rect key={i} x={x} y={48 + (i % 2) * 5} width="3" height="3" rx="1" fill="#F2D29B" transform={`rotate(${i * 30} ${x} 50)`} />)}
        </g>
      );
    }
    case "cup":
      return (
        <g>
          <path d="M66 74h68l-7 52a6 6 0 0 1-6 5H79a6 6 0 0 1-6-5l-7-52z" fill="#fff" stroke="#E2E2E2" strokeWidth="2" />
          <path d="M68 92h64l-1.6 12H69.6z" fill="#FFD600" />
          <path d="M69.6 104h60.8" stroke="#171717" strokeWidth="2" />
          <path d="M64 74c0-18 16-28 36-28s36 10 36 28z" fill={color} />
          <ellipse cx="86" cy="58" rx="9" ry="5" fill="#fff" opacity=".45" transform="rotate(-20 86 58)" />
          <rect x="114" y="34" width="6" height="34" rx="3" fill="#D8B27A" transform="rotate(24 117 51)" />
        </g>
      );
    case "sundae":
      return (
        <g>
          <path d="M60 78h80c0 22-18 34-40 34s-40-12-40-34z" fill={glass} stroke={glassStroke} strokeWidth="2" />
          <path d="M96 112h8v14h-8z M78 130c0-4 10-6 22-6s22 2 22 6z" fill={glass} stroke={glassStroke} strokeWidth="2" />
          <Scoop cx={84} cy={70} r={18} color={color} />
          <Scoop cx={116} cy={70} r={18} color={c2} />
          <Scoop cx={100} cy={52} r={18} color={color} />
          {art.accent && <path d="M84 44c4 8 10-2 16 6s12-4 16 4c2 6-4 6-6 2-3 8-8 0-10 6-3-6-8 2-10-4-4 4-8-6-6-14z" fill={art.accent} opacity=".95" />}
          <Cherry x={102} y={34} />
          <rect x="120" y="22" width="8" height="34" rx="3" fill="#E9C27D" transform="rotate(18 124 39)" />
        </g>
      );
    case "shake":
      return (
        <g>
          <path d="M72 50h56l-6 78a6 6 0 0 1-6 5H84a6 6 0 0 1-6-5l-6-78z" fill={glass} stroke={glassStroke} strokeWidth="2" />
          <path d="M74 64h52l-5 63a5 5 0 0 1-5 4H84a5 5 0 0 1-5-4l-5-63z" fill={color} />
          {art.accent && [[84, 80], [104, 96], [92, 110], [112, 76], [96, 122], [114, 112]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={art.accent} />)}
          <path d="M68 52c0-10 10-12 14-10 2-8 14-10 18-4 6-6 18-2 18 6 6 0 12 4 10 10z" fill="#FFFDF7" stroke="#EEE6D6" strokeWidth="1.5" />
          <g transform="rotate(14 112 30)">
            <rect x="108" y="10" width="8" height="48" rx="3" fill="#FFD600" />
            {[14, 24, 34, 44].map((y) => <rect key={y} x="108" y={y} width="8" height="4" fill="#171717" />)}
          </g>
          <ellipse cx="84" cy="86" rx="3" ry="16" fill="#fff" opacity=".35" />
        </g>
      );
    case "falooda":
      return (
        <g>
          <path d="M74 40h52l-7 88a6 6 0 0 1-6 5H87a6 6 0 0 1-6-5l-7-88z" fill={glass} stroke={glassStroke} strokeWidth="2" />
          <path d="M80 104h40l-2 23a4 4 0 0 1-4 4H86a4 4 0 0 1-4-4z" fill={color} />
          <path d="M78 78h44l-2.2 26H80.2z" fill="#FBF6EC" />
          {[[88, 86], [98, 92], [108, 84], [92, 98], [112, 96], [102, 80]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#2E2E2E" />)}
          <path d="M77 62h46l-1.4 16H78.4z" fill={mix(color, 0.4)} />
          <Scoop cx={100} cy={44} r={20} color={c2} />
          <path d="M84 36c5 6 10-2 16 4s12-2 16 2" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
          <Cherry x={100} y={24} />
        </g>
      );
    case "waffle":
      return (
        <g>
          <ellipse cx="100" cy="122" rx="54" ry="8" fill="#000" opacity=".06" />
          <rect x="52" y="80" width="96" height="40" rx="10" fill={color} />
          {[64, 80, 96, 112, 128].map((x) => <path key={x} d={`M${x} 84v32`} stroke={shade(color, 0.22)} strokeWidth="3" />)}
          {[92, 104].map((y) => <path key={y} d={`M56 ${y}h88`} stroke={shade(color, 0.22)} strokeWidth="3" />)}
          {art.color2 ? <Scoop cx={100} cy={64} r={22} color={c2} /> : null}
          {art.accent && <path d="M58 86c10 8 16-6 26 2s14-6 24 2 16-6 26 2c4 3 6 0 8-2" stroke={art.accent} strokeWidth="5" fill="none" strokeLinecap="round" />}
          {art.color2 && <Cherry x={102} y={42} />}
        </g>
      );
    case "cake":
      return (
        <g>
          <ellipse cx="100" cy="126" rx="58" ry="8" fill="#000" opacity=".06" />
          <rect x="46" y="120" width="108" height="6" rx="3" fill="#E8E8E8" />
          <path d="M54 66h92v52a4 4 0 0 1-4 4H58a4 4 0 0 1-4-4z" fill={color} />
          <rect x="54" y="86" width="92" height="10" fill={c2} />
          <rect x="54" y="106" width="92" height="6" fill={c2} opacity=".8" />
          <path d="M52 64c0-6 4-10 10-10h76c6 0 10 4 10 10v6c-4 6-8-2-12 4-4-8-8 2-12-2-4 8-8-2-12 2-4-6-8 4-12-2-4 8-8-2-12 2-4-6-8 4-12-2-4 6-8-2-14 2z" fill={art.accent ? "#FFFDF7" : mix(c2, 0.15)} />
          {[70, 100, 130].map((x) => (art.accent ? <Cherry key={x} x={x} y={52} /> : <circle key={x} cx={x} cy={54} r="5" fill={shade(color, 0.25)} />))}
        </g>
      );
    case "pack":
      return (
        <g>
          <ellipse cx="100" cy="128" rx="44" ry="6" fill="#000" opacity=".06" />
          <path d="M60 58h80l-6 66a6 6 0 0 1-6 5H72a6 6 0 0 1-6-5z" fill="#fff" stroke="#E2E2E2" strokeWidth="2" />
          <path d="M62.6 82h74.8l-2.4 26H65z" fill={color} />
          <text x="100" y="100" textAnchor="middle" fontSize="11" fontWeight="800" fill="#171717" fontFamily="Bricolage Grotesque, sans-serif" letterSpacing="1">ICE BAY</text>
          <rect x="54" y="46" width="92" height="14" rx="5" fill={art.accent ?? "#FFD600"} />
          <path d="M70 46c4-10 14-12 22-8 6-6 18-4 22 2 6-2 14 0 16 6z" fill={color} />
        </g>
      );
    case "drink": {
      const bottle = color === "#9FD3E6";
      if (bottle) return (
        <g>
          <path d="M90 22h20v10c0 4 12 8 12 18v72a6 6 0 0 1-6 6H84a6 6 0 0 1-6-6V50c0-10 12-14 12-18z" fill="rgba(190,226,240,.65)" stroke="#8CB8C9" strokeWidth="2" />
          <rect x="88" y="16" width="24" height="10" rx="3" fill="#2F7FA3" />
          <rect x="78" y="70" width="44" height="26" fill="#FFD600" />
          <text x="100" y="87" textAnchor="middle" fontSize="9" fontWeight="800" fill="#171717" fontFamily="sans-serif">ICE BAY</text>
        </g>
      );
      const hot = color === "#6B3E26";
      return (
        <g>
          {hot ? (
            <g>
              <path d="M66 62h62v40a24 24 0 0 1-24 24H90a24 24 0 0 1-24-24z" fill="#fff" stroke="#E2E2E2" strokeWidth="2" />
              <path d="M128 72h6a10 10 0 0 1 0 20h-6" fill="none" stroke="#E2E2E2" strokeWidth="5" />
              <ellipse cx="97" cy="64" rx="29" ry="6" fill={color} />
              <path d="M86 50c-4-6 4-10 0-16 M98 48c-4-6 4-10 0-16 M110 50c-4-6 4-10 0-16" stroke="#C9C9C9" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <path d="M74 40h52l-6 86a6 6 0 0 1-6 5H86a6 6 0 0 1-6-5z" fill={glass} stroke={glassStroke} strokeWidth="2" />
              <path d="M76 58h48l-5 68a4 4 0 0 1-4 4H85a4 4 0 0 1-4-4z" fill={color} opacity=".85" />
              {[[90, 80], [106, 96], [96, 112]].map(([x, y], i) => <rect key={i} x={x} y={y} width="10" height="10" rx="2" fill="#fff" opacity=".6" />)}
              <circle cx="122" cy="44" r="13" fill="#9BC53D" stroke="#fff" strokeWidth="3" />
              <path d="M122 31v26 M109 44h26" stroke="#fff" strokeWidth="1.5" />
            </g>
          )}
        </g>
      );
    }
    case "topping": {
      const c3 = art.color2 ?? shade(color, 0.15);
      return (
        <g>
          <path d="M56 84h88c0 24-20 38-44 38S56 108 56 84z" fill="#fff" stroke="#E2E2E2" strokeWidth="2" />
          <ellipse cx="100" cy="84" rx="44" ry="10" fill={color === "#FFFFFF" ? "#FFFDF7" : color} stroke={color === "#FFFFFF" ? "#EEE6D6" : "none"} />
          {[[78, 74], [92, 68], [108, 72], [122, 76], [86, 80], [116, 66], [100, 78]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="8" height="5" rx="2.5" fill={i % 2 ? c3 : shade(color, 0.12)} transform={`rotate(${i * 40} ${x} ${y})`} />
          ))}
        </g>
      );
    }
    case "combo":
      return (
        <g>
          <g transform="translate(-30 6) scale(.85)">
            <path d="M76 82h48l-24 56z" fill="#E2A75A" />
            <Scoop cx={100} cy={66} r={24} color={color} />
          </g>
          <g transform="translate(46 20) scale(.75)">
            <path d="M66 74h68l-7 52a6 6 0 0 1-6 5H79a6 6 0 0 1-6-5l-7-52z" fill="#fff" stroke="#E2E2E2" strokeWidth="2.5" />
            <path d="M68 92h64l-1.6 12H69.6z" fill="#FFD600" />
            <path d="M64 74c0-18 16-28 36-28s36 10 36 28z" fill={c2} />
          </g>
        </g>
      );
  }
  return null;
}

function ProductArtBase({ art, image, alt = "", rounded = 14, bg = true }: { art: Art; image?: string; alt?: string; rounded?: number; bg?: boolean }) {
  const gid = useId();
  if (image) {
    return <img src={image} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: rounded, display: "block" }} />;
  }
  const tint = mix(art.color, 0.86);
  return (
    <svg viewBox="0 0 200 150" role="img" aria-label={alt} style={{ width: "100%", height: "100%", display: "block", borderRadius: rounded }}>
      {bg && <rect width="200" height="150" fill={tint} />}
      {bg && <circle cx="100" cy="86" r="58" fill="#fff" opacity=".55" />}
      <ellipse cx="100" cy="134" rx="40" ry="5" fill="#000" opacity=".05" />
      <Body art={art} gid={gid} />
    </svg>
  );
}

export const ProductArt = memo(ProductArtBase);
