"use client";
import { useSyncExternalStore } from "react";
import type { AuditEntry, DB, Permission, Staff } from "./types";
import { DB_VERSION, makeSeed } from "./data";
import { uid } from "./util";

const KEY = "icebay-db";
let state: DB | null = null;
let serverState: DB | null = null;
const listeners = new Set<() => void>();

function save(s: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); }
  catch (e) { console.warn("ICE BAY: could not persist state", e); }
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.version === DB_VERSION) return parsed;
    }
  } catch { /* fall through to seed */ }
  const seed = makeSeed();
  save(seed);
  return seed;
}

let wired = false;
function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  // Keep every open tab (POS, admin, display) in step.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try {
      state = e.newValue ? (JSON.parse(e.newValue) as DB) : load();
      listeners.forEach((l) => l());
    } catch { /* ignore */ }
  });
}

export function getDB(): DB {
  if (typeof window === "undefined") return (serverState ??= makeSeed(new Date("2026-01-01T12:00:00")));
  wire();
  return (state ??= load());
}

const getServer = () => (serverState ??= makeSeed(new Date("2026-01-01T12:00:00")));

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Mutate a draft copy of the database; the change is persisted and broadcast. */
export function setDB(fn: (draft: DB) => void | DB) {
  const draft = structuredClone(getDB());
  const result = fn(draft);
  state = (result as DB) || draft;
  save(state);
  listeners.forEach((l) => l());
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, getServer);
}

export function resetDB() {
  state = makeSeed();
  save(state);
  listeners.forEach((l) => l());
}

export function replaceDB(next: DB) {
  state = next;
  save(state);
  listeners.forEach((l) => l());
}

export function addAudit(d: DB, action: string, detail: string) {
  const e: AuditEntry = { id: uid("a-"), date: new Date().toISOString(), by: d.session.staffId || "system", action, detail };
  d.audit.unshift(e);
  if (d.audit.length > 400) d.audit.length = 400;
}

export function currentStaff(d: DB): Staff | undefined {
  return d.staff.find((s) => s.id === d.session.staffId);
}

export function can(d: DB, p: Permission): boolean {
  const s = currentStaff(d);
  if (!s) return false;
  return d.settings.permissions[s.role]?.includes(p) ?? false;
}

export function staffName(d: DB, id?: string) {
  return d.staff.find((s) => s.id === id)?.name ?? (id === "system" ? "System" : "—");
}
