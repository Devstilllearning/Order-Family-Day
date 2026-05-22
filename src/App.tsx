import React, { useState, useEffect } from "react";
import { MenuItem, Table, Order } from "./types";
import OptionsSheet from "./components/OptionsSheet";
import CartDrawer from "./components/CartDrawer";
import OrderTracker from "./components/OrderTracker";
import AdminPanel from "./components/AdminPanel";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, ChevronRight, HelpCircle, Utensils, AlertTriangle } from "lucide-react";
import io from "socket.io-client";
import { API_BASE_URL, getSocketUrl } from "./config";

interface CartItem {
  id: string; // generated unique cart string identifier
  menuItem: MenuItem;
  quantity: number;
  options: Record<string, string>;
  notes: string;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // States
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Semua");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  
  // Custom interactive state triggers
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Cart list
  const [cart, setCart] = useState<CartItem[]>([]);

  // Update hash path change routing
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentHash(window.location.hash);
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  // Fetch tables and select Table from URL query string
  useEffect(() => {
    const fetchConfiguration = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/tables`);
        if (!res.ok) {
           throw new Error(`HTTP error! status: ${res.status}`);
        }
        const tablesData: Table[] = await res.json();
        setTables(tablesData);

        // Detect query parameter ?table=3
        const params = new URLSearchParams(window.location.search);
        const tableNumParam = params.get("table");
        
        let tableToSelect: Table | null = null;

        // Try localStorage if no param
        const savedTableId = localStorage.getItem("selected_table_id");

        if (tableNumParam && !isNaN(Number(tableNumParam))) {
          const matched = tablesData.find(t => t.number === Number(tableNumParam));
          if (matched) {
            tableToSelect = matched;
          }
        } else if (savedTableId) {
            const matched = tablesData.find(t => t.id === savedTableId);
            if (matched) {
                tableToSelect = matched;
            }
        }
        
        if (tableToSelect) {
            setSelectedTable(tableToSelect);
            localStorage.setItem("selected_table_id", tableToSelect.id);
        } else {
          // If no table provided, don't auto-select. Let user choose.
          setSelectedTable(null);
        }
      } catch (err) {
        console.error("Failed to load tables list:", err);
      }
    };
    fetchConfiguration();
  }, []);

  // Update localStorage when selectedTable changes
  useEffect(() => {
      if (selectedTable) {
          localStorage.setItem("selected_table_id", selectedTable.id);
      } else {
          localStorage.removeItem("selected_table_id");
      }
  }, [selectedTable]);

  // Fetch Menu items list
  useEffect(() => {
    const fetchMenu = async () => {
      setMenuLoading(true);
      console.log("Fetching menu from:", `${API_BASE_URL}/api/menu`);
      try {
        const res = await fetch(`${API_BASE_URL}/api/menu`);
        if (!res.ok) {
           throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        console.log("Menu data received:", data);
        setMenuItems(data);
      } catch (err) {
        console.error("Failed to fetch menu list:", err);
      } finally {
        setMenuLoading(false);
      }
    };
    fetchMenu();

    // Socket.io Real-time update for menu item availabilities
    const socket = io(getSocketUrl());
    socket.on("menu_availability_changed", (updatedItem: MenuItem) => {
      setMenuItems(prev => prev.map(m => m.id === updatedItem.id ? updatedItem : m));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Sync active order state from localstorage or on-screen
  useEffect(() => {
    const cachedOrderId = localStorage.getItem("active_order_id");
    if (cachedOrderId) {
      // Poll/restore status
      fetch(`${API_BASE_URL}/api/orders/${cachedOrderId}`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Expired order");
        })
        .then(data => {
          // If the order is NOT finished (SELESAI / DITOLAK), restore progress tracker automatically
          if (data.status !== "SELESAI" && data.status !== "DITOLAK") {
            setActiveOrder(data);
          }
        })
        .catch(() => {
          localStorage.removeItem("active_order_id");
        });
    }
  }, []);

  // Routing conditions to Admin Portal
  const isAdminView = currentPath === "/admin" || currentHash === "#/admin";
  
  // Quick access to admin
  const goToAdmin = () => {
    window.location.hash = "#/admin";
  };

  if (isAdminView) {
    return <AdminPanel />;
  }

  // 🥘 CUSTOMER CORE OPERATIVE ACTIONS

  // Add item combinations with selected options to cart list
  const handleAddToCart = (qty: number, options: Record<string, string>) => {
    if (!selectedItem) return;

    // generate cart hash uniquely: itemId + serialize options
    const optionHash = Object.entries(options)
      .map(([k, v]) => `${k}_${v}`)
      .join("-");
    const cartId = `${selectedItem.id}-${optionHash}`;

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.id === cartId);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += qty;
        return updated;
      } else {
        return [
          ...prev,
          {
            id: cartId,
            menuItem: selectedItem,
            quantity: qty,
            options,
            notes: ""
          }
        ];
      }
    });

    setSelectedItem(null);
  };

  const handleUpdateQty = (cartId: string, value: number) => {
    setCart(prev =>
      prev.map(item => (item.id === cartId ? { ...item, quantity: value } : item))
    );
  };

  const handleRemoveCartItem = (cartId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartId));
  };

  const handleUpdateNotes = (cartId: string, value: string) => {
    setCart(prev =>
      prev.map(item => (item.id === cartId ? { ...item, notes: value } : item))
    );
  };

  // Submit checkout order to database
  const handleSubmitOrder = async (customerName: string, paymentMethod: "KASIR" | "QRIS") => {
    if (!selectedTable) throw new Error("Nomor meja belum terdeteksi.");

    const itemsPayload = cart.map(item => ({
      menuItemId: item.menuItem.id,
      quantity: item.quantity,
      options: item.options,
      notes: item.notes
    }));

    const res = await fetch(`${API_BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableId: selectedTable.id,
        customerName,
        paymentMethod,
        items: itemsPayload
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Gagal membuat pesanan.");
    }

    // Cache order details locally for tracker screen transitions
    localStorage.setItem("active_order_id", data.id);
    setActiveOrder(data);
    setCart([]);
    setIsCartOpen(false);
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const getEmojiFallback = (name: string) => {
    if (name.includes("Bakso")) return "🍜";
    if (name.includes("Latte")) return "🥤";
    if (name.includes("Teh")) return "☕";
    return "🍽️";
  };

  const filteredMenuItems = menuItems.filter(item => {
    if (activeCategory === "Semua") return true;
    return item.category === activeCategory;
  });

  return (
    <div className="bg-[#FFF1F3] min-h-screen relative flex flex-col items-center select-none overflow-x-hidden">
      
      {/* Tracker screen over-take view */}
      {activeOrder ? (
        <OrderTracker
          order={activeOrder}
          onClose={() => {
            localStorage.removeItem("active_order_id");
            setActiveOrder(null);
          }}
        />
      ) : (
        /* STANDARD CUSTOMER SINGLE-PAGE LAYOUT */
        <div className="w-full max-w-md bg-white min-h-screen flex flex-col justify-between shadow-md">
          
          {/* HEADER (Sticky) */}
          <header className="sticky top-0 bg-gradient-to-r from-[#DE3163] to-[#FF5E89] text-white px-6 pt-12 pb-4 rounded-b-3xl shadow-lg z-30 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-3xl animate-pulse">🍓</span>
              <div>
                <h1 className="font-extrabold text-[#FFF5F6] text-lg tracking-tight leading-none">Warung Hangat</h1>
                <span className="text-[10px] font-bold text-rose-100 tracking-wider">Hangat, Segar, Bikin Nagih</span>
              </div>
            </div>

            {/* Sticky table badge widget right */}
            {selectedTable ? (
              <span className="px-3 py-1 bg-white text-[#DE3163] text-xs font-black rounded-full uppercase tracking-wide shadow-sm">
                Meja {selectedTable.number}
              </span>
            ) : (
              /* Dropdown table selector fallback */
              <div className="relative">
                <select
                  onChange={(e) => {
                    const matched = tables.find(t => t.id === e.target.value);
                    if (matched) setSelectedTable(matched);
                  }}
                  className="bg-white/20 border border-white/30 rounded-xl px-2 py-1 text-xs font-bold text-white focus:outline-none"
                  defaultValue=""
                >
                  <option value="" disabled className="text-gray-800 font-bold">Pilih Meja</option>
                  {tables.map(t => (
                    <option key={t.id} value={t.id} className="text-gray-800 font-semibold">
                      Meja {t.number}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </header>

          {/* MAIN MENU LIST CONTENT */}
          <main className="flex-1 px-5 py-4 space-y-5 bg-[#FFF1F3]">
            
            {/* Category tabs list scroll horizontal */}
            <div className="flex gap-6 px-6 py-4 overflow-x-auto border-b border-gray-100 bg-white rounded-2xl shadow-sm custom-scrollbar whitespace-nowrap">
              {["Semua", "Makanan", "Minuman"].map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`font-bold text-sm whitespace-nowrap transition-all duration-150 pb-1 ${
                    activeCategory === category
                      ? "text-[#DE3163] border-b-2 border-[#DE3163]"
                      : "text-gray-400 font-medium hover:text-gray-600"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-black text-gray-500 tracking-widest uppercase">
                {activeCategory} Selera Anda
              </h2>

              {menuLoading ? (
                /* Loading screen */
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <svg className="animate-spin h-8 w-8 text-[#DE3163]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-xs font-semibold text-gray-450">Menyiapkan hidangan lezat...</p>
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 font-bold bg-white rounded-2xl border border-dashed border-rose-100">
                  Maaf, kategori menu ini sedang kosong atau belum tersedia.
                </div>
              ) : (
                /* Cards collection responsive columns layout */
                <div className="space-y-3.5">
                  {filteredMenuItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => item.isAvailable && setSelectedItem(item)}
                      className={`relative bg-white p-4 rounded-2xl border border-rose-100 hover:border-rose-300 shadow-sm flex justify-between items-center transition-all duration-150 ${
                        !item.isAvailable ? "opacity-50 cursor-not-allowed select-none" : "cursor-pointer"
                      }`}
                    >
                      {/* Left: Info details */}
                      <div className="flex-1 min-w-0 pr-3.5">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                          <h3 className="font-bold text-gray-900">{item.name}</h3>
                          
                          {/* Popular badge */}
                          {item.isPopular && (
                            <span className="bg-yellow-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase text-yellow-950">
                              🔥 Populer
                            </span>
                          )}
                          {!item.isAvailable && (
                            <span className="bg-gray-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase text-gray-600">
                              Habis
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>

                        <span className="block mt-2 text-sm font-bold text-[#DE3163]">
                          Rp {item.price.toLocaleString("id-ID")}
                        </span>
                      </div>

                      {/* Right: emoji fallback photo image */}
                      <div className="relative">
                        <div className="w-20 h-20 bg-rose-50 border border-rose-100/50 rounded-2xl flex items-center justify-center text-4xl shadow-xs">
                          {getEmojiFallback(item.name)}
                        </div>

                        {/* Add Button right bottom corner */}
                        {item.isAvailable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                            }}
                            className="absolute -bottom-1 -right-1 bg-[#DE3163] hover:bg-[#FF5E89] active:scale-95 text-white w-8 h-8 rounded-full shadow-lg flex items-center justify-center font-bold text-xl select-none transition"
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Fine print footnote */}
            <div className="text-center pt-8 text-[10px] text-gray-400 font-semibold space-y-1">
              <p>Kru Warung Hangat mengutamakan kesegaran dan kebersihan. 🍓</p>
              <button 
                onClick={goToAdmin}
                className="text-rose-300 hover:text-rose-500 font-bold underline"
              >
                Admin Panel
              </button>
            </div>
          </main>

          {/* FLOATING FLOATING CART BUTTON (mengambang di kanan bawah) */}
          {totalCartCount > 0 && (
            <div className="fixed bottom-6 right-6 z-40">
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsCartOpen(true)}
                id="floating-cart-button"
                className="flex items-center space-x-2 bg-[#DE3163] hover:bg-[#FF5E89] text-white p-3.5 rounded-full shadow-2xl transition-all duration-200 animate-bounce"
              >
                <div className="relative">
                  <ShoppingBag className="w-5 h-5 pr-0.5" />
                  <span className="absolute -top-2.5 -right-2.5 bg-yellow-400 text-yellow-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#DE3163]">
                    {totalCartCount}
                  </span>
                </div>
                <span className="text-xs font-black pr-1 block">Lihat Keranjang</span>
              </motion.button>
            </div>
          )}

          {/* Custom options bottoms modals */}
          <OptionsSheet
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onConfirm={handleAddToCart}
          />

          {/* Custom drawer checkout details slider */}
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cartItems={cart}
            tableInfo={selectedTable}
            onUpdateQty={handleUpdateQty}
            onRemoveItem={handleRemoveCartItem}
            onUpdateNotes={handleUpdateNotes}
            onSubmitOrder={handleSubmitOrder}
          />
        </div>
      )}
    </div>
  );
}
