import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Order, OrderItem } from "../types";
import { Check, Clock, ChefHat, Utensils, Heart, RefreshCw } from "lucide-react";
import io from "socket.io-client";
import { API_BASE_URL, getSocketUrl } from "../config";

interface OrderTrackerProps {
  order: Order;
  onClose: () => void;
}

export default function OrderTracker({ order: initialOrder, onClose }: OrderTrackerProps) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [aiGreeting, setAiGreeting] = useState<string>("Sedang menyiapkan pesan hangat khusus untukmu...");
  const [isLoadingGreeting, setIsLoadingGreeting] = useState(true);

  // Status mapping
  const statusSteps = [
    { label: "Diterima", statusKey: "MENUNGGU", icon: Clock },
    { label: "Sedang Diproses", statusKey: "DIPROSES", icon: ChefHat },
    { label: "Siap Disajikan", statusKey: "SIAP", icon: Utensils },
    { label: "Selesai 🍜", statusKey: "SELESAI", icon: Heart },
  ];

  // Helper check active index
  const getCurrentStepIndex = (status: string) => {
    if (status === "MENUNGGU") return 0;
    if (status === "DIPROSES") return 1;
    if (status === "SIAP") return 2;
    if (status === "SELESAI") return 3;
    if (status === "DITOLAK") return -1;
    return 0;
  };

  const currentStepIndex = getCurrentStepIndex(order.status);

  // Fetch greeting from Gemini
  const fetchGreeting = async (orderId: string) => {
    setIsLoadingGreeting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/ai-greeting`);
      const data = await res.json();
      if (data.greeting) {
        setAiGreeting(data.greeting);
      } else {
        setAiGreeting("Pesanan hangatmu sedang dibuat! Tunggu sebentar ya 😊");
      }
    } catch (err) {
      console.error(err);
      setAiGreeting("Pesanan hangatmu sedang dibuat! Tunggu sebentar ya 😊");
    } finally {
      setIsLoadingGreeting(false);
    }
  };

  useEffect(() => {
    fetchGreeting(order.id);

    // Socket listeners for real-time status change
    const socket = io(getSocketUrl());
    
    socket.on("order_status_changed", (updatedOrder: Order) => {
      if (updatedOrder.id === order.id) {
        setOrder(updatedOrder);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [order.id]);

  const parseOptions = (optsStr: string) => {
    try {
      const opts = JSON.parse(optsStr);
      return Object.entries(opts)
        .map(([key, val]) => `${key.toUpperCase()}: ${val}`)
        .join(" • ");
    } catch {
      return "";
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#FFF0F2] min-h-screen pb-12 px-6 flex flex-col justify-between">
      {/* Scrollable upper block */}
      <div className="flex-1 space-y-6 pt-6">
        {/* Visual Header Success Centang */}
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 10, stiffness: 100, delay: 0.15 }}
            className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg mb-4"
          >
            <Check className="w-9 h-9 stroke-[3]" />
          </motion.div>
          <h2 className="text-2xl font-extrabold text-gray-800">Pesanan Diterima!</h2>
          <p className="text-xs text-gray-500 font-bold mt-1">
            Terima kasih, pesananmu siap diproses oleh kru Warung Hangat.
          </p>
        </div>

        {/* Status Tracker Progress block */}
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm">
          <h3 className="text-sm font-extrabold text-gray-700 mb-4">Status Pesanan</h3>
          
          {order.status === "DITOLAK" ? (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
              <span className="text-3xl">❌</span>
              <h4 className="text-sm font-bold text-red-600 mt-1">Pesanan Ditolak</h4>
              <p className="text-xs text-red-500 mt-1 font-semibold">
                Alasan: {order.rejectionReason || "Meja sedang terlalu ramai."}
              </p>
            </div>
          ) : (
            <div className="relative pl-7 space-y-6 border-l-2 border-dashed border-gray-200">
              {statusSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = currentStepIndex >= index;
                const isActive = currentStepIndex === index;

                return (
                  <div key={step.label} className="relative">
                    {/* Circle indicators */}
                    <div className="absolute -left-[37px] top-1">
                      <motion.div
                        animate={isActive ? { scale: [1, 1.25, 1], rotate: [0, 10, 0] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition ${
                          isActive
                            ? "bg-[#DF3E58] text-white border-[#DF3E58] shadow-md shadow-[#DF3E58]/20"
                            : isCompleted
                            ? "bg-green-500 text-white border-green-500"
                            : "bg-white text-gray-400 border-gray-200"
                        }`}
                      >
                        {isCompleted && !isActive ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <StepIcon className="w-3.5 h-3.5" />
                        )}
                      </motion.div>
                    </div>

                    <div className="flex flex-col">
                      <span className={`text-sm font-extrabold transition ${
                        isActive
                          ? "text-[#DF3E58] font-extrabold scale-102"
                          : isCompleted
                          ? "text-gray-800 font-bold"
                          : "text-gray-400"
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gemini Generated Section */}
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl relative overflow-hidden">
          {/* Subtle Decorative elements */}
          <span className="absolute right-3 top-3 text-2xl opacity-10 font-bold select-none rotate-12">🍓</span>
          
          <div className="flex items-start space-x-3">
            <span className="text-2xl mt-0.5">🤖</span>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-[#DF3E58]">Hangat AI (Gemini 3.5 Flash)</span>
                {isLoadingGreeting && <RefreshCw className="w-3 h-3 text-[#DF3E58] animate-spin" />}
              </div>
              <p className="text-xs font-semibold text-gray-700 mt-1 leading-relaxed italic">
                "{aiGreeting}"
              </p>
            </div>
          </div>
        </div>

        {/* Order Details list */}
        <div className="bg-white p-5 rounded-2xl border border-rose-50 shadow-sm space-y-4">
          <div className="flex justify-between items-center text-xs text-gray-500 font-bold pb-2 border-b border-gray-100">
            <span>#{order.id.slice(0, 8).toUpperCase()}</span>
            <span>Meja {order.table.number}</span>
          </div>

          <div className="space-y-3">
            {order.orderItems.map((item) => (
              <div key={item.id} className="flex justify-between items-start text-xs">
                <div>
                  <h4 className="font-bold text-gray-800">
                    {item.menuItem.name} <span className="text-gray-400">x{item.quantity}</span>
                  </h4>
                  {item.options && (
                    <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">
                      {parseOptions(item.options)}
                    </p>
                  )}
                </div>
                <span className="font-bold text-gray-700">
                  Rp {(item.unitPrice * item.quantity).toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>

          {/* Pricing Summary info row */}
          <div className="pt-3 border-t border-dashed border-gray-100 flex justify-between items-center text-sm font-extrabold text-gray-800">
            <span>Mode Bayar ({order.paymentMethod})</span>
            <span className="text-[#DF3E58] text-base font-extrabold">
              Rp {order.totalPrice.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* Button Return home */}
      <div className="mt-8">
        <button
          onClick={onClose}
          id="back-to-menu-button"
          className="w-full py-4 rounded-xl border border-[#DF3E58] text-[#DF3E58] font-bold text-sm bg-transparent hover:bg-[#DF3E58]/5 active:scale-[0.98] transition"
        >
          Pesan Menu Lain
        </button>
      </div>
    </div>
  );
}
