import type { Category, Customer, DB, Offer, Product, Settings, Staff, Supplier } from "./types";
import { addDays, mulberry32, ymd } from "./util";

export const DB_VERSION = 4;

// Menu modelled on icebay.in "Our Flavours". Photos in public/products/ come from icebay.in; prices are demo values.
export const categories: Category[] = [
  { id: "fruit", name: "Fruit Pops", icon: "pop", order: 1, active: true },
  { id: "mocktail", name: "Mocktail Pops", icon: "falooda", order: 2, active: true },
  { id: "dessert", name: "Dessert Pops", icon: "sparkle", order: 3, active: true },
  { id: "boxes", name: "Party Boxes", icon: "pack", order: 4, active: true },
  { id: "drinks", name: "Beverages", icon: "drink", order: 5, active: true },
  { id: "toppings", name: "Add-ons", icon: "topping", order: 6, active: true },
  { id: "combos", name: "Offers", icon: "tag", order: 7, active: true },
];

type P = Omit<Product, "sku" | "active" | "lowStock"> & { lowStock?: number };
const popV = (b: number) => [{ id: "single", name: "Single", price: b }, { id: "four", name: "Pack of 4", price: b * 4 - 20 }];
const one = (b: number, name = "Regular") => [{ id: "std", name, price: b }];
const img = (f: string) => `/products/${f}.jpg`;
const pop = (id: string, name: string, categoryId: string, price: number, color: string, desc: string, stock: number, extra: Partial<P> = {}): P =>
  ({ id: "p-" + id, name, categoryId, desc, variants: popV(price), art: { kind: "cup", color }, image: img(id), stock, toppings: true, ...extra });

const raw: P[] = [
  // Fruit pops
  pop("watermelon", "Water Melon", "fruit", 60, "#F25C6A", "Fresh watermelon juice, frozen on a stick.", 80, { badge: "Bestseller", featured: true }),
  pop("pink-guava", "Pink Guava", "fruit", 60, "#F48FA3", "Pink guava pulp with a pinch of salt.", 54),
  pop("pineapple", "Pineapple", "fruit", 60, "#F7D046", "Juicy pineapple chunks in every bite.", 62),
  pop("raspberry", "Raspberry", "fruit", 70, "#E2557A", "Tangy raspberry with real berry bits.", 40),
  pop("orange", "Orange", "fruit", 60, "#FF9F1C", "Squeezed orange, sunshine on a stick.", 66),
  pop("pomegranate", "Pomegranate", "fruit", 70, "#C21E3A", "Ruby pomegranate pearls, lightly sweet.", 36),
  pop("mango", "Mango", "fruit", 70, "#FFB21E", "Alphonso mango pulp, thick and creamy.", 92, { badge: "Bestseller", featured: true }),
  pop("green-mango", "Green Mango", "fruit", 60, "#A8C94A", "Raw mango with chilli-salt kick.", 48, { badge: "Buy 1 Get 1" }),
  pop("grape", "Grape", "fruit", 60, "#7B3FA0", "Black grape juice, cool and tart.", 44),
  pop("passion-fruit", "Passion Fruit", "fruit", 80, "#F2A93B", "Tropical passion fruit with seeds.", 8, { badge: "New" }),
  pop("blueberry", "Blue Berry", "fruit", 80, "#6C6FC9", "Blueberry and yogurt swirl.", 38, { featured: true }),
  pop("green-apple", "Green Apple", "fruit", 70, "#8CC63F", "Crisp green apple, sweet-sour.", 0),
  // Mocktail pops
  pop("mojito", "Mojito", "mocktail", 70, "#BFE3A4", "Lime, mint and soda — virgin mojito pop.", 58, { featured: true }),
  pop("mint", "Mint", "mocktail", 60, "#7ED3B2", "Cooling mint lemonade.", 42),
  pop("rose-water", "Rose Water", "mocktail", 70, "#F3A0B5", "Gulab rose water with sabja seeds.", 6),
  // Dessert pops
  pop("rasamalai", "Rasamalai", "dessert", 90, "#F2D7A0", "Saffron milk, cardamom, almond slivers.", 46, { badge: "Signature", featured: true }),
  pop("butterscotch", "Butterscotch", "dessert", 80, "#E8B25E", "Caramel butterscotch with praline crunch.", 51),
  // Party boxes
  { id: "b-assorted6", name: "Assorted Box of 6", categoryId: "boxes", desc: "Pick any six flavours.", variants: one(379, "Box of 6"), art: { kind: "pack", color: "#FFC629" }, image: img("box-assorted-6"), stock: 24, lowStock: 5, toppings: false, featured: true, badge: "Save ₹41" },
  { id: "b-fruit12", name: "Fruit Fiesta Box of 12", categoryId: "boxes", desc: "Twelve fruit pops for parties.", variants: one(699, "Box of 12"), art: { kind: "pack", color: "#FF9F1C" }, image: img("box-fruit-12"), stock: 14, lowStock: 4, toppings: false, badge: "Party" },
  { id: "b-mocktail3", name: "Mocktail Trio", categoryId: "boxes", desc: "Mojito, Mint and Rose Water.", variants: one(189, "3 pops"), art: { kind: "pack", color: "#BFE3A4" }, image: img("box-mocktail-trio"), stock: 20, lowStock: 5, toppings: false },
  { id: "b-dessert2", name: "Dessert Duo", categoryId: "boxes", desc: "Rasamalai + Butterscotch.", variants: one(159, "2 pops"), art: { kind: "pack", color: "#F2D7A0" }, image: img("box-dessert-duo"), stock: 20, lowStock: 5, toppings: false },
  // Beverages
  { id: "d-water", name: "Mineral Water", categoryId: "drinks", desc: "500 ml bottle.", variants: one(20, "500 ml"), art: { kind: "drink", color: "#9FD3E6" }, stock: 120, toppings: false },
  { id: "d-lime", name: "Fresh Lime Soda", categoryId: "drinks", desc: "Sweet, salted or mixed.", variants: [{ id: "sweet", name: "Sweet", price: 60 }, { id: "salt", name: "Salted", price: 60 }, { id: "mix", name: "Mixed", price: 60 }], art: { kind: "drink", color: "#C9E36B" }, stock: 70, toppings: false },
  // Add-ons (offered when customising a pop)
  { id: "t-chocodip", name: "Chocolate Dip", categoryId: "toppings", desc: "Dark chocolate coating.", variants: one(20, "Add-on"), art: { kind: "topping", color: "#6B3E26" }, stock: 200, toppings: false },
  { id: "t-nuts", name: "Nut Crunch", categoryId: "toppings", desc: "Roasted almond & pista crumble.", variants: one(25, "Add-on"), art: { kind: "topping", color: "#D9A066" }, stock: 150, toppings: false },
  { id: "t-chilli", name: "Chilli-Salt Sprinkle", categoryId: "toppings", desc: "For guava & green mango.", variants: one(10, "Add-on"), art: { kind: "topping", color: "#E4473C", color2: "#FFC629" }, stock: 200, toppings: false },
  { id: "t-sprinkle", name: "Rainbow Sprinkles", categoryId: "toppings", desc: "Kids' favourite.", variants: one(10, "Add-on"), art: { kind: "topping", color: "#F48FB1", color2: "#FFC629" }, stock: 200, toppings: false },
];

export const products: Product[] = raw.map((p, i) => ({
  ...p,
  sku: "IB-" + p.categoryId.slice(0, 3).toUpperCase() + "-" + String(101 + i),
  lowStock: p.lowStock ?? 10,
  active: true,
}));

export const staff: Staff[] = [
  { id: "s-rohan", name: "Rohan Kapoor", role: "Admin", phone: "9840012345", pin: "1111", active: true, joined: "2024-03-01" },
  { id: "s-priya", name: "Priya Nair", role: "Manager", phone: "9840023456", pin: "2222", active: true, joined: "2024-06-15" },
  { id: "s-karthik", name: "Karthik Subramanian", role: "Cashier", phone: "9840034567", pin: "3333", active: true, joined: "2025-01-10" },
  { id: "s-divya", name: "Divya Raman", role: "Cashier", phone: "9840045678", pin: "4444", active: true, joined: "2025-08-02" },
];

const names = [
  "Aarav Sharma", "Ananya Iyer", "Vikram Reddy", "Meera Krishnan", "Rahul Menon", "Sneha Pillai",
  "Arjun Rao", "Kavya Srinivasan", "Siddharth Jain", "Lakshmi Venkatesh", "Nikhil Gupta", "Pooja Natarajan",
  "Aditya Bose", "Ishita Chatterjee", "Varun Shetty", "Riya Desai", "Harish Kumar", "Divya Balaji",
  "Manoj Raghavan", "Shreya Mukherjee", "Gautham Ramesh", "Nandini Hegde", "Rohit Agarwal", "Aishwarya Mohan",
  "Karan Malhotra", "Swathi Prakash", "Deepak Joseph", "Tanvi Kulkarni", "Sanjay Murthy", "Fathima Rahman",
];

export function makeCustomers(now: Date): Customer[] {
  const r = mulberry32(42);
  return names.map((name, i) => {
    const visits = 2 + Math.floor(r() * 30);
    const spent = Math.round(visits * (180 + r() * 260));
    return {
      id: "cu-" + (i + 1),
      name,
      phone: "9" + String(Math.floor(100000000 + r() * 899999999)),
      email: name.toLowerCase().split(" ")[0] + "@example.com",
      points: Math.max(40, (Math.round(spent / 10) % 400) + 20),
      visits, spent,
      joined: ymd(addDays(now, -Math.floor(60 + r() * 500))),
      lastVisit: addDays(now, -Math.floor(r() * 20)).toISOString(),
      birthday: `1990-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 27)).padStart(2, "0")}`,
    };
  });
}

export function makeOffers(now: Date): Offer[] {
  const d = (n: number) => ymd(addDays(now, n));
  return [
    { id: "o-bogo", name: "Buy 1 Get 1 — Green Mango", type: "bogo", value: 0, productIds: ["p-green-mango"], categoryIds: [], minOrder: 0, start: d(-20), end: d(25), usageLimit: 0, used: 0, stackable: true, autoApply: true, active: true, desc: "Every second Green Mango pop is free." },
    { id: "o-mock", name: "Mocktail Hour — 10% off Mocktail Pops", type: "percent", value: 10, productIds: [], categoryIds: ["mocktail"], minOrder: 0, start: d(-10), end: d(30), usageLimit: 0, used: 0, stackable: true, autoApply: true, active: true, desc: "10% off every mocktail pop." },
    { id: "o-combo", name: "Rasamalai + Mango Combo", type: "combo", value: 20, productIds: ["p-rasamalai", "p-mango"], categoryIds: [], minOrder: 0, start: d(-30), end: d(60), usageLimit: 0, used: 0, stackable: true, autoApply: true, active: true, desc: "₹20 off Rasamalai + Mango together." },
    { id: "o-flat50", name: "FLAT50 — ₹50 off above ₹400", type: "fixed", value: 50, productIds: [], categoryIds: [], minOrder: 400, start: d(-5), end: d(40), usageLimit: 500, used: 0, stackable: false, autoApply: false, code: "FLAT50", active: true, desc: "Coupon for orders above ₹400." },
    { id: "o-diwali", name: "Diwali Delight — 15% off", type: "percent", value: 15, productIds: [], categoryIds: [], minOrder: 500, start: d(-3), end: d(30), usageLimit: 300, used: 0, stackable: false, autoApply: false, code: "DIWALI15", active: true, desc: "Festive coupon on orders above ₹500." },
    { id: "o-summer", name: "Summer Fest — 20% off Fruit Pops", type: "percent", value: 20, productIds: [], categoryIds: ["fruit"], minOrder: 0, start: d(-160), end: d(-70), usageLimit: 0, used: 0, stackable: true, autoApply: true, active: false, desc: "Ended — summer campaign." },
  ];
}

export const suppliers: Supplier[] = [
  { id: "sp-1", name: "Arun Dairy Products", contact: "Suresh Arun", phone: "9444012345", supplies: "Milk, fruit pulp, sugar syrup" },
  { id: "sp-2", name: "Coastal Stick & Pack Co.", contact: "Meena Raj", phone: "9444023456", supplies: "Pop sticks, wrappers, boxes" },
  { id: "sp-3", name: "Chennai Fresh Fruits", contact: "Abdul Kareem", phone: "9444034567", supplies: "Fresh fruit, mango pulp" },
  { id: "sp-4", name: "Cocoa Craft Distributors", contact: "Neha Bansal", phone: "9444045678", supplies: "Chocolate, toppings, sauces" },
];

const allPerms = ["pos", "discounts", "refunds", "products", "inventory", "customers", "offers", "reports", "staff", "settings"] as const;

export const defaultSettings: Settings = {
  shopName: "ICE BAY", tagline: "Real Fruit Ice Pops",
  address: "14, Marina Bay Arcade, Kamarajar Salai, Chennai 600004",
  phone: "+91 44 4012 3456", email: "hello@icebay.in",
  gstin: "33AAKCI4821M1Z7", fssai: "12425001000123",
  taxRate: 5, taxInclusive: false, hsn: "2105",
  currency: "INR", currencySymbol: "₹", roundToRupee: true,
  receiptWidth: "80", receiptHeader: "Thank you for choosing ICE BAY!", receiptFooter: "Scoop you soon • Follow @icebay", receiptShowLogo: true,
  methods: { cash: true, upi: true, card: true, other: true },
  otherMethodName: "Gift Card", upiId: "", cardTerminal: "Pine Labs Plutus",
  lowStockDefault: 10, blockOutOfStock: true,
  loyalty: { enabled: true, spendPerPoint: 10, redeemPoints: 100, redeemValue: 50, minBill: 100 },
  display: { headline: "Real fruit. Frozen on a stick.", subheadline: "17 flavours made fresh every day. Ask about today's specials.", showPromos: true, rotateSec: 6 },
  notify: { lowStock: true, dailySummary: true, refunds: true, shiftVariance: true },
  permissions: {
    Admin: [...allPerms],
    Manager: ["pos", "discounts", "refunds", "products", "inventory", "customers", "offers", "reports"],
    Cashier: ["pos", "customers"],
  },
};

export function makeSeed(now = new Date()): DB {
  return {
    version: DB_VERSION,
    settings: structuredClone(defaultSettings),
    categories: structuredClone(categories),
    products: structuredClone(products),
    customers: makeCustomers(now),
    offers: makeOffers(now),
    staff: structuredClone(staff),
    bills: [],
    billStatus: {},
    stockMoves: [],
    suppliers: structuredClone(suppliers),
    purchases: [
      { id: "pu-1", supplierId: "sp-1", date: addDays(now, -6).toISOString(), invoice: "ADP/2026/4412", items: [{ productId: "p-mango", qty: 60, cost: 28 }, { productId: "p-watermelon", qty: 50, cost: 24 }], total: 2880, by: "s-priya" },
      { id: "pu-2", supplierId: "sp-2", date: addDays(now, -3).toISOString(), invoice: "CCC-1187", items: [{ productId: "b-assorted6", qty: 20, cost: 60 }, { productId: "b-fruit12", qty: 10, cost: 110 }], total: 2300, by: "s-priya" },
      { id: "pu-3", supplierId: "sp-4", date: addDays(now, -1).toISOString(), invoice: "CCD/88231", items: [{ productId: "t-chocodip", qty: 40, cost: 8 }, { productId: "t-nuts", qty: 50, cost: 10 }], total: 820, by: "s-rohan" },
    ],
    shifts: [],
    audit: [
      { id: "a-1", date: addDays(now, -1).toISOString(), by: "s-rohan", action: "Offer created", detail: "Diwali Delight — 15% off" },
      { id: "a-2", date: addDays(now, -2).toISOString(), by: "s-priya", action: "Stock purchase", detail: "Invoice CCC-1187 from Coastal Stick & Pack Co." },
    ],
    held: [],
    billSeq: 24001,
    session: { staffId: null },
  };
}
