export type Role = "Admin" | "Manager" | "Cashier";
export type PayMethod = "cash" | "upi" | "card" | "other";

export type ArtKind =
  | "scoop" | "cone" | "cup" | "sundae" | "shake" | "falooda"
  | "waffle" | "cake" | "pack" | "drink" | "topping" | "combo";

export interface Art { kind: ArtKind; color: string; color2?: string; accent?: string }

export interface Category { id: string; name: string; icon: string; order: number; active: boolean }

export interface Variant { id: string; name: string; price: number }

export interface Product {
  id: string; sku: string; name: string; categoryId: string;
  desc: string; variants: Variant[];      // first variant = default; price is absolute
  art: Art; image?: string;               // image = uploaded data URL or /public path
  stock: number; lowStock: number;
  badge?: string; toppings: boolean; active: boolean; featured?: boolean;
}

export interface CartAddOn { id: string; name: string; price: number }

export interface CartLine {
  key: string; productId: string; categoryId: string; name: string;
  variant: string; addOns: CartAddOn[]; unitPrice: number; qty: number;
}

export interface Customer {
  id: string; name: string; phone: string; email?: string;
  points: number; visits: number; spent: number; joined: string; lastVisit?: string; birthday?: string;
  gender?: "Female" | "Male" | "Other"; anniversary?: string; address?: string; city?: string; pincode?: string; notes?: string;
}

export type OfferType = "percent" | "fixed" | "bogo" | "combo";

export interface Offer {
  id: string; name: string; type: OfferType; value: number;
  productIds: string[]; categoryIds: string[];   // empty = whole order (percent/fixed)
  minOrder: number; start: string; end: string;  // ISO dates (yyyy-mm-dd)
  usageLimit: number; used: number;              // 0 limit = unlimited
  stackable: boolean; autoApply: boolean; code?: string; active: boolean; desc?: string;
}

export interface AppliedDiscount { id: string; label: string; amount: number }

export interface BillLine {
  productId: string; categoryId: string; name: string; variant: string;
  addOns?: string[]; qty: number; unitPrice: number;
}

export interface Bill {
  id: string; no: string; date: string;
  lines: BillLine[]; subtotal: number; discounts: AppliedDiscount[]; discount: number;
  taxable: number; tax: number; roundOff: number; total: number;
  method: PayMethod; methodLabel?: string; ref?: string;
  customerId?: string; cashierId: string;
  pointsEarned: number; pointsRedeemed: number;
  status: "paid" | "refunded" | "void";
  cashReceived?: number; change?: number; demo?: boolean; // demo = generated history
}

export interface Staff {
  id: string; name: string; role: Role; phone: string; pin: string; active: boolean; joined: string;
}

export interface Shift {
  id: string; staffId: string; openedAt: string; closedAt?: string;
  openingCash: number; countedCash?: number; expectedCash?: number; note?: string;
}

export type MoveType = "sale" | "purchase" | "wastage" | "adjust" | "refund";
export interface StockMove {
  id: string; productId: string; type: MoveType; qty: number; note?: string; date: string; by: string;
}

export interface Supplier { id: string; name: string; contact: string; phone: string; supplies: string; }

export interface Purchase {
  id: string; supplierId: string; date: string; invoice: string;
  items: { productId: string; qty: number; cost: number }[]; total: number; by: string;
}

export interface AuditEntry { id: string; date: string; by: string; action: string; detail: string }

export interface HeldOrder { id: string; at: string; lines: CartLine[]; customerId?: string; label: string }

export type Permission =
  | "pos" | "discounts" | "refunds" | "products" | "inventory" | "customers"
  | "offers" | "reports" | "staff" | "settings";

export interface Settings {
  shopName: string; tagline: string; address: string; phone: string; email: string;
  gstin: string; fssai: string;
  taxRate: number; taxInclusive: boolean; hsn: string;
  currency: string; currencySymbol: string; roundToRupee: boolean;
  receiptWidth: "58" | "80"; receiptHeader: string; receiptFooter: string; receiptShowLogo: boolean;
  methods: { cash: boolean; upi: boolean; card: boolean; other: boolean };
  otherMethodName: string; upiId: string; cardTerminal: string;
  lowStockDefault: number; blockOutOfStock: boolean;
  loyalty: { enabled: boolean; spendPerPoint: number; redeemPoints: number; redeemValue: number; minBill: number };
  display: { headline: string; subheadline: string; showPromos: boolean; rotateSec: number };
  notify: { lowStock: boolean; dailySummary: boolean; refunds: boolean; shiftVariance: boolean };
  permissions: Record<Role, Permission[]>;
}

export interface DB {
  version: number;
  settings: Settings;
  categories: Category[];
  products: Product[];
  customers: Customer[];
  offers: Offer[];
  staff: Staff[];
  bills: Bill[];
  billStatus: Record<string, "refunded" | "void">;
  stockMoves: StockMove[];
  suppliers: Supplier[];
  purchases: Purchase[];
  shifts: Shift[];
  audit: AuditEntry[];
  held: HeldOrder[];
  billSeq: number;
  session: { staffId: string | null };
}
