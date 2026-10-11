"use client";
import { ReactNode } from "react";
import { ConfirmHost, Toasts, useMounted } from "./ui";
import { Logo } from "./Icon";

/** Renders the app only on the client: all demo data lives in the browser. */
export default function ClientRoot({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#fff" }}>
        <div className="pulse"><Logo size={44} /></div>
      </div>
    );
  }
  return (
    <>
      {children}
      <Toasts />
      <ConfirmHost />
    </>
  );
}
