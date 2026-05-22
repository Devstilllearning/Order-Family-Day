var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path = __toESM(require("path"), 1);
var import_socket = require("socket.io");
var import_vite = require("vite");
var import_client = require("@prisma/client");
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_genai = require("@google/genai");
var prisma = new import_client.PrismaClient();
var JWT_SECRET = process.env.JWT_SECRET || "warung_hangat_secret_key_123";
var aiClient = null;
function getGemini() {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY is not defined. Using static fallback responses.");
    return null;
  }
  try {
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    return aiClient;
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    return null;
  }
}
var autoAcceptEnabled = false;
var soundNotificationsEnabled = true;
var orderCountdowns = {};
var orderTimers = {};
var cachedGreetings = {};
var cachedAiInsight = "";
var cachedInsightTimestamp = 0;
var INSIGHT_CACHE_TTL = 10 * 60 * 1e3;
function getFallbackGreeting(itemNames, tableNumber) {
  const containsBakso = /bakso/i.test(itemNames);
  const containsLatte = /latte/i.test(itemNames);
  const containsTeh = /teh/i.test(itemNames);
  const baksos = [
    `Kuah kaldu Bakso panas tiada duanya! Siap disajikan hangat untuk Meja ${tableNumber} \u{1F60A}`,
    `Semangkok Bakso empuk nan harum sedang digodok penuh kasih sayang untukmu di Meja ${tableNumber}! \u{1F35C}`,
    `Bakso kenyal dan kuah kaldu hangat segar siap mendarat di Meja ${tableNumber}! \u{1F60D}`
  ];
  const lattes = [
    `Segelas Spanish Latte premium yang manis & creamy lagi disiapin oleh Barista kami biar Meja ${tableNumber} segar maksimal! \u2615`,
    `Kopi espresso & susu segar Spanish Latte sedang diramu spesial untuk menyegarkan Meja ${tableNumber}! \u{1F95B}`
  ];
  const tehs = [
    `Teh Poci tubruk wangi sepet sedang diseduh hangat menggunakan poci tanah liat autentik kami! \u{1FAD6}`,
    `Sruputan Teh Poci manis wangi khas melati siap disajikan hangat untuk Meja ${tableNumber}! \u{1F342}`
  ];
  const general = [
    `Mulai hari indahmu di Warung Hangat! Pesanan lezat Meja ${tableNumber} sedang diracik sepenuh hati \u{1F60A}`,
    `Hidangan hangat yang super lezat pilihanmu sedang dipersiapkan di dapur! Nyamm! \u{1F60B}`,
    `Dapur kami sedang bersemangat membakar kelezatan pesananmu untuk Meja ${tableNumber}! Tunggu sebentar ya! \u{1F389}`
  ];
  if (containsBakso) return baksos[Math.floor(Math.random() * baksos.length)];
  if (containsLatte) return lattes[Math.floor(Math.random() * lattes.length)];
  if (containsTeh) return tehs[Math.floor(Math.random() * tehs.length)];
  return general[Math.floor(Math.random() * general.length)];
}
function getFallbackInsight(totalOrders, totalIncome, topSellingItem) {
  if (totalOrders === 0) {
    return "Ayo semangat! Dapur bersih, bahan segar melimpah, siap melayani pelanggan setia Warung Hangat hari ini! \u{1F353}";
  }
  if (totalIncome > 3e5) {
    return `Luar biasa! Pendapatan hari ini tembus Rp ${totalIncome.toLocaleString("id-ID")}. Tim dapur hebat, pertahankan performa terbaiknya! \u2728`;
  }
  if (totalOrders > 5) {
    return `Hari ini cukup sibuk dengan ${totalOrders} pesanan selesai disajikan. Menu '${topSellingItem}' menjadi bintang utama! \u{1F4AA}`;
  }
  return `Penjualan berjalan stabil dengan omset Rp ${totalIncome.toLocaleString("id-ID")}. Selalu sajikan keramahan dan kehangatan rasa! \u{1F338}`;
}
async function startServer() {
  const app = (0, import_express.default)();
  app.use((0, import_cors.default)());
  const server = import_http.default.createServer(app);
  const io = new import_socket.Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  app.use(import_express.default.json());
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.emit("settings_update", {
      autoAcceptEnabled,
      soundNotificationsEnabled
    });
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
  const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized access" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = import_jsonwebtoken.default.verify(token, JWT_SECRET);
      req.admin = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
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
      const isPasswordValid = await import_bcryptjs.default.compare(password, admin.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Email atau password salah." });
      }
      const token = import_jsonwebtoken.default.sign({ id: admin.id, email: admin.email }, JWT_SECRET, {
        expiresIn: "1d"
      });
      return res.json({ token, admin: { email: admin.email } });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.get("/api/menu", async (req, res) => {
    try {
      const menu = await prisma.menuItem.findMany();
      return res.json(menu);
    } catch (error) {
      console.error("Get menu error:", error);
      return res.status(500).json({ error: "Failed to fetch menu" });
    }
  });
  app.put("/api/menu/:id", authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { price, description, isAvailable, isPopular } = req.body;
    try {
      const updatedItem = await prisma.menuItem.update({
        where: { id },
        data: {
          price: price !== void 0 ? Number(price) : void 0,
          description: description !== void 0 ? description : void 0,
          isAvailable: isAvailable !== void 0 ? Boolean(isAvailable) : void 0,
          isPopular: isPopular !== void 0 ? Boolean(isPopular) : void 0
        }
      });
      io.emit("menu_availability_changed", updatedItem);
      return res.json(updatedItem);
    } catch (error) {
      console.error("Update menu error:", error);
      return res.status(500).json({ error: "Failed to update menu item" });
    }
  });
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
  const setOrderCountdown = (orderId) => {
    orderCountdowns[orderId] = 15;
    io.emit("auto_accept_tick", { orderId, secondsLeft: 15 });
    orderTimers[orderId] = setInterval(async () => {
      const remaining = orderCountdowns[orderId];
      if (remaining === void 0) {
        clearInterval(orderTimers[orderId]);
        delete orderTimers[orderId];
        return;
      }
      if (remaining <= 1) {
        clearInterval(orderTimers[orderId]);
        delete orderTimers[orderId];
        delete orderCountdowns[orderId];
        try {
          const order = await prisma.order.update({
            where: { id: orderId },
            data: { status: "DIPROSES" },
            include: { table: true, orderItems: { include: { menuItem: true } } }
          });
          io.emit("order_status_changed", order);
          io.emit("new_order", order);
        } catch (error) {
          console.error("Auto accept failed for order:", orderId, error);
        }
      } else {
        orderCountdowns[orderId] = remaining - 1;
        io.emit("auto_accept_tick", { orderId, secondsLeft: remaining - 1 });
      }
    }, 1e3);
  };
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
      let computedTotalPrice = 0;
      const orderItemsToCreate = [];
      for (const item of items) {
        const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
        if (!menuItem) {
          return res.status(400).json({ error: `Menu item ${item.menuItemId} tidak valid.` });
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
      io.emit("new_order", newOrder);
      if (autoAcceptEnabled) {
        setOrderCountdown(newOrder.id);
      }
      return res.status(201).json(newOrder);
    } catch (error) {
      console.error("Create order failed:", error);
      return res.status(500).json({ error: "Gagal membuat pesanan." });
    }
  });
  app.get("/api/orders/:id/ai-greeting", async (req, res) => {
    const { id } = req.params;
    try {
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
      } catch (gemError) {
        console.warn("Gemini service unavailable (quota or limits), using high-fidelity fallback greeting.");
        const greeting = getFallbackGreeting(itemNames, tableNum);
        cachedGreetings[id] = greeting;
        return res.json({ greeting });
      }
    } catch (error) {
      console.error("Failed to retrieve greeting:", error);
      return res.json({ greeting: "Pesanan kamu sudah diterima dapur! Segera disajikan hangat-hangat \u{1F60A}" });
    }
  });
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
  app.patch("/api/orders/:id/status", authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const validStatuses = ["MENUNGGU", "DIPROSES", "SIAP", "SELESAI", "DITOLAK"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status pesanan tidak valid." });
    }
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
      io.emit("order_status_changed", updatedOrder);
      io.emit("orders_updated", updatedOrder);
      return res.json(updatedOrder);
    } catch (error) {
      console.error("Update status failed:", error);
      return res.status(500).json({ error: "Gagal mengubah status pesanan." });
    }
  });
  app.post("/api/admin/settings", authenticateAdmin, (req, res) => {
    const { soundNotifications, autoAccept } = req.body;
    if (soundNotifications !== void 0) {
      soundNotificationsEnabled = Boolean(soundNotifications);
    }
    if (autoAccept !== void 0) {
      autoAcceptEnabled = Boolean(autoAccept);
    }
    io.emit("settings_update", {
      autoAcceptEnabled,
      soundNotificationsEnabled
    });
    return res.json({ success: true, autoAcceptEnabled, soundNotificationsEnabled });
  });
  app.get("/api/admin/settings", authenticateAdmin, (req, res) => {
    return res.json({ autoAcceptEnabled, soundNotificationsEnabled });
  });
  app.get("/api/admin/summary", authenticateAdmin, async (req, res) => {
    try {
      const startOfDay = /* @__PURE__ */ new Date();
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
      const itemCounts = {};
      todayOrders.forEach((o) => {
        o.orderItems.forEach((oi) => {
          if (!itemCounts[oi.menuItemId]) {
            itemCounts[oi.menuItemId] = { name: oi.menuItem.name, qty: 0 };
          }
          itemCounts[oi.menuItemId].qty += oi.quantity;
        });
      });
      const sortedItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty);
      const topSellingItem = sortedItems.length > 0 ? `${sortedItems[0].name} (${sortedItems[0].qty} porsi)` : "Belum ada pesanan";
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
          } catch (error) {
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(3e3, "0.0.0.0", () => {
    console.log(`Server is booted and listening on host http://0.0.0.0:3000`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start fullstack server node application:", err);
});
//# sourceMappingURL=server.cjs.map
