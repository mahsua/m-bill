export interface Product {
  id: string;
  serialNumber: number;
  name: string;
  quantity: number;
  price: number;
  discountPercent: number;
  amount: number;
}

export interface BillSummary {
  subtotal: number;
  totalDiscount: number;
  grandTotal: number;
  totalSavings: number;
}
