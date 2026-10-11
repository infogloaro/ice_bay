export const inr = (n: number, decimals = 0) =>
  "₹" + (Math.round(n * 100) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });

export const inr2 = (n: number) => inr(n, 2);

export const num = (n: number) => n.toLocaleString("en-IN");

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const uid = (p = "") => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ymd = (d: Date) => {
  const z = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

export const maskPhone = (p: string) => (p.length >= 4 ? "•••••• " + p.slice(-4) : p);

export function downloadFile(name: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function toCSV(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}

export function resizeImage(file: File, max = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = r.result as string;
    };
    r.readAsDataURL(file);
  });
}
