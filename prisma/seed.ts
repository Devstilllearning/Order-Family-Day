import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Create Admin
  const adminEmail = "admin@warung.com";
  const existingAdmin = await prisma.admin.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.admin.create({
      data: {
        email: adminEmail,
        passwordHash
      }
    });
    console.log("Admin seeded: admin@warung.com / admin123");
  } else {
    console.log("Admin already exists, skipping...");
  }

  // 2. Create Menu Items
  const menuItems = [
    {
      name: "Bakso",
      category: "Makanan",
      price: 15000,
      description: "Bakso sapi kenyal dengan kuah kaldu gurih, disajikan hangat",
      isPopular: true,
      isAvailable: true,
    },
    {
      name: "Spanish Latte",
      category: "Minuman",
      price: 18000,
      description: "Espresso shot dengan susu segar dan sentuhan gula aren",
      isPopular: true,
      isAvailable: true,
    },
    {
      name: "Teh Poci",
      category: "Minuman",
      price: 8000,
      description: "Teh tubruk asli diseduh dalam poci tanah liat dengan gula batu",
      isPopular: false,
      isAvailable: true,
    }
  ];

  for (const item of menuItems) {
    const existingItem = await prisma.menuItem.findFirst({
      where: { name: item.name }
    });

    if (!existingItem) {
      await prisma.menuItem.create({ data: item });
      console.log(`Menu item seeded: ${item.name}`);
    } else {
      console.log(`Menu item already exists: ${item.name}`);
    }
  }

  // 3. Create 10 Tables (Meja 1 - 10)
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  for (let i = 1; i <= 10; i++) {
    const existingTable = await prisma.table.findUnique({
      where: { number: i }
    });

    // Content: destination URL e.g. http://localhost:3000/?table=3
    const destinationUrl = `${appUrl}?table=${i}`;
    let qrCodeBase64 = "";
    try {
      qrCodeBase64 = await QRCode.toDataURL(destinationUrl, {
        color: {
          dark: "#D64C1A", // Brand color
          light: "#FFF8F0"  // Secondary brand color
        },
        width: 300,
        margin: 2
      });
    } catch (err) {
      console.error("Error generating QR code:", err);
    }

    if (!existingTable) {
      await prisma.table.create({
        data: {
          number: i,
          qrCodeUrl: qrCodeBase64
        }
      });
      console.log(`Table ${i} seeded with base64 QR Code`);
    } else {
      // Update QR Code URL in case APP_URL changed
      await prisma.table.update({
        where: { id: existingTable.id },
        data: { qrCodeUrl: qrCodeBase64 }
      });
      console.log(`Table ${i} QR code updated`);
    }
  }

  console.log("Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error in seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
