import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MenuItem, Table, Order, AdminSettings, SummaryStats } from "../types";
import {
  LogOut,
  Sliders,
  DollarSign,
  TrendingUp,
  Award,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Download,
  UtensilsCrossed,
  LayoutGrid,
  Menu,
  SquareCheck,
  ToggleLeft,
  Settings,
  AlertCircle
} from "lucide-react";
import io from "socket.io-client";

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Tabs: "kanban" | "menu" | "meja"
  const [activeTab, setActiveTab] = useState<"kanban" | "menu" | "meja">("kanban");

  // Loaded data
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({
    autoAcceptEnabled: false,
    soundNotificationsEnabled: true
  });
  const [summary, setSummary] = useState<SummaryStats>({
    totalOrdersToday: 0,
    totalIncomeToday: 0,
    topSellingItem: "Tidak ada data",
    aiInsight: "Memuat insight dari Gemini..."
  });

  // Ticks / Active Auto-Accept countdowns of orders
  // Maps orderId -> number of seconds left
  const [ticks, setTicks] = useState<Record<string, number>>({});

  // Table add state
  const [newTableNum, setNewTableNum] = useState("");
  const [tableError, setTableError] = useState("");

  const socketRef = useRef<any>(null);

  // Synthesize Bell ding
  const playDing = () => {
    if (!settings.soundNotificationsEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0.08, start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = audioCtx.currentTime;
      playTone(523.25, now, 0.4);       // C5 Tone
      playTone(659.25, now + 0.12, 0.4); // E5 Tone
    } catch (err) {
      console.warn("Synth ding failed:", err);
    }
  };

  const getHeaders = () => {
    const token = localStorage.getItem("warung_admin_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };
  };

  // Check login
  useEffect(() => {
    const token = localStorage.getItem("warung_admin_token");
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    }
  }, [isLoggedIn]);

  const fetchData = async () => {
    try {
      const ordRes = await fetch("/api/orders", { headers: getHeaders() });
      if (ordRes.status === 401) {
        handleLogout();
        return;
      }
      const ordData = await ordRes.json();
      setOrders(ordData);

      const menuRes = await fetch("/api/menu");
      const menuData = await menuRes.json();
      setMenuItems(menuData);

      const tabRes = await fetch("/api/tables");
      const tabData = await tabRes.json();
      setTables(tabData);

      const setRes = await fetch("/api/admin/settings", { headers: getHeaders() });
      const setData = await setRes.json();
      setSettings({
        autoAcceptEnabled: setData.autoAcceptEnabled,
        soundNotificationsEnabled: setData.soundNotificationsEnabled
      });

      const sumRes = await fetch("/api/admin/summary", { headers: getHeaders() });
      const sumData = await sumRes.json();
      setSummary(sumData);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    }
  };

  // Set up socket listeners
  useEffect(() => {
    if (!isLoggedIn) return;

    socketRef.current = io();

    socketRef.current.on("settings_update", (data: any) => {
      setSettings(data);
    });

    socketRef.current.on("new_order", (newOrd: Order) => {
      playDing();
      setOrders(prev => {
        // filter duplicated
        const filtered = prev.filter(o => o.id !== newOrd.id);
        return [newOrd, ...filtered];
      });
      // Increment browser tab badge trigger
      document.title = "🔴 (1) Pesanan Baru!";
      
      // Update stats dynamically
      fetchSummary();
    });

    socketRef.current.on("orders_updated", (updatedOrd: Order) => {
      setOrders(prev => prev.map(o => o.id === updatedOrd.id ? updatedOrd : o));
    });

    socketRef.current.on("auto_accept_tick", (data: { orderId: string; secondsLeft: number }) => {
      setTicks(prev => {
        if (data.secondsLeft <= 0) {
          const updated = { ...prev };
          delete updated[data.orderId];
          return updated;
        }
        return { ...prev, [data.orderId]: data.secondsLeft };
      });
    });

    // Reset title warning on window focus
    const handleFocus = () => {
      document.title = "Warung Hangat - Admin Dashboard";
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      window.removeEventListener("focus", handleFocus);
    };
  }, [isLoggedIn, settings]);

  const fetchSummary = async () => {
    try {
      const sumRes = await fetch("/api/admin/summary", { headers: getHeaders() });
      const sumData = await sumRes.json();
      setSummary(sumData);
    } catch (err) {
      console.error(err);
    }
  };

  // REST API handles
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Email atau password salah.");
        setLoginLoading(false);
        return;
      }
      localStorage.setItem("warung_admin_token", data.token);
      setIsLoggedIn(true);
    } catch (err) {
      setLoginError("Gagal tersambung ke server.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("warung_admin_token");
    setIsLoggedIn(false);
    setEmail("");
    setPassword("");
  };

  const updateSetting = async (key: "soundNotifications" | "autoAccept", value: boolean) => {
    try {
      const body = key === "soundNotifications" 
        ? { soundNotifications: value } 
        : { autoAccept: value };

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const nextSettings = { ...settings };
        if (key === "soundNotifications") nextSettings.soundNotificationsEnabled = value;
        if (key === "autoAccept") nextSettings.autoAcceptEnabled = value;
        setSettings(nextSettings);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateOrderStatus = async (orderId: string, nextStatus: string, rejectionReason?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus, rejectionReason })
      });
      if (res.ok) {
        // clear ticks local countdown
        setTicks(prev => {
          const keys = { ...prev };
          delete keys[orderId];
          return keys;
        });

        const updated = await res.json();
        setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
        fetchSummary();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTolakOrder = (orderId: string) => {
    const reason = prompt("Masukkan alasan penolakan pesanan:");
    if (reason === null) return; // cancelled
    updateOrderStatus(orderId, "DITOLAK", reason || "Meja terlalu ramai.");
  };

  const handleUpdateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    try {
      const res = await fetch(`/api/menu/${id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const item = await res.json();
        setMenuItems(prev => prev.map(m => m.id === id ? item : m));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setTableError("");
    if (!newTableNum) return;
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ number: newTableNum })
      });
      const data = await res.json();
      if (!res.ok) {
        setTableError(data.error || "Gagal menambah meja.");
        return;
      }
      setTables(prev => [...prev, data].sort((a, b) => a.number - b.number));
      setNewTableNum("");
    } catch (err) {
      setTableError("Koneksi gagal.");
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm("Hapus meja ini? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      const res = await fetch(`/api/tables/${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        setTables(prev => prev.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const parseOptions = (optsStr: string) => {
    try {
      const opts = JSON.parse(optsStr);
      return Object.entries(opts)
        .map(([key, val]) => `${key.toUpperCase()}: ${val}`)
        .join(", ");
    } catch {
      return "";
    }
  };

  // Filter orders by status categories for Kanban columns
  const filterByStatus = (statusGroup: string[]) => {
    return orders.filter(o => statusGroup.includes(o.status));
  };

  // Render Login state screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#FFF0F2] flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-rose-200 shadow-xl">
          <div className="text-center mb-6">
            <span className="text-5xl">🍓</span>
            <h2 className="text-2xl font-extrabold text-[#DF3E58] mt-2">Warung Hangat</h2>
            <p className="text-xs text-gray-500 font-bold mt-1">Portal Administrasi Live Orders</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email Karyawan</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@warung.com"
                className="w-full text-sm rounded-xl p-3 bg-gray-50 border border-gray-250 focus:border-[#DF3E58] focus:ring-1 focus:ring-[#DF3E58] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm rounded-xl p-3 bg-gray-50 border border-gray-250 focus:border-[#DF3E58] focus:ring-1 focus:ring-[#DF3E58] focus:outline-none"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-bold flex items-center space-x-1.5 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              id="login-submit-button"
              className="w-full py-3.5 rounded-xl bg-[#DF3E58] hover:bg-[#FF758F] text-white font-bold text-sm transition transition-all duration-150 disabled:opacity-50"
            >
              {loginLoading ? "Menghubungkan..." : "Masuk Sistem"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col">
      {/* 1. Header Admin Panel */}
      <header className="bg-gradient-to-r from-[#DF3E58] to-[#FF758F] text-white px-6 py-4 shadow-md sticky top-0 z-40 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-3xl bg-white/10 p-1.5 rounded-xl">🍓</span>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none">WARUNG HANGAT</h1>
            <span className="text-[10px] font-bold text-rose-100 tracking-widest mt-1 block">Live Management Panel</span>
          </div>
        </div>

        {/* Global Action controls inside headers */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Toggles */}
          <div className="flex items-center space-x-2 bg-black/15 px-3 py-1.5 rounded-xl">
            <span className="text-xs font-bold text-rose-100 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-yellow-300" />
              Auto-Terima
            </span>
            <button
              onClick={() => updateSetting("autoAccept", !settings.autoAcceptEnabled)}
              className={`w-11 h-6 rounded-full p-0.5 transition duration-200 focus:outline-none ${
                settings.autoAcceptEnabled ? "bg-green-500" : "bg-gray-400"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition transform ${
                  settings.autoAcceptEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center space-x-2 bg-black/15 px-3 py-1.5 rounded-xl">
            <span className="text-xs font-bold text-rose-100 flex items-center gap-1">
              {settings.soundNotificationsEnabled ? <Volume2 className="w-3.5 h-3.5 text-green-300" /> : <VolumeX className="w-3.5 h-3.5 text-gray-300" />}
              Suara
            </span>
            <button
              onClick={() => updateSetting("soundNotifications", !settings.soundNotificationsEnabled)}
              className={`w-11 h-6 rounded-full p-0.5 transition duration-200 focus:outline-none ${
                settings.soundNotificationsEnabled ? "bg-green-500" : "bg-gray-400"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition transform ${
                  settings.soundNotificationsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleLogout}
            id="admin-logout-button"
            className="flex items-center space-x-1 py-1.5 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold transition duration-150"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* 2. Bento Statistics Columns */}
      <section className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-rose-50 text-[#DF3E58]">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 block uppercase">Pesanan Hari Ini</span>
            <h3 className="text-xl font-extrabold text-gray-800">{summary.totalOrdersToday} order</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-green-50 text-green-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 block uppercase">Pendapatan</span>
            <h3 className="text-xl font-extrabold text-gray-800">Rp {summary.totalIncomeToday.toLocaleString("id-ID")}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 block uppercase">Terlaris</span>
            <h3 className="text-[13px] font-extrabold text-gray-800 truncate max-w-[200px]" title={summary.topSellingItem}>{summary.topSellingItem}</h3>
          </div>
        </div>

        {/* Gemini dynamic Insight box banner */}
        <div className="bg-rose-50/65 border border-rose-100 p-5 rounded-3xl col-span-1 md:col-span-1 flex flex-col justify-center relative overflow-hidden">
          <span className="absolute right-2 top-2 text-2xl rotate-45 opacity-10">🍓</span>
          <span className="text-[10px] font-extrabold text-[#DF3E58] tracking-wider uppercase block">Insight Gemini 3.5 Flash</span>
          <p className="text-xs font-semibold text-gray-700 italic mt-1 leading-snug">
            "{summary.aiInsight}"
          </p>
        </div>
      </section>

      {/* 3. Navigation Tab buttons */}
      <div className="px-6 pb-2 border-b border-gray-200">
        <div className="flex space-x-4">
          {[
            { id: "kanban", label: "Papan Pesanan Live", icon: LayoutGrid },
            { id: "menu", label: "Manajemen Menu", icon: Sliders },
            { id: "meja", label: "Manajemen Meja", icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-4 rounded-xl text-sm font-extrabold flex items-center space-x-2 transition ${
                  isActive
                    ? "bg-[#DF3E58]/10 text-[#DF3E58]"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Tab contents */}
      <main className="flex-1 p-6 overflow-x-auto">
        <AnimatePresence mode="wait">
          {/* TAB 1: KANBAN BOARD */}
          {activeTab === "kanban" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-6 min-h-[500px]"
            >
              {/* Kanban Column block generator helper */}
              {[
                { title: "Pesanan Baru", status: ["MENUNGGU"], bgHeader: "bg-red-100 text-red-650 border-red-200" },
                { title: "Sedang Diproses", status: ["DIPROSES"], bgHeader: "bg-rose-105 text-[#DF3E58] border-rose-200" },
                { title: "Siap Disajikan", status: ["SIAP"], bgHeader: "bg-blue-100 text-blue-600 border-blue-200" },
                { title: "Selesai / Selesai Makan", status: ["SELESAI"], bgHeader: "bg-green-100 text-green-600 border-green-200" }
              ].map(column => {
                const colOrders = filterByStatus(column.status);
                const isUrgentCol = column.title === "Pesanan Baru";

                return (
                  <div key={column.title} className="flex flex-col bg-gray-100/60 p-4 rounded-2xl border border-gray-200/50 min-w-[250px]">
                    {/* Header column title and counts badge */}
                    <div className={`p-3 rounded-xl border ${column.bgHeader} mb-4 flex justify-between items-center shadow-xs`}>
                      <span className="text-xs font-black tracking-wide uppercase">{column.title}</span>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-white/80">{colOrders.length}</span>
                    </div>

                    {/* Draggable/placed card loops */}
                    <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                      {colOrders.length === 0 ? (
                        <div className="text-center py-8 text-xs text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-xl">
                          Kosong
                        </div>
                      ) : (
                        colOrders.map(order => {
                          const secondsLeft = ticks[order.id];
                          const orderTimeText = () => {
                            const diffMs = Date.now() - new Date(order.createdAt).getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            return diffMins <= 0 ? "Baru saja" : `${diffMins} menit lalu`;
                          };

                          return (
                            <motion.div
                              layoutId={order.id}
                              key={order.id}
                              className={`bg-white p-4 rounded-2xl shadow-sm border transition flex flex-col justify-between ${
                                isUrgentCol 
                                  ? "border-red-150 hover:border-red-400" 
                                  : "border-gray-150 hover:border-[#DF3E58]/40"
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="text-[10px] font-black tracking-tight text-gray-400">#{order.id.slice(0, 6).toUpperCase()}</span>
                                    <h4 className="text-md font-extrabold text-gray-800 leading-none mt-1">Meja {order.table.number}</h4>
                                  </div>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                    order.paymentMethod === "QRIS" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                                  }`}>
                                    {order.paymentMethod}
                                  </span>
                                </div>

                                <div className="text-xs text-gray-600 font-semibold mb-3">
                                  Nama: <span className="font-bold text-gray-800">{order.customerName || "-"}</span>
                                </div>

                                {/* Order Foods looping list */}
                                <div className="border-t border-b border-gray-100 py-3 mb-3 space-y-2">
                                  {order.orderItems.map((oi: any) => (
                                    <div key={oi.id} className="text-xs">
                                      <div className="flex justify-between items-start font-bold text-gray-700">
                                        <span>{oi.menuItem.name} <span className="text-gray-400">x{oi.quantity}</span></span>
                                        <span className="text-gray-500 font-semibold">Rp {(oi.unitPrice * oi.quantity).toLocaleString("id-ID")}</span>
                                      </div>
                                      {oi.options && (
                                        <p className="text-[10px] font-bold text-[#DF3E58] mt-0.5">
                                          {parseOptions(oi.options)}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between items-center text-xs mb-4">
                                  <span className="text-gray-400 font-extrabold">{orderTimeText()}</span>
                                  <span className="font-extrabold text-gray-900">Total: Rp {order.totalPrice.toLocaleString("id-ID")}</span>
                                </div>

                                {ticks[order.id] !== undefined && ticks[order.id] > 0 && (
                                  <div className="bg-rose-50 border border-rose-100/50 text-[#DF3E58] rounded-xl p-2.5 mb-3 text-center text-xs font-bold leading-none animate-pulse">
                                    ⏱️ Auto-Terima: <span className="text-base font-black">{ticks[order.id]}</span> detik
                                  </div>
                                )}

                                {/* Action button controls based on active track */}
                                <div className="grid grid-cols-2 gap-2">
                                  {order.status === "MENUNGGU" && (
                                    <>
                                      <button
                                        onClick={() => updateOrderStatus(order.id, "DIPROSES")}
                                        className="py-2.5 px-1 rounded-xl bg-green-500 hover:bg-green-600 text-white font-extrabold text-xs transition"
                                      >
                                        Terima
                                      </button>
                                      <button
                                        onClick={() => handleTolakOrder(order.id)}
                                        className="py-2.5 px-1 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 font-extrabold text-xs transition"
                                      >
                                        Tolak
                                      </button>
                                    </>
                                  )}

                                  {order.status === "DIPROSES" && (
                                    <>
                                      <button
                                        onClick={() => updateOrderStatus(order.id, "SIAP")}
                                        className="py-2.5 px-1 rounded-xl bg-[#DF3E58] hover:bg-[#FF758F] text-white font-extrabold text-xs col-span-2 transition"
                                      >
                                        Siap Disajikan
                                      </button>
                                    </>
                                  )}

                                  {order.status === "SIAP" && (
                                    <>
                                      <button
                                        onClick={() => updateOrderStatus(order.id, "SELESAI")}
                                        className="py-2.5 px-1 rounded-xl bg-green-500 hover:bg-green-600 text-white font-extrabold text-xs col-span-2 transition"
                                      >
                                        Selesai Makan
                                      </button>
                                    </>
                                  )}

                                  {order.status === "SELESAI" && (
                                    <span className="text-[10px] text-green-500 font-extrabold col-span-2 text-center py-2 flex items-center justify-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Selesai Diarsip
                                    </span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* TAB 2: MENU MANAGEMENT */}
          {activeTab === "menu" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm"
            >
              <h3 className="text-lg font-extrabold text-gray-800 mb-4">Daftar Menu Warung Hangat</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-extrabold">
                      <th className="p-4 rounded-l-xl uppercase text-xs">Nama Item</th>
                      <th className="p-4 uppercase text-xs">Kategori</th>
                      <th className="p-4 uppercase text-xs">Harga (Rp)</th>
                      <th className="p-4 uppercase text-xs">Deskripsi</th>
                      <th className="p-4 uppercase text-xs">Menu Populer</th>
                      <th className="p-4 rounded-r-xl uppercase text-xs">Status Ketersediaan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {menuItems.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition">
                        <td className="p-4 font-extrabold text-gray-800">
                          {item.name} {item.isPopular && "🔥"}
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                            item.category === "Makanan" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
                          }`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="p-4">
                          {/* INLINE PRICE UPDATES */}
                          <input
                            type="number"
                            value={item.price}
                            onChange={e => handleUpdateMenuItem(item.id, { price: Number(e.target.value) })}
                            className="bg-gray-100 focus:bg-white border-0 focus:ring-1 focus:ring-[#DF3E58] rounded-lg p-2 w-28 text-sm font-extrabold text-gray-800 transition"
                          />
                        </td>
                        <td className="p-4 max-w-sm">
                          {/* INLINE DESCRIPTION EDIT */}
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => handleUpdateMenuItem(item.id, { description: e.target.value })}
                            className="bg-gray-100 focus:bg-white border-0 focus:ring-1 focus:ring-[#DF3E58] rounded-lg p-2 w-full text-xs font-medium text-gray-650 transition"
                          />
                        </td>
                        <td className="p-4">
                          {/* TOGGLE isPopular */}
                          <button
                            onClick={() => handleUpdateMenuItem(item.id, { isPopular: !item.isPopular })}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                              item.isPopular 
                                ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200" 
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                          >
                            {item.isPopular ? "🔥 Populer" : "Standard"}
                          </button>
                        </td>
                        <td className="p-4">
                          {/* STATUS TOGGLE AVAILABLE / SOUT */}
                          <button
                            onClick={() => handleUpdateMenuItem(item.id, { isAvailable: !item.isAvailable })}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition leading-none ${
                              item.isAvailable
                                ? "bg-green-100 text-green-600 hover:bg-green-200"
                                : "bg-red-150 text-red-600 hover:bg-red-200"
                            }`}
                          >
                            {item.isAvailable ? "✓ TERSEDIA" : "⚡ KOSONG / HABIS"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* TAB 3: TABLE & QR CODES */}
          {activeTab === "meja" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {/* Add table form panel */}
              <div className="bg-white p-6 rounded-3xl border border-gray-150 shadow-sm self-start">
                <h3 className="text-md font-bold text-gray-800 mb-4">Tambah Meja Restoran</h3>
                <form onSubmit={handleAddTable} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1 leading-none uppercase">Nomor Meja</label>
                    <input
                      type="number"
                      required
                      value={newTableNum}
                      onChange={e => setNewTableNum(e.target.value)}
                      placeholder="Masukkan Angka, contoh: 11"
                      className="w-full text-sm rounded-xl p-3 bg-gray-50 border border-gray-250 focus:border-[#DF3E58] focus:outline-none"
                    />
                  </div>

                  {tableError && (
                    <div className="text-xs font-bold text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100">
                      {tableError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-[#DF3E58] hover:bg-[#FF758F] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition duration-150"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Meja</span>
                  </button>
                </form>
              </div>

              {/* Grid Tables Display Column */}
              <div className="bg-white p-6 rounded-3xl border border-gray-150 shadow-sm md:col-span-2">
                <h3 className="text-md font-bold text-gray-800 mb-4">Daftar Meja & QR Code Aktif</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tables.map(table => (
                    <div
                      key={table.id}
                      className="p-4 rounded-2xl bg-gray-50/75 border border-gray-200/50 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-extrabold text-[#DF3E58] text-lg leading-none">Meja {table.number}</h4>
                        <span className="text-[10px] text-gray-400 font-bold block mt-1 tracking-tight">QR Generator Aktif</span>
                        
                        {/* Download button data url png */}
                        <a
                          href={table.qrCodeUrl}
                          download={`Meja_${table.number}_QR.png`}
                          className="mt-3 inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-blue-105 shadow-xs transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh QR</span>
                        </a>
                      </div>

                      <div className="flex flex-col items-center space-y-2">
                        <img
                          src={table.qrCodeUrl}
                          alt={`QR Meja ${table.number}`}
                          className="w-20 h-20 bg-white border border-gray-200 p-1 rounded-lg shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                        {/* Show delete for tables above 10 (we can protect seed tables if required, but deletion is open to admins) */}
                        <button
                          onClick={() => handleDeleteTable(table.id)}
                          className="text-red-500 hover:text-red-650 font-bold text-[10px] flex items-center space-x-1 uppercase"
                          title="Hapus meja"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
