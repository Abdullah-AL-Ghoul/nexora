import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/db";

/**
 * NEXORA demo seed.
 *
 * Every record produced by this script is DEMO DATA:
 * - demo users live on the `nexora.demo` domain
 * - demo SKUs are prefixed with `DEMO-`
 * - demo order numbers are prefixed with `NX-DEMO-`
 * - all demo users share the same demo password (see DEMO_PASSWORD)
 *
 * The script is destructive: it wipes the local database before inserting.
 * Never run it against a production database.
 */

const DEMO_PASSWORD = "NexoraDemo!2026";

const IMG = (slug: string, i: number) => `/images/products/${slug}-${i}.webp`;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

const CATEGORIES = [
  { name: "Apparel", slug: "apparel", description: "Refined everyday clothing", position: 1 },
  { name: "Footwear", slug: "footwear", description: "Shoes for every occasion", position: 2 },
  { name: "Accessories", slug: "accessories", description: "Finishing touches", position: 3 },
  { name: "Electronics", slug: "electronics", description: "Everyday tech essentials", position: 4 },
  { name: "Home & Living", slug: "home-living", description: "Considered objects for the home", position: 5 },
  { name: "Beauty", slug: "beauty", description: "Skin, hair and fragrance", position: 6 },
  { name: "Sports & Outdoors", slug: "sports-outdoors", description: "Gear that moves with you", position: 7 },
  { name: "Watches", slug: "watches", description: "Precision on your wrist", position: 8 },
] as const;

type SeedVariant = {
  name: string;
  options: Record<string, string>;
  priceDelta: number;
  stock: number;
  suffix: string;
};

type SeedProduct = {
  name: string;
  slug: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  brand?: string;
  blurb: string;
  images?: number;
  variants?: SeedVariant[];
};

const PRODUCTS: SeedProduct[] = [
  { name: "Midnight Wool Overcoat", slug: "midnight-wool-overcoat", category: "apparel", price: 38900, compareAtPrice: 46900, stock: 14, brand: "NEXORA Atelier", blurb: "Double-faced wool overcoat with a clean, structured silhouette.", images: 3, variants: [{ name: "Charcoal", options: { color: "Charcoal" }, priceDelta: 0, stock: 8, suffix: "charcoal" }, { name: "Camel", options: { color: "Camel" }, priceDelta: 0, stock: 6, suffix: "camel" }] },
  { name: "Essential Crewneck Tee", slug: "essential-crewneck-tee", category: "apparel", price: 3900, stock: 120, brand: "NEXORA Basics", blurb: "Mid-weight combed cotton tee with a tailored fit." },
  { name: "Tailored Slim Chinos", slug: "tailored-slim-chinos", category: "apparel", price: 9900, compareAtPrice: 12900, stock: 46, brand: "NEXORA Basics", blurb: "Stretch cotton chinos cut close through the leg." },
  { name: "Merino Zip Hoodie", slug: "merino-zip-hoodie", category: "apparel", price: 15900, stock: 32, brand: "NEXORA Atelier", blurb: "Temperature-regulating merino hoodie for layering." },
  { name: "Linen Resort Shirt", slug: "linen-resort-shirt", category: "apparel", price: 8900, stock: 3, brand: "NEXORA Basics", blurb: "Breathable washed-linen shirt with a relaxed collar." },
  { name: "Cashmere Blend Sweater", slug: "cashmere-blend-sweater", category: "apparel", price: 18900, stock: 21, brand: "NEXORA Atelier", blurb: "Soft cashmere-merino knit with ribbed trims." },
  { name: "Everyday Oxford Shirt", slug: "everyday-oxford-shirt", category: "apparel", price: 7900, stock: 58, brand: "NEXORA Basics", blurb: "Classic oxford weave, button-down collar, daily wear." },

  { name: "Classic Leather Sneakers", slug: "classic-leather-sneakers", category: "footwear", price: 14900, compareAtPrice: 17900, stock: 38, brand: "NEXORA Studio", blurb: "Full-grain leather sneakers on a vulcanized sole.", images: 3, variants: [{ name: "White", options: { color: "White" }, priceDelta: 0, stock: 20, suffix: "white" }, { name: "Black", options: { color: "Black" }, priceDelta: 0, stock: 18, suffix: "black" }] },
  { name: "Suede Chelsea Boots", slug: "suede-chelsea-boots", category: "footwear", price: 19900, stock: 17, brand: "NEXORA Studio", blurb: "Elastic-gusset boots in water-repellent suede." },
  { name: "Performance Running Shoes", slug: "performance-running-shoes", category: "footwear", price: 16500, stock: 44, brand: "NEXORA Motion", blurb: "Cushioned daily trainer with a breathable mesh upper." },
  { name: "Heritage Loafers", slug: "heritage-loafers", category: "footwear", price: 17900, stock: 12, brand: "NEXORA Studio", blurb: "Hand-finished penny loafers on a leather sole." },
  { name: "Trail Hiking Boots", slug: "trail-hiking-boots", category: "footwear", price: 21900, compareAtPrice: 24900, stock: 0, brand: "NEXORA Motion", blurb: "Waterproof boots with an aggressive grip outsole." },
  { name: "Minimalist Slip-Ons", slug: "minimalist-slip-ons", category: "footwear", price: 9900, stock: 51, brand: "NEXORA Studio", blurb: "Knit slip-ons with a moulded foam footbed." },

  { name: "Full-Grain Leather Belt", slug: "full-grain-leather-belt", category: "accessories", price: 6900, stock: 64, brand: "NEXORA Studio", blurb: "Vegetable-tanned leather belt with brushed buckle." },
  { name: "Canvas Weekender Bag", slug: "canvas-weekender-bag", category: "accessories", price: 15900, compareAtPrice: 18900, stock: 19, brand: "NEXORA Studio", blurb: "Reinforced cotton-canvas duffel with leather trim.", images: 3 },
  { name: "Polarized Aviator Sunglasses", slug: "polarized-aviator-sunglasses", category: "accessories", price: 12900, stock: 27, brand: "NEXORA Optics", blurb: "Lightweight metal aviators with polarized lenses." },
  { name: "Cashmere Beanie", slug: "cashmere-beanie", category: "accessories", price: 5900, stock: 42, brand: "NEXORA Atelier", blurb: "Fine-gauge cashmere beanie with a folded cuff." },
  { name: "Leather Card Holder", slug: "leather-card-holder", category: "accessories", price: 4500, stock: 73, brand: "NEXORA Studio", blurb: "Slim six-slot card holder in smooth leather." },
  { name: "Silk Pocket Square", slug: "silk-pocket-square", category: "accessories", price: 3900, stock: 5, brand: "NEXORA Atelier", blurb: "Printed silk square with hand-rolled edges." },

  { name: "Wireless Noise-Cancelling Headphones", slug: "wireless-noise-cancelling-headphones", category: "electronics", price: 29900, compareAtPrice: 34900, stock: 25, brand: "NEXORA Audio", blurb: "Over-ear headphones with adaptive ANC and 30h battery.", images: 3 },
  { name: "Smart Fitness Watch", slug: "smart-fitness-watch", category: "electronics", price: 24900, stock: 30, brand: "NEXORA Motion", blurb: "GPS fitness watch with sleep and recovery tracking.", variants: [{ name: "41mm", options: { size: "41mm" }, priceDelta: 0, stock: 16, suffix: "41" }, { name: "45mm", options: { size: "45mm" }, priceDelta: 3000, stock: 14, suffix: "45" }] },
  { name: "Portable Bluetooth Speaker", slug: "portable-bluetooth-speaker", category: "electronics", price: 12900, stock: 40, brand: "NEXORA Audio", blurb: "Water-resistant speaker with 360° sound." },
  { name: "Mechanical Keyboard", slug: "mechanical-keyboard", category: "electronics", price: 15900, stock: 22, brand: "NEXORA Desk", blurb: "Hot-swappable mechanical keyboard with PBT keycaps." },
  { name: "4K Action Camera", slug: "4k-action-camera", category: "electronics", price: 32900, compareAtPrice: 37900, stock: 11, brand: "NEXORA Optics", blurb: "Stabilized 4K capture in a waterproof body." },
  { name: "Wireless Charging Pad", slug: "wireless-charging-pad", category: "electronics", price: 4900, stock: 88, brand: "NEXORA Desk", blurb: "15W fast-charging pad with a soft-touch surface." },

  { name: "Ceramic Pour-Over Set", slug: "ceramic-pour-over-set", category: "home-living", price: 8900, stock: 26, brand: "NEXORA Home", blurb: "Hand-glazed dripper and carafe for slow mornings.", images: 3 },
  { name: "Linen Duvet Cover", slug: "linen-duvet-cover", category: "home-living", price: 18900, stock: 15, brand: "NEXORA Home", blurb: "Stonewashed linen duvet cover with coconut-shell buttons.", variants: [{ name: "Double", options: { size: "Double" }, priceDelta: 0, stock: 8, suffix: "double" }, { name: "King", options: { size: "King" }, priceDelta: 6000, stock: 7, suffix: "king" }] },
  { name: "Ambient Floor Lamp", slug: "ambient-floor-lamp", category: "home-living", price: 22900, stock: 9, brand: "NEXORA Home", blurb: "Dimmable floor lamp with a linen shade." },
  { name: "Scented Soy Candle", slug: "scented-soy-candle", category: "home-living", price: 3900, stock: 95, brand: "NEXORA Home", blurb: "Cedar and vetiver soy candle, 45-hour burn." },
  { name: "Oak Serving Board", slug: "oak-serving-board", category: "home-living", price: 6500, stock: 34, brand: "NEXORA Home", blurb: "Solid oak board with a food-safe oil finish." },
  { name: "Woven Throw Blanket", slug: "woven-throw-blanket", category: "home-living", price: 9900, compareAtPrice: 11900, stock: 23, brand: "NEXORA Home", blurb: "Cotton-blend throw with a herringbone weave." },

  { name: "Vitamin C Serum", slug: "vitamin-c-serum", category: "beauty", price: 5900, stock: 60, brand: "NEXORA Skin", blurb: "15% vitamin C serum for brighter-looking skin." },
  { name: "Hydrating Face Cream", slug: "hydrating-face-cream", category: "beauty", price: 4900, stock: 71, brand: "NEXORA Skin", blurb: "Ceramide-rich daily moisturizer for all skin types." },
  { name: "Eau de Parfum", slug: "eau-de-parfum", category: "beauty", price: 13900, stock: 28, brand: "NEXORA Scent", blurb: "Amber and bergamot fragrance with deep sillage.", variants: [{ name: "50ml", options: { size: "50ml" }, priceDelta: 0, stock: 18, suffix: "50" }, { name: "100ml", options: { size: "100ml" }, priceDelta: 7000, stock: 10, suffix: "100" }] },
  { name: "Restorative Hair Mask", slug: "restorative-hair-mask", category: "beauty", price: 4200, stock: 47, brand: "NEXORA Hair", blurb: "Weekly deep-conditioning mask for stressed hair." },
  { name: "Mineral Sunscreen SPF50", slug: "mineral-sunscreen-spf50", category: "beauty", price: 3500, stock: 4, brand: "NEXORA Skin", blurb: "Weightless mineral protection with no white cast." },

  { name: "Yoga Mat Pro", slug: "yoga-mat-pro", category: "sports-outdoors", price: 8900, stock: 36, brand: "NEXORA Motion", blurb: "6mm cushioned mat with a closed-cell surface." },
  { name: "Insulated Water Bottle", slug: "insulated-water-bottle", category: "sports-outdoors", price: 4500, stock: 82, brand: "NEXORA Motion", blurb: "Double-wall bottle keeping drinks cold for 24h." },
  { name: "Resistance Band Set", slug: "resistance-band-set", category: "sports-outdoors", price: 3900, stock: 55, brand: "NEXORA Motion", blurb: "Five latex bands from light to extra-heavy." },
  { name: "Trail Running Backpack", slug: "trail-running-backpack", category: "sports-outdoors", price: 12900, compareAtPrice: 14900, stock: 18, brand: "NEXORA Motion", blurb: "12L hydration vest with stretch-mesh pockets." },
  { name: "Compression Training Tights", slug: "compression-training-tights", category: "sports-outdoors", price: 8900, stock: 41, brand: "NEXORA Motion", blurb: "Four-way stretch tights with a secure waistband." },
  { name: "Camping Hammock", slug: "camping-hammock", category: "sports-outdoors", price: 7500, stock: 20, brand: "NEXORA Motion", blurb: "Ripstop hammock packing down to palm size." },

  { name: "Automatic Field Watch", slug: "automatic-field-watch", category: "watches", price: 42900, compareAtPrice: 49900, stock: 13, brand: "NEXORA Time", blurb: "38mm automatic field watch with a sapphire crystal.", images: 3, variants: [{ name: "Leather Strap", options: { strap: "Leather" }, priceDelta: 0, stock: 7, suffix: "leather" }, { name: "NATO Strap", options: { strap: "NATO" }, priceDelta: -2000, stock: 6, suffix: "nato" }] },
  { name: "Classic Dress Watch", slug: "classic-dress-watch", category: "watches", price: 35900, stock: 16, brand: "NEXORA Time", blurb: "Slim dress watch with a sunburst dial." },
  { name: "Chronograph Sport Watch", slug: "chronograph-sport-watch", category: "watches", price: 48900, stock: 10, brand: "NEXORA Time", blurb: "Steel chronograph with a tachymeter bezel." },
  { name: "Minimalist Mesh Watch", slug: "minimalist-mesh-watch", category: "watches", price: 27900, stock: 24, brand: "NEXORA Time", blurb: "Ultra-thin case on a woven mesh bracelet." },
  { name: "Diver Automatic Watch", slug: "diver-automatic-watch", category: "watches", price: 54900, stock: 0, brand: "NEXORA Time", blurb: "200m diver with a ceramic unidirectional bezel." },
  { name: "Solar Digital Watch", slug: "solar-digital-watch", category: "watches", price: 22900, stock: 19, brand: "NEXORA Time", blurb: "Solar-powered module with world time and alarms." },
];

const DEMO_USERS = [
  { id: "demo_admin", email: "admin@nexora.demo", name: "Demo Admin", role: "ADMIN" as const },
  { id: "demo_manager", email: "manager@nexora.demo", name: "Demo Manager", role: "MANAGER" as const },
  { id: "demo_customer", email: "customer@nexora.demo", name: "Demo Customer", role: "CUSTOMER" as const },
  { id: "demo_customer2", email: "customer2@nexora.demo", name: "Demo Customer II", role: "CUSTOMER" as const },
  { id: "demo_customer3", email: "customer3@nexora.demo", name: "Demo Customer III", role: "CUSTOMER" as const },
];

const COUPONS = [
  { id: "demo_demo10", code: "DEMO10", type: "PERCENT" as const, value: 10, minOrderAmount: 5000, maxDiscountAmount: 5000, startsAt: daysAgo(30), endsAt: daysFromNow(30), usageLimit: 100, usedCount: 1, active: true },
  { id: "demo_demo20off", code: "DEMO20OFF", type: "FIXED" as const, value: 2000, minOrderAmount: 10000, maxDiscountAmount: 3000, startsAt: daysAgo(30), endsAt: daysFromNow(30), usageLimit: 50, usedCount: 0, active: true },
  { id: "demo_welcome15", code: "WELCOME15", type: "PERCENT" as const, value: 15, minOrderAmount: 0, maxDiscountAmount: 5000, startsAt: daysAgo(60), endsAt: daysAgo(1), usageLimit: null, usedCount: 0, active: true },
  { id: "demo_flash25", code: "FLASH25", type: "PERCENT" as const, value: 25, minOrderAmount: 0, maxDiscountAmount: null, startsAt: daysAgo(10), endsAt: daysFromNow(10), usageLimit: 10, usedCount: 0, active: false },
];

type ItemSpec = { slug: string; quantity: number };
type OrderSpec = {
  orderNumber: string;
  userId: string;
  status: "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  paymentStatus: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  shippingMethod: string;
  items: ItemSpec[];
  daysBack: number;
  couponCode?: string;
  paymentIntentId?: string;
};

function orderSpecs(users: Record<string, string>): OrderSpec[] {
  return [
    { orderNumber: "NX-DEMO-0001", userId: users["customer@nexora.demo"], status: "DELIVERED", paymentStatus: "SUCCEEDED", shippingMethod: "standard", items: [{ slug: "essential-crewneck-tee", quantity: 2 }, { slug: "tailored-slim-chinos", quantity: 1 }], daysBack: 34, paymentIntentId: "pi_demo_0001" },
    { orderNumber: "NX-DEMO-0002", userId: users["customer2@nexora.demo"], status: "SHIPPED", paymentStatus: "SUCCEEDED", shippingMethod: "express", items: [{ slug: "performance-running-shoes", quantity: 1 }], daysBack: 6, paymentIntentId: "pi_demo_0002" },
    { orderNumber: "NX-DEMO-0003", userId: users["customer@nexora.demo"], status: "PAID", paymentStatus: "SUCCEEDED", shippingMethod: "standard", items: [{ slug: "wireless-noise-cancelling-headphones", quantity: 1 }, { slug: "wireless-charging-pad", quantity: 2 }], daysBack: 3, couponCode: "DEMO10", paymentIntentId: "pi_demo_0003" },
    { orderNumber: "NX-DEMO-0004", userId: users["customer3@nexora.demo"], status: "PROCESSING", paymentStatus: "SUCCEEDED", shippingMethod: "standard", items: [{ slug: "ceramic-pour-over-set", quantity: 1 }, { slug: "scented-soy-candle", quantity: 3 }, { slug: "linen-resort-shirt", quantity: 8 }], daysBack: 2, paymentIntentId: "pi_demo_0004" },
    { orderNumber: "NX-DEMO-0005", userId: users["customer2@nexora.demo"], status: "PENDING", paymentStatus: "PENDING", shippingMethod: "standard", items: [{ slug: "cashmere-blend-sweater", quantity: 1 }], daysBack: 0 },
    { orderNumber: "NX-DEMO-0006", userId: users["customer3@nexora.demo"], status: "CANCELLED", paymentStatus: "REFUNDED", shippingMethod: "standard", items: [{ slug: "4k-action-camera", quantity: 1 }], daysBack: 12, paymentIntentId: "pi_demo_0006" },
  ];
}

const productBySlug = new Map<string, string>();

function productIdFor(slug: string): string {
  const id = productBySlug.get(slug);
  if (!id) throw new Error(`Product not seeded: ${slug}`);
  return id;
}

async function wipe(): Promise<void> {
  await prisma.webhookEvent.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.couponUsage.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.address.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

function soldByProduct(users: Record<string, string>): Map<string, number> {
  const sold = new Map<string, number>();
  for (const spec of orderSpecs(users)) {
    if (spec.paymentStatus !== "SUCCEEDED") continue;
    for (const item of spec.items) {
      sold.set(item.slug, (sold.get(item.slug) ?? 0) + item.quantity);
    }
  }
  return sold;
}

async function main(): Promise<void> {
  console.log("Seeding NEXORA demo data...");

  await wipe();

  const categoryBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({
      data: { name: category.name, slug: category.slug, description: category.description, position: category.position },
    });
    categoryBySlug.set(category.slug, created.id);
  }

  const users: Record<string, string> = {};
  for (const seed of DEMO_USERS) {
    const user = await prisma.user.create({
      data: { id: seed.id, email: seed.email, name: seed.name, role: seed.role, emailVerified: true },
    });
    users[seed.email] = user.id;
  }

  // Credential accounts so demo users can sign in with email/password (better-auth).
  // NOTE: accountId must equal the user id (better-auth sign-in lookup rule).
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const seed of DEMO_USERS) {
    await prisma.account.create({
      data: {
        id: `demo_account_${seed.id}`,
        userId: users[seed.email],
        providerId: "credential",
        accountId: users[seed.email],
        password: passwordHash,
      },
    });
  }

  const sold = soldByProduct(users);
  const initialStock = new Map<string, number>();

  let productCount = 0;
  for (const seed of PRODUCTS) {
    const categoryId = categoryBySlug.get(seed.category);
    if (!categoryId) throw new Error(`Unknown category: ${seed.category}`);

    const soldQty = sold.get(seed.slug) ?? 0;
    const seedStock = seed.stock + soldQty;
    initialStock.set(seed.slug, seedStock);

    const imageCount = seed.images ?? 2;
    const product = await prisma.product.create({
      data: {
        name: seed.name,
        slug: seed.slug,
        description: `${seed.blurb} Demo catalog product for the NEXORA platform.`,
        price: seed.price,
        compareAtPrice: seed.compareAtPrice ?? null,
        sku: slugToDemoSku(seed.slug),
        stock: seedStock,
        brand: seed.brand ?? null,
        status: "ACTIVE",
        categoryId,
        images: {
          create: Array.from({ length: imageCount }, (_, i) => ({
            url: IMG(seed.slug, i + 1),
            alt: `${seed.name} — demo image ${i + 1}`,
            position: i,
          })),
        },
        variants: seed.variants
          ? {
              create: seed.variants.map((variant) => ({
                name: variant.name,
                options: variant.options,
                sku: `${slugToDemoSku(seed.slug)}-${variant.suffix.toUpperCase()}`,
                priceDelta: variant.priceDelta,
                stock: variant.stock,
              })),
            }
          : undefined,
      },
      include: { variants: true },
    });
    productBySlug.set(seed.slug, product.id);
    productCount++;

    await prisma.inventoryTransaction.create({
      data: { productId: product.id, delta: seedStock, reason: "SEED", balanceAfter: seedStock, note: "Initial demo stock" },
    });
    for (const variant of product.variants) {
      await prisma.inventoryTransaction.create({
        data: { productId: product.id, variantId: variant.id, delta: variant.stock, reason: "SEED", balanceAfter: variant.stock, note: "Initial demo variant stock" },
      });
    }
  }

  await prisma.address.create({
    data: {
      userId: users["customer@nexora.demo"],
      label: "Home",
      fullName: "Demo Customer",
      line1: "12 Demo Street",
      line2: "Apt 4B",
      city: "Cairo",
      region: "Cairo Governorate",
      postalCode: "11511",
      country: "EG",
      phone: "+201000000000",
      isDefault: true,
    },
  });

  await prisma.wishlist.create({
    data: {
      userId: users["customer@nexora.demo"],
      items: {
        create: [
          { productId: productIdFor("midnight-wool-overcoat") },
          { productId: productIdFor("automatic-field-watch") },
          { productId: productIdFor("wireless-noise-cancelling-headphones") },
        ],
      },
    },
  });

  for (const coupon of COUPONS) {
    await prisma.coupon.create({ data: coupon });
  }

  await seedOrders(users, initialStock);
  await seedReviews(users);

  const inventoryCount = await prisma.inventoryTransaction.count();
  const orderCount = await prisma.order.count();
  const reviewCount = await prisma.review.count();

  console.log(
    `Seeded: ${CATEGORIES.length} categories, ${productCount} products, ${DEMO_USERS.length} demo users, ` +
      `${COUPONS.length} coupons, ${orderCount} orders, ${reviewCount} reviews, ${inventoryCount} inventory records.`,
  );
  console.log(`Demo sign-in: admin@nexora.demo | manager@nexora.demo | customer@nexora.demo — password: ${DEMO_PASSWORD}`);
}

async function seedOrders(users: Record<string, string>, initialStock: Map<string, number>): Promise<void> {
  const addressSnapshot = {
    fullName: "Demo Customer",
    line1: "12 Demo Street",
    line2: "Apt 4B",
    city: "Cairo",
    region: "Cairo Governorate",
    postalCode: "11511",
    country: "EG",
    phone: "+201000000000",
  };

  const runningBalance = new Map(initialStock);

  for (const spec of orderSpecs(users)) {
    const placedAt = spec.daysBack === 0 ? new Date() : daysAgo(spec.daysBack);

    const items: { slug: string; name: string; sku: string; unitPrice: number; quantity: number; lineTotal: number; productId: string }[] = [];
    for (const item of spec.items) {
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productIdFor(item.slug) } });
      items.push({
        slug: item.slug,
        name: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: item.quantity,
        lineTotal: product.price * item.quantity,
        productId: product.id,
      });
    }

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const shipping = spec.shippingMethod === "express" ? 1299 : subtotal >= 10000 ? 0 : 599;
    let discount = 0;
    if (spec.couponCode === "DEMO10") discount = Math.min(Math.floor((subtotal * 10) / 100), 5000);
    const total = subtotal - discount + shipping;

    const order = await prisma.order.create({
      data: {
        orderNumber: spec.orderNumber,
        userId: spec.userId,
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        subtotal,
        discount,
        shipping,
        total,
        shippingMethod: spec.shippingMethod,
        address: addressSnapshot,
        couponCode: spec.couponCode ?? null,
        placedAt,
        paidAt: spec.paymentStatus === "SUCCEEDED" || spec.paymentStatus === "REFUNDED" ? placedAt : null,
        shippedAt: spec.status === "SHIPPED" || spec.status === "DELIVERED" ? daysAgo(Math.max(0, spec.daysBack - 2)) : null,
        deliveredAt: spec.status === "DELIVERED" ? daysAgo(Math.max(0, spec.daysBack - 4)) : null,
        cancelledAt: spec.status === "CANCELLED" ? daysAgo(Math.max(0, spec.daysBack - 1)) : null,
        items: {
          create: items.map((item) => ({
            name: item.name,
            sku: item.sku,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            productId: item.productId,
          })),
        },
        payment: spec.paymentIntentId
          ? {
              create: {
                stripePaymentIntentId: spec.paymentIntentId,
                amount: total,
                currency: "usd",
                status: spec.paymentStatus,
              },
            }
          : undefined,
      },
    });

    if (spec.couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: spec.couponCode } });
      if (coupon) {
        await prisma.couponUsage.create({
          data: { couponId: coupon.id, userId: spec.userId, orderId: order.id, usedAt: placedAt },
        });
      }
    }

    if (spec.paymentStatus === "SUCCEEDED") {
      for (const item of items) {
        const balance = (runningBalance.get(item.slug) ?? 0) - item.quantity;
        await prisma.inventoryTransaction.create({
          data: {
            productId: item.productId,
            delta: -item.quantity,
            reason: "PURCHASE",
            balanceAfter: balance,
            note: `Order ${spec.orderNumber}`,
            createdAt: placedAt,
          },
        });
        await prisma.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        runningBalance.set(item.slug, balance);
      }
    }
  }
}

function slugToDemoSku(slug: string): string {
  return `DEMO-${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
}

async function seedReviews(users: Record<string, string>): Promise<void> {
  type ReviewSpec = { slug: string; email: string; rating: number; comment: string; status: "APPROVED" | "PENDING" | "HIDDEN"; verified: boolean; daysBack: number };
  const specs: ReviewSpec[] = [
    { slug: "essential-crewneck-tee", email: "customer@nexora.demo", rating: 5, comment: "Perfect fit and the cotton feels premium.", status: "APPROVED", verified: true, daysBack: 30 },
    { slug: "essential-crewneck-tee", email: "customer2@nexora.demo", rating: 4, comment: "Great quality, runs slightly long.", status: "APPROVED", verified: false, daysBack: 21 },
    { slug: "classic-leather-sneakers", email: "customer2@nexora.demo", rating: 5, comment: "Comfortable out of the box.", status: "APPROVED", verified: true, daysBack: 5 },
    { slug: "classic-leather-sneakers", email: "customer3@nexora.demo", rating: 4, comment: "Clean design, sizing is true.", status: "APPROVED", verified: false, daysBack: 14 },
    { slug: "wireless-noise-cancelling-headphones", email: "customer@nexora.demo", rating: 5, comment: "ANC is excellent on flights.", status: "APPROVED", verified: true, daysBack: 2 },
    { slug: "midnight-wool-overcoat", email: "customer3@nexora.demo", rating: 5, comment: "Tailoring is spot on for the price.", status: "APPROVED", verified: false, daysBack: 18 },
    { slug: "midnight-wool-overcoat", email: "customer2@nexora.demo", rating: 4, comment: "Warm, but the sleeves run wide.", status: "PENDING", verified: false, daysBack: 1 },
    { slug: "ceramic-pour-over-set", email: "customer3@nexora.demo", rating: 5, comment: "Pours evenly and looks beautiful.", status: "APPROVED", verified: true, daysBack: 1 },
    { slug: "scented-soy-candle", email: "customer@nexora.demo", rating: 4, comment: "Cedar scent is subtle and classy.", status: "APPROVED", verified: false, daysBack: 9 },
    { slug: "tailored-slim-chinos", email: "customer@nexora.demo", rating: 4, comment: "Stretch fabric is a nice touch.", status: "APPROVED", verified: true, daysBack: 28 },
    { slug: "smart-fitness-watch", email: "customer2@nexora.demo", rating: 3, comment: "Battery could last longer.", status: "APPROVED", verified: false, daysBack: 11 },
    { slug: "automatic-field-watch", email: "customer3@nexora.demo", rating: 5, comment: "Dial finishing punches above its weight.", status: "APPROVED", verified: false, daysBack: 7 },
    { slug: "cashmere-beanie", email: "customer2@nexora.demo", rating: 1, comment: "Spam review hidden by moderation demo.", status: "HIDDEN", verified: false, daysBack: 4 },
    { slug: "trail-running-backpack", email: "customer3@nexora.demo", rating: 4, comment: "Secure fit while running uphill.", status: "APPROVED", verified: false, daysBack: 3 },
    { slug: "hydrating-face-cream", email: "customer@nexora.demo", rating: 5, comment: "Non-greasy and absorbs quickly.", status: "PENDING", verified: false, daysBack: 0 },
  ];

  for (const spec of specs) {
    await prisma.review.create({
      data: {
        productId: productIdFor(spec.slug),
        userId: users[spec.email],
        rating: spec.rating,
        comment: spec.comment,
        status: spec.status,
        verifiedPurchase: spec.verified,
        createdAt: daysAgo(spec.daysBack),
      },
    });
  }

  const approved = await prisma.review.groupBy({ by: ["productId"], where: { status: "APPROVED" }, _avg: { rating: true }, _count: true });
  for (const group of approved) {
    await prisma.product.update({
      where: { id: group.productId },
      data: { ratingAvg: group._avg.rating ?? 0, ratingCount: group._count },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete.");
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
