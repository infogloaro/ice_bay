"use client";
import { useEffect, useState } from "react";
import type { Art, PayMethod } from "./types";

/** What the customer-facing display shows. Contains no admin or private customer data. */
export interface DisplayState {
  mode: "idle" | "order" | "payment" | "success";
  billNo?: string;
  lines: { name: string; variant: string; addOns: string[]; qty: number; amount: number; art: Art; image?: string }[];
  itemCount: number;
  subtotal: number;
  discounts: { label: string; amount: number }[];
  tax: number; taxLabel: string; roundOff: number; total: number;
  customerFirstName?: string; points?: number; earn?: number;
  method?: PayMethod; methodLabel?: string; qr?: string; paymentStatus?: "idle" | "waiting" | "processing" | "failed" | "verified";
  cashReceived?: number; change?: number;
  ts: number;
}

const KEY = "icebay-display";
const CH = "icebay-display";

export const idleDisplay = (): DisplayState => ({
  mode: "idle", lines: [], itemCount: 0, subtotal: 0, discounts: [], tax: 0, taxLabel: "GST", roundOff: 0, total: 0, ts: Date.now(),
});

let channel: BroadcastChannel | null = null;
const getChannel = () => {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  return (channel ??= new BroadcastChannel(CH));
};

let last = "";
export function publishDisplay(s: DisplayState) {
  const json = JSON.stringify({ ...s, ts: 0 });
  if (json === last) return;
  last = json;
  const msg = { ...s, ts: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(msg)); } catch { /* ignore */ }
  getChannel()?.postMessage(msg);
}

export function useDisplayState(): DisplayState {
  const [s, setS] = useState<DisplayState>(idleDisplay);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setS(JSON.parse(raw)); } catch { /* ignore */ }
    const ch = getChannel();
    const onMsg = (e: MessageEvent) => setS(e.data);
    ch?.addEventListener("message", onMsg);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY && e.newValue) setS(JSON.parse(e.newValue)); };
    window.addEventListener("storage", onStorage);
    return () => { ch?.removeEventListener("message", onMsg); window.removeEventListener("storage", onStorage); };
  }, []);
  return s;
}
