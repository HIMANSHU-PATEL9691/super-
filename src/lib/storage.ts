import { useEffect, useState } from "react";

export function useLocalState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export type Product = {
  _id?: string;
  id: string;
  name: string;
  category: string; // dynamic categories managed by admin
  subcategory?: string;
  note?: string;
  huid?: string;
  purity: string; // 22K / 18K / 925
  grossWeight: number;
  netWeight: number;
  stoneWeight: number;
  makingCharge: number;
  makingChargePct?: number;
  gstPct: number;
  ratePerGram: number;
  stock: number;
  barcode: string;
  imageUrl?: string;
  imageUrls?: string[];
};

export type Customer = {
  _id?: string;
  id: string;
  name: string;
  mobile: string;
  address?: string;
  gstNumber?: string;
  pan?: string;
  createdAt: string;
};

export type InvoiceItem = {
  productId: string;
  name: string;
  purity: string;
  netWeight: number;
  grossWeight?: number;
  stoneWeight?: number;
  ratePerGram: number;
  makingCharge: number;
  makingChargePct?: number;
  stoneCharge: number;
  gstPct: number;
  qty: number;
};

export type InvoicePayment = {
  date: string;
  amount: number;
  mode: string;
  note?: string;
};

export type Invoice = {
  _id?: string;
  id: string;
  number: string;
  type: "GST" | "NON-GST";
  customerId?: string;
  customerName: string;
  customerMobile: string;
  items: InvoiceItem[];
  discount: number;
  oldGoldAmount: number;
  paymentMode: "Cash" | "UPI" | "Card" | "EMI";
  subtotal: number;
  gstAmount: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  payments?: InvoicePayment[];
  customerSignature?: string;
  authorizedSignatory?: string;
  createdAt: string;
  linkedOrderId?: string;
};

export type Expense = {
  _id?: string;
  id: string;
  date: string; // ISO
  category: string; // Rent, Salary, Utilities, Misc...
  description: string;
  amount: number;
  paymentMode: "Cash" | "UPI" | "Card" | "Bank";
};

export type Advance = {
  id: string;
  date: string;
  customerId?: string;
  customerName: string;
  customerMobile: string;
  metal: "Gold" | "Silver";
  purity: string;
  ratePerGram: number; // locked at advance day
  amount: number; // advance amount paid
  weightLocked: number; // amount/rate
  note?: string;
  status: "Active" | "Redeemed" | "Cancelled";
};

export type Girvi = {
  id: string;
  date: string;
  loanNo: string;
  customerName: string;
  customerMobile: string;
  customerMobile2?: string;
  customerAddress?: string;
  itemType: "Gold" | "Silver";
  itemCategory?: string;
  itemDescription: string;
  grossWeight: number;
  netWeight: number;
  purity: string;
  marketValue: number;
  loanAmount: number;
  interestPct: number; // monthly %
  interestPeriod?: "Monthly" | "Daily";
  tenureMonths: number;
  documentType?: "Invoice" | "Bill" | "Receipt";
  documentNumber?: string;
  imageUrl?: string;
  dueDate?: string;
  status: "Active" | "Closed" | "Auctioned";
  note?: string;
  forwardedTo?: string;
  forwardedShopName?: string;
  forwardedShopGstNo?: string;
  forwardedShopAddress?: string;
  forwardedAmount?: number;
  forwardedInterestPct?: number;
  forwardedInterestPeriod?: "Monthly" | "Daily";
  forwardedImageUrl?: string;
  customerSignature?: string;
  authorizedSignatory?: string;
};

export type SupplierTransaction = {
  id?: string;
  _id?: string;
  date: string;
  type: "Credit" | "Debit";
  metal: "Gold" | "Silver";
  purity?: string;
  weight: number;
  note: string;
};

export type Supplier = {
  _id?: string;
  id: string;
  name: string;
  company?: string;
  mobile: string;
  email?: string;
  category?: string;
  gstNumber?: string;
  address?: string;
  companyNo?: string;
  note?: string;
  outstanding?: number;
  balanceGold?: number;
  balanceSilver?: number;
  transactions?: SupplierTransaction[];
  createdAt?: string;
};

export type Karigar = {
  _id?: string;
  id: string;
  name: string;
  mobile: string;
  specialty: string; // Goldsmith, Polisher, Stone Setter...
  category?: string;
  address?: string;
  username?: string;
  password?: string;
  pendingWeight: number; // grams issued not returned
  createdAt: string;
};

export type Repair = {
  _id?: string;
  id?: string;
  ticketNo: string;
  date: string;
  customerName: string;
  customerMobile: string;
  customerAddress?: string;
  itemDescription: string;
  itemWeight: number;
  problem: string;
  estimate?: number;
  advance: number;
  deliveryDate?: string;
  karigarId?: string;
  status: "Received" | "In Progress" | "Ready" | "Delivered";
  note?: string;
  createdAt?: string;
  customerSignature?: string;
  authorizedSignatory?: string;
};

export type JobWork = {
  _id?: string;
  id: string;
  jobNo: string;
  date: string;
  karigarId?: string;
  karigarName: string;
  itemDescription: string;
  metal: "Gold" | "Silver";
  purity: string;
  issuedWeight: number;
  receivedWeight: number;
  makingCharge: number;
  dueDate?: string;
  status: "Issued" | "In Progress" | "Received" | "Settled";
  note?: string;
};

export type Order = {
  _id?: string;
  id: string;
  orderNo: string;
  date: string;
  customerName: string;
  customerMobile: string;
  customerAddress?: string;
  itemDescription: string;
  metal: "Gold" | "Silver" | "Diamond" | "Platinum" | "Other";
  purity: string;
  estimatedWeight?: number;
  estimatedPrice?: number;
  fixedPrice?: number;
  advancePaid: number;
  karigarId?: string;
  dueDate?: string;
  status: "Pending" | "In Progress" | "Ready" | "Delivered" | "Cancelled";
  note?: string;
  customerSignature?: string;
  authorizedSignatory?: string;
};


export type Purchase = {
  _id?: string;
  id: string;
  billNo: string;
  date: string;
  supplierId?: string;
  supplierName: string;
  metal: "Gold" | "Silver" | "Diamond" | "Other";
  purity?: string;
  weight: number;
  ratePerGram: number;
  makingCharge: number;
  gstPct: number;
  total: number;
  paymentMode: "Cash" | "UPI" | "Card" | "Bank" | "Credit";
  note?: string;
};

export type MetalRates = {
  updatedAt: string;
  gold24: number;
  gold22: number;
  gold18: number;
  silver: number;
};

export const uid = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export function calcItem(it: InvoiceItem, isGst: boolean) {
  const base = it.netWeight * it.ratePerGram + it.makingCharge + it.stoneCharge;
  const line = base * it.qty;
  const gst = isGst ? (line * it.gstPct) / 100 : 0;
  return { line, gst, total: line + gst };
}

export function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
}
