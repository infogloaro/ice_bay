"use client";
import { DailySales } from "@/components/DailySales";
import { currentStaff, useDB } from "@/lib/store";

export default function DailySalesPage() {
  const db = useDB();
  return <div className="page" style={{ padding: 0 }}><DailySales cashierName={currentStaff(db)?.name ?? ""} /></div>;
}
