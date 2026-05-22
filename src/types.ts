export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "Makanan" | "Minuman" | string;
  isAvailable: boolean;
  isPopular: boolean;
}

export interface Table {
  id: string;
  number: number;
  qrCodeUrl: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  options: string; // JSON string of options
  unitPrice: number;
}

export type OrderStatus = "MENUNGGU" | "DIPROSES" | "SIAP" | "SELESAI" | "DITOLAK";

export interface Order {
  id: string;
  tableId: string;
  table: Table;
  customerName: string | null;
  paymentMethod: "KASIR" | "QRIS";
  status: OrderStatus;
  totalPrice: number;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  orderItems: OrderItem[];
}

export interface AdminSettings {
  autoAcceptEnabled: boolean;
  soundNotificationsEnabled: boolean;
}

export interface SummaryStats {
  totalOrdersToday: number;
  totalIncomeToday: number;
  topSellingItem: string;
  aiInsight: string;
}
