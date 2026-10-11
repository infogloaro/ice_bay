# ICE BAY POS — Demo Prototype

A clickable, fully working prototype of the ICE BAY ice cream shop POS: cashier billing screen, customer-facing second display, and admin back office. Light theme, navy + yellow brand (from the ICE BAY logo).

Built with **Next.js 16 + React 19 + TypeScript**. No database or backend: all data lives in the browser (localStorage), so it deploys to Vercel with zero configuration.

---

## Deploy to Vercel (about 3 minutes)

1. Unzip this folder and push it to a new GitHub repository:
   ```bash
   cd icebay
   git init && git add . && git commit -m "ICE BAY POS prototype"
   git branch -M main
   git remote add origin https://github.com/<you>/icebay-pos.git
   git push -u origin main
   ```
2. Go to **vercel.com → Add New → Project**, import the repository.
3. Framework preset: **Next.js** (auto-detected). No environment variables. Click **Deploy**.

Run locally instead: `npm install` then `npm run dev` and open http://localhost:3000 (Node 20.9 or newer).

---

## Demo logins

| Staff | Role | PIN | Lands on |
|---|---|---|---|
| Rohan Kapoor | Admin | 1111 | Admin dashboard (everything) |
| Priya Nair | Manager | 2222 | Admin dashboard (no staff/settings) |
| Karthik Subramanian | Cashier | 3333 | POS only |
| Divya Raman | Cashier | 4444 | POS only |

PINs are shown on the sign-in screen for the demo.

---

## Suggested client demo script (10 minutes)

**Setup:** two browser windows side by side (or a second monitor). Window 1: the app. Window 2: `/display` — or click **Display** in the POS top bar. Click the ⛶ button on the display for full screen.

1. **Sign in as Karthik (3333).** Open the shift with a ₹2,000 float.
2. **Point at the customer display** — idle welcome screen with rotating featured products and live offers.
3. **Build an order:** tap *Belgian Chocolate Scoop* → pick *Double* + *Hot Fudge* → Add. Quick-add (+) an *Oreo Milkshake* and a *Brownie Sundae*. Add two *Choco-Dip Cones*.
   - The display mirrors the order instantly.
   - Offers apply automatically: Buy 1 Get 1 on cones, Shake Hour 10%, Sundae + Shake combo ₹60.
4. **Add customer:** search “Ananya” → Add to bill. Or *Quick register* a new mobile number — the cart is untouched.
5. **Coupon:** type `FLAT50` → Apply (orders above ₹400). `DIWALI15` gives 15% off orders above ₹500. Coupons are non-stackable, so if a bigger non-stackable offer already applies the POS says so.
6. **Pay (F9):** UPI shows a real, scannable QR on both screens; it auto-confirms after 5 s (or *Check status*). Try *Simulate failure* to show the error state. Card → *Send to terminal* → *Simulate decline* → Retry. Cash → quick-amount buttons → change to return.
7. **Success:** receipt preview in 58 mm / 80 mm, *Print receipt* (browser print), customer display says thank-you with points earned. Press **Enter** for the next order.
8. **Hold an order** (Hold), start another, then recall it from **Held**.
9. **Account menu → Close shift:** expected vs counted cash, variance.
10. **Sign in as Rohan (1111)** for the back office:
    - **Dashboard** — today vs yesterday, hourly sales, payment mix, best sellers, low stock, promo performance.
    - **Products** — edit price/variants, upload a real photo, hide from POS (changes reach an open POS tab immediately).
    - **Inventory** — receive stock, record wastage, purchases, suppliers, full movement history.
    - **Customers** — loyalty balances, history, add/deduct points.
    - **Offers & Loyalty** — create a % / flat / BOGO / combo offer, dates, limits, stacking; loyalty earn/redeem rules.
    - **Sales & Reports** — gross → discounts → refunds → net, GST summary (CGST/SGST), cashier performance, CSV export. Open any bill to reprint, refund or void.
    - **Staff** — role permission matrix, shift reconciliation, audit log.
    - **Settings** — shop profile, GST, receipt layout with live preview, payment methods (add a real UPI ID to make the QR live), customer display text, **Reset demo data**.

**Before each client demo:** Settings → Data & backup → **Reset demo data** for a clean start.

---

## What is real vs simulated

| Area | In this prototype |
|---|---|
| Billing maths, offers, stacking, loyalty, GST split, round-off | Real logic, computed live |
| Stock deduction, low-stock alerts, refunds restocking | Real (in the browser) |
| UPI QR | Real, scannable QR. Without a UPI ID it encodes a harmless demo string; with a UPI ID in Settings it is a live UPI intent |
| UPI / card confirmation | **Simulated** (timer + buttons). A bill is only created after the simulated verification |
| Sales history | 45 days of generated demo sales, plus every bill you create |
| Data storage | Browser localStorage — each device/browser has its own data |
| Customer display sync | Real-time between windows/tabs of the same browser (BroadcastChannel) |
| Fonts | Bricolage Grotesque + Plus Jakarta Sans via Google Fonts |

Product images are original illustrations so nothing breaks offline. Upload real photos per product in **Admin → Products** (stored in the browser), or for permanent photos put files in `public/products/` and set `image: "/products/<file>.jpg"` on the product in `lib/data.ts`.

---

## Project structure

```
app/
  page.tsx              Staff sign-in (PIN)
  pos/page.tsx          Cashier POS: categories · products · cart
  display/page.tsx      Customer-facing second screen
  admin/layout.tsx      Top navigation, notifications, role guard
  admin/*/page.tsx      Dashboard, products, categories, inventory, customers,
                        offers, reports, staff, settings
components/
  pos/                  Customise, customer, payment, shift modals
  ui.tsx                Design-system primitives (modal, drawer, toast, switch…)
  Charts.tsx            SVG charts (area, bar, donut) — no chart library
  ProductArt.tsx        Product illustrations
  Receipt.tsx           58/80 mm thermal receipt + QR component
lib/
  calc.ts               Cart totals, offers, stacking, loyalty, GST
  store.ts              Persistent store (localStorage, cross-tab sync)
  sync.ts               POS → customer display channel
  history.ts            Generated sales history
  stats.ts              Report aggregations
  qr.ts                 Self-contained QR encoder
  data.ts               Seed menu, customers, offers, staff, settings
app/globals.css         Design tokens and all component styles
```

---

## Path to production

The UI is built to sit on the stack in the brief:

- **Backend:** NestJS + PostgreSQL. `lib/types.ts` maps directly to tables (products, variants, bills, bill_lines, customers, offers, stock_moves, shifts, audit).
- **Server-side totals:** move `lib/calc.ts` to the API so the server is the source of truth for every bill.
- **Payments:** Razorpay / PhonePe / Paytm for dynamic UPI QR with webhook verification; EDC terminal SDK (e.g. Pine Labs) for cards.
- **Real-time display:** replace BroadcastChannel with WebSocket/SSE per counter.
- **Auth:** hashed PINs, session tokens, server-enforced role permissions.
- **Printing:** ESC/POS via a print bridge for silent thermal printing.
