import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MenuItem, Table } from "../types";
import { X, Trash2, CreditCard, Wallet, AlertCircle } from "lucide-react";

interface CartItem {
  id: string; // unique cart identifier (e.g. itemId + option string combo)
  menuItem: MenuItem;
  quantity: number;
  options: Record<string, string>;
  notes: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  tableInfo: Table | null;
  onUpdateQty: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onSubmitOrder: (customerName: string, paymentMethod: "KASIR" | "QRIS") => Promise<void>;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  tableInfo,
  onUpdateQty,
  onRemoveItem,
  onUpdateNotes,
  onSubmitOrder
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"KASIR" | "QRIS" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  const totalAmount = cartItems.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);

  const formatOptions = (opts: Record<string, string>) => {
    return Object.entries(opts)
      .map(([key, val]) => `${key.toUpperCase()}: ${val}`)
      .join(" • ");
  };

  const handleOrderSubmit = async () => {
    if (cartItems.length === 0) return;
    if (!tableInfo) {
      setErrorText("Pilih meja terlebih dahulu.");
      return;
    }
    if (!paymentMethod) {
      setErrorText("Pilih cara pembayaran terlebih dahulu.");
      return;
    }
    setErrorText("");
    setIsSubmitting(true);
    try {
      await onSubmitOrder(customerName, paymentMethod);
      setCustomerName("");
      setPaymentMethod(null);
    } catch (err: any) {
      setErrorText(err.message || "Gagal mengirim pesanan");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 overflow-hidden">
        {/* Backdrop clickable space */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-transparent cursor-pointer"
        />        {/* Bottom Drawer Container */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 280 }}
          className="relative w-full max-w-md bg-[#FFF0F2] rounded-t-3xl shadow-2xl p-6 text-gray-800 z-10 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4 border-b border-rose-100 pb-3">
            <div>
              <h3 className="text-lg font-extrabold text-[#DF3E58] flex items-center gap-1.5">
                <span>Keranjang Belanja</span>
                <span className="text-xs bg-[#DF3E58] text-white px-2 py-0.5 rounded-full font-bold">
                  {cartItems.length}
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {tableInfo ? `Meja ${tableInfo.number}` : "Meja belum dipilih"}
              </p>
            </div>
            <button
              onClick={onClose}
              id="close-cart-drawer"
              className="p-1 rounded-full bg-rose-50 hover:bg-rose-100 transition duration-150"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {cartItems.length === 0 ? (
            /* Empty state container */
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <span className="text-5xl mb-3">🛒</span>
              <p className="text-sm text-gray-500 font-bold">Keranjangmu masih kosong nih!</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 rounded-xl bg-[#DF3E58] text-white font-bold text-xs"
              >
                Pilih Menu
              </button>
            </div>
          ) : (
            /* Filled cart items */
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
              {cartItems.map((item) => (
                <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-rose-50 shadow-sm flex flex-col space-y-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-800">{item.menuItem.name}</h4>
                      {Object.keys(item.options).length > 0 && (
                        <p className="text-[11px] text-[#DF3E58] font-bold mt-0.5">
                          {formatOptions(item.options)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-700">
                      Rp {(item.menuItem.price * item.quantity).toLocaleString("id-ID")}
                    </span>
                  </div>

                  {/* Catatan khusus item */}
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => onUpdateNotes(item.id, e.target.value)}
                    placeholder="Tambah catatan (misal: kuah banyakin)"
                    className="w-full text-xs bg-rose-50/40 border border-rose-100/50 rounded-lg p-2 focus:ring-1 focus:ring-[#DF3E58] focus:outline-none"
                  />

                  {/* Quantity controls and delete column */}
                  <div className="flex justify-between items-center pt-1 border-t border-dashed border-gray-100">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-red-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => onUpdateQty(item.id, Math.max(1, item.quantity - 1))}
                        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-extrabold text-xs text-gray-700"
                      >
                        -
                      </button>
                      <span className="text-xs font-extrabold text-gray-800">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-extrabold text-xs text-gray-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="h-2" />

              {/* Customer Name input field */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Pelanggan (opsional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama kamu (opsional)"
                  className="w-full text-sm bg-white border border-gray-200 rounded-xl p-3 focus:border-[#DF3E58] focus:outline-none transition"
                />
              </div>

              {/* Way to pay cards selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Cara Bayar</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("KASIR")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition ${
                      paymentMethod === "KASIR"
                        ? "border-[#DF3E58] bg-[#FFF0F2] shadow-sm ring-1 ring-[#DF3E58] font-bold text-[#DF3E58]"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    <Wallet className="w-5 h-5 mb-1.5" />
                    <span className="text-xs font-bold">Bayar di Kasir</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod("QRIS")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition ${
                      paymentMethod === "QRIS"
                        ? "border-[#DF3E58] bg-[#FFF0F2] shadow-sm ring-1 ring-[#DF3E58] font-bold text-[#DF3E58]"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mb-1.5" />
                    <span className="text-xs font-bold">Bayar via QRIS</span>
                  </button>
                </div>
              </div>

              {/* QRIS Static graphics scanner help block */}
              {paymentMethod === "QRIS" && (
                <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-28 h-28 bg-white border-2 border-[#DF3E58] p-2 rounded-xl flex items-center justify-center relative shadow-sm">
                    {/* Placeholder static vectors representing QR code code */}
                    <div className="grid grid-cols-3 gap-1 w-full h-full opacity-65">
                      <div className="border-4 border-gray-800 rounded-md w-6 h-6"></div>
                      <div className="bg-gray-800 rounded-xs h-3 w-4 self-center place-self-end"></div>
                      <div className="border-4 border-gray-800 rounded-md w-6 h-6 justify-self-end"></div>
                      <div className="bg-gray-800 h-2 w-full col-span-3"></div>
                      <div className="border-4 border-gray-800 rounded-md w-6 h-6 self-end"></div>
                      <div className="bg-gray-800 h-2 w-3 self-center rounded-full"></div>
                      <div className="bg-gray-800 h-6 w-6 self-end justify-self-end rounded-xs"></div>
                    </div>
                    {/* Tiny Brand Centerpiece */}
                    <span className="absolute text-sm bg-[#FFF0F2] rounded-lg px-1 text-[#DF3E58] font-bold border border-[#DF3E58]">🍓</span>
                  </div>
                  <p className="text-[11px] font-bold text-gray-600">Scan QR di kasir setelah memesan</p>
                </div>
              )}

              {errorText && (
                <div className="flex items-center space-x-1.5 p-3 rounded-xl bg-red-50 text-red-600 text-xs mt-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-semibold">{errorText}</span>
                </div>
              )}
            </div>
          )}

          {cartItems.length > 0 && (
            /* Submission Footer sticky bar */
            <div className="pt-3 border-t border-rose-100 space-y-3 mt-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-gray-500">Total Keseluruhan:</span>
                <span className="text-lg font-extrabold text-[#DF3E58]">
                  Rp {totalAmount.toLocaleString("id-ID")}
                </span>
              </div>

              <button
                disabled={cartItems.length === 0 || !paymentMethod || isSubmitting}
                onClick={handleOrderSubmit}
                id="submit-order-button"
                className="w-full py-3.5 rounded-xl bg-[#DF3E58] text-white font-extrabold flex items-center justify-center space-x-2 transition disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed hover:bg-[#FF758F]"
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Mengirim Pesanan...</span>
                  </div>
                ) : (
                  <span>Pesan Sekarang • Rp {totalAmount.toLocaleString("id-ID")}</span>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
