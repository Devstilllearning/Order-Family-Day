import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { GoogleGenAI } from "@google/genai";
import dns from "dns";

// Prisma client
const prisma = new PrismaClient();

// Secret JWT
const JWT_SECRET = process.env.JWT_SECRET || "warung_hangat_secret_key_123";

// Lazy-loaded AI client
let aiClient: GoogleGenAI | null = null;
function getGemini() {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY is not defined. Using static fallback responses.");
    return null;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
    return aiClient;
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    return null;
  }
}

// Global settings
let autoAcceptEnabled = false;
let soundNotificationsEnabled = true;

// Track active countdowns for auto accept
// Maps orderId -> countdown value (seconds)
const orderCountdowns: Record<string, number> = {};
const orderTimers: Record<string, NodeJS.Timeout> = {};

// In-memory cache store for AI content to strictly respect API quotas and handle 429s beautifully
const cachedGreetings: Record<string, string> = {};

let cachedAiInsight = "";
let cachedInsightTimestamp = 0;
const INSIGHT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache to avoid rate limits

// High fidelity fallback Generators when API key is missing or quota is exhausted (429)
function getFallbackGreeting(itemNames: string, tableNumber: number | string): string {
  const containsBakso = /bakso/i.test(itemNames);
  const containsLatte = /latte/i.test(itemNames);
  const containsTeh = /teh/i.test(itemNames);

  const baksos = [
    `Kuah kaldu Bakso panas tiada duanya! Siap disajikan hangat untuk Meja ${tableNumber} 😊`,
    `Semangkok Bakso empuk nan harum sedang digodok penuh kasih sayang untukmu di Meja ${tableNumber}! 🍜`,
    `Bakso kenyal dan kuah kaldu hangat segar siap mendarat di Meja ${tableNumber}! 😍`
  ];
  const lattes = [
    `Segelas Spanish Latte premium yang manis & creamy lagi disiapin oleh Barista kami biar Meja ${tableNumber} segar maksimal! ☕`,
    `Kopi espresso & susu segar Spanish Latte sedang diramu spesial untuk menyegarkan Meja ${tableNumber}! 🥛`
  ];
  const tehs = [
    `Teh Poci tubruk wangi sepet sedang diseduh hangat menggunakan poci tanah liat autentik kami! 🫖`,
    `Sruputan Teh Poci manis wangi khas melati siap disajikan hangat untuk Meja ${tableNumber}! 🍂`
  ];
  const general = [
    `Mulai hari indahmu di Warung Hangat! Pesanan lezat Meja ${tableNumber} sedang diracik sepenuh hati 😊`,
    `Hidangan hangat yang super lezat pilihanmu sedang dipersiapkan di dapur! Nyamm! 😋`,
    `Dapur kami sedang bersemangat membakar kelezatan pesananmu untuk Meja ${tableNumber}! Tunggu sebentar ya! 🎉`
  ];

  if (containsBakso) return baksos[Math.floor(Math.random() * baksos.length)];
  if (containsLatte) return lattes[Math.floor(Math.random() * lattes.length)];
  if (containsTeh) return tehs[Math.floor(Math.random() * tehs.length)];
  return general[Math.floor(Math.random() * general.length)];
}

function getFallbackInsight(totalOrders: number, totalIncome: number, topSellingItem: string): string {
  if (totalOrders === 0) {
    return "Ayo semangat! Dapur bersih, bahan segar melimpah, siap melayani pelanggan setia Warung Hangat hari ini! 🍓";
  }
  if (totalIncome > 300000) {
    return `Luar biasa! Pendapatan hari ini tembus Rp ${totalIncome.toLocaleString("id-ID")}. Tim dapur hebat, pertahankan performa terbaiknya! ✨`;
  }
  if (totalOrders > 5) {
    return `Hari ini cukup sibuk dengan ${totalOrders} pesanan selesai disajikan. Menu '${topSellingItem}' menjadi bintang utama! 💪`;
  }
  return `Penjualan berjalan stabil dengan omset Rp ${totalIncome.toLocaleString("id-ID")}. Selalu sajikan keramahan dan kehangatan rasa! 🌸`;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  
  // Attach socket.io
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  // Socket connection
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Send initial configuration to administrative clients
    socket.emit("settings_update", {
      autoAcceptEnabled,
      soundNotificationsEnabled
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Middlewares
  const authenticateAdmin = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized access" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.admin = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };

  // 🏪 BACKEND REST ROUTING

  // 1. Authentication
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi." });
    }

    try {
      const admin = await prisma.admin.findUnique({ where: { email } });
      if (!admin) {
        return res.status(401).json({ error: "Email atau password salah." });
      }

      const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Email atau password salah." });
      }

      const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, {
        expiresIn: "1d",
      });

      return res.json({ token, admin: { email: admin.email } });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // 2. Menu Items
  app.get("/api/menu", async (req, res) => {
    try {
      const menu = await prisma.menuItem.findMany();
      return res.json(menu);
    } catch (error) {
      console.error("Get menu error:", error);
      return res.status(500).json({ error: "Failed to fetch menu" });
    }
  });

  // Admin update menu item
  app.put("/api/menu/:id", authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { price, description, isAvailable, isPopular } = req.body;

    try {
      const updatedItem = await prisma.menuItem.update({
        where: { id },
        data: {
          price: price !== undefined ? Number(price) : undefined,
          description: description !== undefined ? description : undefined,
          isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
          isPopular: isPopular !== undefined ? Boolean(isPopular) : undefined,
        },
      });

      // Broadcast changes to customers
      io.emit("menu_availability_changed", updatedItem);
      return res.json(updatedItem);
    } catch (error) {
      console.error("Update menu error:", error);
      return res.status(500).json({ error: "Failed to update menu item" });
    }
  });

  // 3. Table / Meja Management
  app.get("/api/tables", async (req, res) => {
    try {
      const tables = await prisma.table.findMany({
        orderBy: { number: "asc" }
      });
      return res.json(tables);
    } catch (error) {
      console.error("Get tables error:", error);
      return res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  // Get single table
  app.get("/api/tables/:idOrNum", async (req, res) => {
    const { idOrNum } = req.params;
    try {
      let table;
      if (isNaN(Number(idOrNum))) {
        table = await prisma.table.findUnique({ where: { id: idOrNum } });
      } else {
        table = await prisma.table.findUnique({ where: { number: Number(idOrNum) } });
      }
      
      if (!table) {
        return res.status(404).json({ error: "Meja tidak ditemukan." });
      }
      return res.json(table);
    } catch (error) {
      console.error("Get single table error:", error);
      return res.status(500).json({ error: "Failed to fetch table" });
    }
  });

  // Add field table
  app.post("/api/tables", authenticateAdmin, async (req, res) => {
    const { number } = req.body;
    if (!number || isNaN(Number(number))) {
      return res.status(400).json({ error: "Nomor meja harus angka valid." });
    }

    try {
      const existingTable = await prisma.table.findUnique({
        where: { number: Number(number) }
      });

      if (existingTable) {
        return res.status(400).json({ error: "Nomor meja sudah terdaftar." });
      }

      // Generate dynamic QR code URL
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const qrcode = require("qrcode");
      const destinationUrl = `${appUrl}?table=${number}`;
      const qrCodeBase64 = await qrcode.toDataURL(destinationUrl, {
        color: {
          dark: "#DF3E58",
          light: "#FFF0F2"
        },
        width: 300,
        margin: 2
      });

      const newTable = await prisma.table.create({
        data: {
          number: Number(number),
          qrCodeUrl: qrCodeBase64
        }
      });

      return res.status(201).json(newTable);
    } catch (error) {
      console.error("Create table error:", error);
      return res.status(500).json({ error: "Failed to create table" });
    }
  });

  // Delete Table
  app.delete("/api/tables/:id", authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      await prisma.table.delete({ where: { id } });
      return res.json({ success: true });
    } catch (error) {
      console.error("Delete table error:", error);
      return res.status(500).json({ error: "Failed to delete table" });
    }
  });

  // 4. Orders Api

  // Helper trigger order acceptance countdown
  const setOrderCountdown = (orderId: string) => {
    orderCountdowns[orderId] = 15;
    io.emit("auto_accept_tick", { orderId, secondsLeft: 15 });

    orderTimers[orderId] = setInterval(async () => {
      const remaining = orderCountdowns[orderId];
      if (remaining === undefined) {
        clearInterval(orderTimers[orderId]);
        delete orderTimers[orderId];
        return;
      }

      if (remaining <= 1) {
        clearInterval(orderTimers[orderId]);
        delete orderTimers[orderId];
        delete orderCountdowns[orderId];

        // Auto accept!
        try {
          const order = await prisma.order.update({
            where: { id: orderId },
            data: { status: "DIPROSES" },
            include: { table: true, orderItems: { include: { menuItem: true } } }
          });
          io.emit("order_status_changed", order);
          io.emit("new_order", order); // Refresh admin Kanban
        } catch (error) {
          console.error("Auto accept failed for order:", orderId, error);
        }
      } else {
        orderCountdowns[orderId] = remaining - 1;
        io.emit("auto_accept_tick", { orderId, secondsLeft: remaining - 1 });
      }
    }, 1000);
  };

  // Create Order
  app.post("/api/orders", async (req, res) => {
    const { tableId, customerName, paymentMethod, items } = req.body;

    if (!tableId || !paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Data pesanan tidak lengkap." });
    }

    try {
      const table = await prisma.table.findUnique({ where: { id: tableId } });
      if (!table) {
        return res.status(404).json({ error: "Meja tidak valid." });
      }

      // Calculate total price
      let computedTotalPrice = 0;
      const orderItemsToCreate = [];

      for (const item of items) {
        const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
        if (!menuItem) {
          return res.status(400).json({ error: `Menu item ${item.menuItemId} tidak valid.` });
        }
        if (!menuItem.isAvailable) {
          return res.status(400).json({ error: `Menu item '${menuItem.name}' sedang kosong.` });
        }

        const optionsStr = typeof item.options === "string" ? item.options : JSON.stringify(item.options || {});
        computedTotalPrice += menuItem.price * Number(item.quantity);

        orderItemsToCreate.push({
          menuItemId: menuItem.id,
          quantity: Number(item.quantity),
          options: optionsStr,
          unitPrice: menuItem.price
        });
      }

      // Insert Order
      const newOrder = await prisma.order.create({
        data: {
          tableId: table.id,
          customerName: customerName || null,
          paymentMethod,
          status: "MENUNGGU",
          totalPrice: computedTotalPrice,
          orderItems: {
            create: orderItemsToCreate
          }
        },
        include: {
          table: true,
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      });

      // AI post-order greeting generation in background (lazy or dynamic cache, let's attach immediately!)
      // Emit socket trigger to Admin screen
      io.emit("new_order", newOrder);

      // Trigger automatic accept after 15 seconds if active
      if (autoAcceptEnabled) {
        setOrderCountdown(newOrder.id);
      }

      return res.status(201).json(newOrder);
    } catch (error) {
      console.error("Create order failed:", error);
      return res.status(500).json({ error: "Gagal membuat pesanan." });
    }
  });

  // Client gets greeting from Gemini
  app.get("/api/orders/:id/ai-greeting", async (req, res) => {
    const { id } = req.params;
    try {
      // Return cached greeting if available
      if (cachedGreetings[id]) {
        return res.json({ greeting: cachedGreetings[id] });
      }

      const order = await prisma.order.findUnique({
        where: { id },
        include: { 
          table: true,
          orderItems: { include: { menuItem: true } } 
        }
      });
      if (!order) {
        return res.status(404).json({ error: "Pesanan tidak ditemukan." });
      }

      const tableNum = order.table?.number || "Utama";
      const itemNames = order.orderItems.map((oi) => `${oi.menuItem.name} (x${oi.quantity})`).join(", ");

      const gemini = getGemini();
      if (!gemini) {
        const greeting = getFallbackGreeting(itemNames, tableNum);
        cachedGreetings[id] = greeting;
        return res.json({ greeting });
      }

      try {
        const response = await gemini.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Pelanggan baru saja memesan: ${itemNames} di Meja ${tableNum}. Buat pesan singkat ramah dan menyenangkan dalam bahasa Indonesia, maksimal 1 kalimat, tone hangat dan sedikit lucu.`
        });

        const generated = response.text?.trim() || getFallbackGreeting(itemNames, tableNum);
        cachedGreetings[id] = generated;
        return res.json({ greeting: generated });
      } catch (gemError: any) {
        console.warn("Gemini service unavailable (quota or limits), using high-fidelity fallback greeting.");
        const greeting = getFallbackGreeting(itemNames, tableNum);
        cachedGreetings[id] = greeting;
        return res.json({ greeting });
      }
    } catch (error) {
      console.error("Failed to retrieve greeting:", error);
      return res.json({ greeting: "Pesanan kamu sudah diterima dapur! Segera disajikan hangat-hangat 😊" });
    }
  });

  // Fetch all orders (Admin board)
  app.get("/api/orders", authenticateAdmin, async (req, res) => {
    try {
      const orders = await prisma.order.findMany({
        include: {
          table: true,
          orderItems: {
            include: {
              menuItem: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return res.json(orders);
    } catch (error) {
      console.error("Get orders failed:", error);
      return res.status(500).json({ error: "Gagal memuat daftar pesanan." });
    }
  });

  // Customer polls/gets single order Status
  app.get("/api/orders/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          table: true,
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      });
      if (!order) {
        return res.status(404).json({ error: "Pesanan tidak ditemukan." });
      }
      return res.json(order);
    } catch (error) {
      console.error("Get single order failed:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin and countdown status update
  app.patch("/api/orders/:id/status", authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const validStatuses = ["MENUNGGU", "DIPROSES", "SIAP", "SELESAI", "DITOLAK"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status pesanan tidak valid." });
    }

    // Cancel countdown timers if actioned manually
    if (orderTimers[id]) {
      clearInterval(orderTimers[id]);
      delete orderTimers[id];
      delete orderCountdowns[id];
    }

    try {
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          status,
          rejectionReason: status === "DITOLAK" ? rejectionReason : null
        },
        include: {
          table: true,
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      });

      // Emit status update to specific client
      io.emit("order_status_changed", updatedOrder);
      
      // Emit trigger to refresh admin dashboard kanban
      io.emit("orders_updated", updatedOrder);

      return res.json(updatedOrder);
    } catch (error) {
      console.error("Update status failed:", error);
      return res.status(500).json({ error: "Gagal mengubah status pesanan." });
    }
  });

  // Administrative Control Settings Toggle
  app.post("/api/admin/settings", authenticateAdmin, (req, res) => {
    const { soundNotifications, autoAccept } = req.body;

    if (soundNotifications !== undefined) {
      soundNotificationsEnabled = Boolean(soundNotifications);
    }
    if (autoAccept !== undefined) {
      autoAcceptEnabled = Boolean(autoAccept);
    }

    io.emit("settings_update", {
      autoAcceptEnabled,
      soundNotificationsEnabled
    });

    return res.json({ success: true, autoAcceptEnabled, soundNotificationsEnabled });
  });

  // Fetch administrator settings status
  app.get("/api/admin/settings", authenticateAdmin, (req, res) => {
    return res.json({ autoAcceptEnabled, soundNotificationsEnabled });
  });

  // 5. Admin Business Metrics & AI Insights
  app.get("/api/admin/summary", authenticateAdmin, async (req, res) => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayOrders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfDay
          },
          status: {
            not: "DITOLAK"
          }
        },
        include: {
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      });

      const totalOrdersToday = todayOrders.length;
      const totalIncomeToday = todayOrders.reduce((sum, o) => sum + o.totalPrice, 0);

      // Best selling menu items summary
      const itemCounts: Record<string, { name: string; qty: number }> = {};
      todayOrders.forEach(o => {
        o.orderItems.forEach(oi => {
          if (!itemCounts[oi.menuItemId]) {
            itemCounts[oi.menuItemId] = { name: oi.menuItem.name, qty: 0 };
          }
          itemCounts[oi.menuItemId].qty += oi.quantity;
        });
      });

      const sortedItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty);
      const topSellingItem = sortedItems.length > 0 ? `${sortedItems[0].name} (${sortedItems[0].qty} porsi)` : "Belum ada pesanan";

      // Gemini analysis and summaries with cached TTL
      let aiInsight = cachedAiInsight;
      const now = Date.now();
      const isCacheExpired = now - cachedInsightTimestamp > INSIGHT_CACHE_TTL;

      if (!aiInsight || isCacheExpired) {
        const gemini = getGemini();
        if (gemini && totalOrdersToday > 0) {
          try {
            const prompt = `Data penjualan hari ini: Total pesanan: ${totalOrdersToday}, Total pendapatan: Rp ${totalIncomeToday.toLocaleString("id-ID")}, Item terlaris: ${topSellingItem}. Buat 1 kalimat insight singkat yang ramah dan memotivasi untuk admin Warung Hangat dalam bahasa Indonesia.`;
            const response = await gemini.models.generateContent({
              model: "gemini-3.5-flash",
              contents: prompt
            });
            if (response.text) {
              aiInsight = response.text.trim();
              cachedAiInsight = aiInsight;
              cachedInsightTimestamp = now;
            } else {
              aiInsight = getFallbackInsight(totalOrdersToday, totalIncomeToday, topSellingItem);
            }
          } catch (error: any) {
            console.warn("Failed to generate metrics summary insight from Gemini, using high-fidelity fallback:", error.message || error);
            aiInsight = getFallbackInsight(totalOrdersToday, totalIncomeToday, topSellingItem);
          }
        } else {
          aiInsight = getFallbackInsight(totalOrdersToday, totalIncomeToday, topSellingItem);
        }
      }

      return res.json({
        totalOrdersToday,
        totalIncomeToday,
        topSellingItem,
        aiInsight
      });
    } catch (error) {
      console.error("Get summary metrics failed:", error);
      return res.status(500).json({ error: "Gagal memuat ringkasan keuangan." });
    }
  });

  // Vite middleware integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(3000, "0.0.0.0", () => {
    console.log(`Server is booted and listening on host http://0.0.0.0:3000`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start fullstack server node application:", err);
});
