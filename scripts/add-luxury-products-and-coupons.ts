import { prisma } from "../lib/db";

async function main() {
  console.log("=== EXPANDING NEXORA LUXURY CATALOG & PRIVILEGE COUPONS ===");

  // 1. Ensure Luxury Coupons
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const coupons = [
    {
      code: "NEXORA10",
      type: "PERCENT" as const,
      value: 10,
      minOrderAmount: 5000,
      maxDiscountAmount: 10000,
      startsAt: thirtyDaysAgo,
      endsAt: oneYearFromNow,
      usageLimit: 1000,
      active: true,
    },
    {
      code: "ATELIER20",
      type: "FIXED" as const,
      value: 2000,
      minOrderAmount: 10000,
      maxDiscountAmount: 2000,
      startsAt: thirtyDaysAgo,
      endsAt: oneYearFromNow,
      usageLimit: 500,
      active: true,
    },
    {
      code: "VIP25",
      type: "PERCENT" as const,
      value: 25,
      minOrderAmount: 15000,
      maxDiscountAmount: 15000,
      startsAt: thirtyDaysAgo,
      endsAt: oneYearFromNow,
      usageLimit: 250,
      active: true,
    },
  ];

  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {
        type: c.type,
        value: c.value,
        minOrderAmount: c.minOrderAmount,
        maxDiscountAmount: c.maxDiscountAmount,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        active: c.active,
      },
      create: c,
    });
    console.log(`✓ Privilege Coupon ${c.code} is active`);
  }

  // 2. Fetch categories
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((cat) => [cat.slug, cat.id]));

  const newProducts = [
    {
      slug: "italian-silk-linen-blazer",
      name: "Italian Silk-Linen Blazer",
      categorySlug: "apparel",
      price: 34000,
      compareAtPrice: 39500,
      sku: "NX-APP-BLAZER-01",
      stock: 24,
      brand: "NEXORA Atelier",
      blurb:
        "Hand-finished unconstructed blazer in breathable Italian silk-linen with natural horn buttons and patch pockets.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&q=85",
          alt: "Italian Silk-Linen Blazer Front View",
        },
        {
          url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200&q=85",
          alt: "Italian Silk-Linen Blazer Texture Detail",
        },
      ],
    },
    {
      slug: "milano-double-monk-straps",
      name: "Milano Double Monk Strap Shoes",
      categorySlug: "footwear",
      price: 24900,
      compareAtPrice: 28900,
      sku: "NX-FTW-MONK-01",
      stock: 18,
      brand: "NEXORA Studio",
      blurb:
        "Hand-burnished calfskin dress shoes with dual brushed-brass buckles on a Goodyear-welted channeled leather sole.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=1200&q=85",
          alt: "Milano Double Monk Strap Shoes",
        },
        {
          url: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=1200&q=85",
          alt: "Milano Double Monk Straps Side Angle",
        },
      ],
    },
    {
      slug: "heritage-leather-briefcase",
      name: "Heritage Leather Briefcase",
      categorySlug: "accessories",
      price: 29000,
      compareAtPrice: 34000,
      sku: "NX-ACC-CASE-01",
      stock: 15,
      brand: "NEXORA Studio",
      blurb:
        "Architectural briefcase crafted in English bridle leather with solid brass lock and dedicated suede-lined laptop chamber.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&q=85",
          alt: "Heritage Leather Briefcase Studio Shot",
        },
        {
          url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=85",
          alt: "Heritage Leather Briefcase Interior View",
        },
      ],
    },
    {
      slug: "audiophile-valve-tube-dac",
      name: "Audiophile Valve Tube Headphone DAC",
      categorySlug: "electronics",
      price: 38000,
      compareAtPrice: 44000,
      sku: "NX-ELE-DAC-01",
      stock: 12,
      brand: "NEXORA Audio",
      blurb:
        "High-resolution 32-bit vacuum-tube digital-to-analog converter and Class-A balanced headphone amplifier encased in CNC-milled aluminum.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=1200&q=85",
          alt: "Audiophile Valve Tube Headphone DAC Front",
        },
        {
          url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=85",
          alt: "Audiophile Valve Tube Headphone DAC Lifestyle",
        },
      ],
    },
    {
      slug: "hand-blown-crystal-decanter-set",
      name: "Hand-Blown Crystal Decanter Set",
      categorySlug: "home-living",
      price: 17500,
      compareAtPrice: 21000,
      sku: "NX-HOM-DECANTER-01",
      stock: 22,
      brand: "NEXORA Home",
      blurb:
        "Lead-free mouth-blown crystal decanter with dual matching geometric tumblers, designed for optimal spirit aeration and tactile elegance.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=85",
          alt: "Hand-Blown Crystal Decanter Set",
        },
        {
          url: "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=1200&q=85",
          alt: "Hand-Blown Crystal Tumbler Glass",
        },
      ],
    },
    {
      slug: "oud-sublime-extrait-de-parfum",
      name: "Oud Sublime Extrait de Parfum",
      categorySlug: "beauty",
      price: 22000,
      compareAtPrice: 26000,
      sku: "NX-BTY-OUD-01",
      stock: 30,
      brand: "NEXORA Scent",
      blurb:
        "Rare Cambodian wild agarwood and Taif rose concentrated extrait with saffron, ambergris, and smoky royal frankincense.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1200&q=85",
          alt: "Oud Sublime Extrait de Parfum Flacon",
        },
        {
          url: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=1200&q=85",
          alt: "Oud Sublime Perfume Sillage Presentation",
        },
      ],
    },
    {
      slug: "titanium-aerodynamic-road-helmet",
      name: "Titanium Aerodynamic Road Helmet",
      categorySlug: "sports-outdoors",
      price: 19500,
      compareAtPrice: 23000,
      sku: "NX-SPT-HELMET-01",
      stock: 28,
      brand: "NEXORA Motion",
      blurb:
        "Wind-tunnel sculpted road cycling helmet with multi-density EPS foam, titanium retention accents, and MIPS rotational impact protection.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=1200&q=85",
          alt: "Titanium Aerodynamic Road Helmet Front",
        },
        {
          url: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&q=85",
          alt: "Titanium Aerodynamic Road Helmet Profile",
        },
      ],
    },
    {
      slug: "geneva-moonphase-automatic-watch",
      name: "Geneva Moonphase Automatic Watch",
      categorySlug: "watches",
      price: 62000,
      compareAtPrice: 72000,
      sku: "NX-WAT-MOON-01",
      stock: 10,
      brand: "NEXORA Time",
      blurb:
        "Swiss-regulated 28,800 vph automatic caliber with true astronomical moonphase complication, blue aventurine dial, and sapphire exhibition back.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=85",
          alt: "Geneva Moonphase Automatic Watch Dial",
        },
        {
          url: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=1200&q=85",
          alt: "Geneva Moonphase Automatic Watch Caseback",
        },
      ],
    },
  ];

  for (const p of newProducts) {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) {
      console.warn(`Category ${p.categorySlug} not found, skipping ${p.slug}`);
      continue;
    }

    const createdProduct = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        brand: p.brand,
        stock: p.stock,
        description: p.blurb,
        status: "ACTIVE",
        categoryId,
      },
      create: {
        slug: p.slug,
        name: p.name,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        sku: p.sku,
        stock: p.stock,
        brand: p.brand,
        description: p.blurb,
        status: "ACTIVE",
        categoryId,
        ratingAvg: 4.9,
        ratingCount: 18,
      },
    });

    // Add images
    for (let i = 0; i < p.images.length; i++) {
      const img = p.images[i];
      const existing = await prisma.productImage.findFirst({
        where: { productId: createdProduct.id, position: i },
      });
      if (!existing) {
        await prisma.productImage.create({
          data: {
            productId: createdProduct.id,
            url: img.url,
            alt: img.alt,
            position: i,
          },
        });
      } else {
        await prisma.productImage.update({
          where: { id: existing.id },
          data: { url: img.url, alt: img.alt },
        });
      }
    }

    console.log(`✓ Product added/updated: ${p.name} ($${(p.price / 100).toFixed(2)})`);
  }

  console.log("=== CATALOG EXPANSION COMPLETED SUCCESSFULLY ===");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  });
