import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../lib/db";

const outputDir = path.resolve(process.cwd(), "public/images/products");
fs.mkdirSync(outputDir, { recursive: true });

type ProductPhotoMapping = {
  slug: string;
  name: string;
  category: string;
  photos: string[];
};

const PRODUCT_PHOTOS: ProductPhotoMapping[] = [
  // Apparel
  {
    slug: "midnight-wool-overcoat",
    name: "Midnight Wool Overcoat",
    category: "Apparel",
    photos: [
      "photo-1544923246-77307dd654cb",
      "photo-1539571696357-5a69c17a67c6",
      "photo-1591047139829-d91aecb6caea",
    ],
  },
  {
    slug: "essential-crewneck-tee",
    name: "Essential Crewneck Tee",
    category: "Apparel",
    photos: [
      "photo-1521572267360-ee0c2909d518",
      "photo-1583743814966-8936f5b7be1a",
    ],
  },
  {
    slug: "tailored-slim-chinos",
    name: "Tailored Slim Chinos",
    category: "Apparel",
    photos: [
      "photo-1624378439575-d8705ad7ae80",
      "photo-1473966968600-fa801b869a1a",
    ],
  },
  {
    slug: "merino-zip-hoodie",
    name: "Merino Zip Hoodie",
    category: "Apparel",
    photos: [
      "photo-1556905055-8f358a7a47b2",
      "photo-1509967419530-da38b4704bc6",
    ],
  },
  {
    slug: "linen-resort-shirt",
    name: "Linen Resort Shirt",
    category: "Apparel",
    photos: [
      "photo-1596755094514-f87e34085b2c",
      "photo-1602810318383-e386cc2a3ccf",
    ],
  },
  {
    slug: "cashmere-blend-sweater",
    name: "Cashmere Blend Sweater",
    category: "Apparel",
    photos: [
      "photo-1576871337632-b9aef4c17ab9",
      "photo-1620799140408-edc6dcb6d633",
    ],
  },
  {
    slug: "everyday-oxford-shirt",
    name: "Everyday Oxford Shirt",
    category: "Apparel",
    photos: [
      "photo-1603252109303-2751441dd157",
      "photo-1598033129183-c4f50c736f10",
    ],
  },

  // Footwear
  {
    slug: "classic-leather-sneakers",
    name: "Classic Leather Sneakers",
    category: "Footwear",
    photos: [
      "photo-1549298916-b41d501d3772",
      "photo-1595950653106-6c9ebd614d3a",
      "photo-1560769629-975ec94e6a86",
    ],
  },
  {
    slug: "suede-chelsea-boots",
    name: "Suede Chelsea Boots",
    category: "Footwear",
    photos: [
      "photo-1638247025967-b4e38f787b76",
      "photo-1520639888713-7851133b1ed0",
    ],
  },
  {
    slug: "performance-running-shoes",
    name: "Performance Running Shoes",
    category: "Footwear",
    photos: [
      "photo-1542291026-7eec264c27ff",
      "photo-1608231387042-66d1773070a5",
    ],
  },
  {
    slug: "heritage-loafers",
    name: "Heritage Loafers",
    category: "Footwear",
    photos: [
      "photo-1533867617858-e7b97e060509",
      "photo-1614252235316-8c857d38b5f4",
    ],
  },
  {
    slug: "trail-hiking-boots",
    name: "Trail Hiking Boots",
    category: "Footwear",
    photos: [
      "photo-1520639888713-7851133b1ed0",
      "photo-1608231387042-66d1773070a5",
    ],
  },
  {
    slug: "minimalist-slip-ons",
    name: "Minimalist Slip-Ons",
    category: "Footwear",
    photos: [
      "photo-1562183241-b937e95585b6",
      "photo-1525966222134-fcfa99b8ae77",
    ],
  },

  // Accessories
  {
    slug: "full-grain-leather-belt",
    name: "Full-Grain Leather Belt",
    category: "Accessories",
    photos: [
      "photo-1624222247344-550fb60583dc",
      "photo-1553062407-98eeb64c6a62",
    ],
  },
  {
    slug: "canvas-weekender-bag",
    name: "Canvas Weekender Bag",
    category: "Accessories",
    photos: [
      "photo-1553062407-98eeb64c6a62",
      "photo-1548036328-c9fa89d128fa",
      "photo-1578632767115-351597cf2477",
    ],
  },
  {
    slug: "polarized-aviator-sunglasses",
    name: "Polarized Aviator Sunglasses",
    category: "Accessories",
    photos: [
      "photo-1511499767150-a48a237f0083",
      "photo-1572635196237-14b3f281503f",
    ],
  },
  {
    slug: "cashmere-beanie",
    name: "Cashmere Beanie",
    category: "Accessories",
    photos: [
      "photo-1576871337622-98d48d1cf531",
      "photo-1618354691373-d851c5c3a990",
    ],
  },
  {
    slug: "leather-card-holder",
    name: "Leather Card Holder",
    category: "Accessories",
    photos: [
      "photo-1627123424574-724758594e93",
      "photo-1606503153255-59d8b8b82176",
    ],
  },
  {
    slug: "silk-pocket-square",
    name: "Silk Pocket Square",
    category: "Accessories",
    photos: [
      "photo-1601924994987-69e26d50dc26",
      "photo-1584917865442-de89df76afd3",
    ],
  },

  // Electronics
  {
    slug: "wireless-noise-cancelling-headphones",
    name: "Noise-Cancelling Headphones",
    category: "Electronics",
    photos: [
      "photo-1505740420928-5e560c06d30e",
      "photo-1583394838336-acd977736f90",
      "photo-1484704849700-f032a568e944",
    ],
  },
  {
    slug: "smart-fitness-watch",
    name: "Smart Fitness Watch",
    category: "Electronics",
    photos: [
      "photo-1523275335684-37898b6baf30",
      "photo-1508685096489-7aacd43bd3b1",
    ],
  },
  {
    slug: "portable-bluetooth-speaker",
    name: "Portable Bluetooth Speaker",
    category: "Electronics",
    photos: [
      "photo-1608043152269-423dbba4e7e1",
      "photo-1545454675-3531b543be5d",
    ],
  },
  {
    slug: "mechanical-keyboard",
    name: "Mechanical Keyboard",
    category: "Electronics",
    photos: [
      "photo-1587829741301-dc798b83add3",
      "photo-1618384887929-16ec33fab9ef",
    ],
  },
  {
    slug: "4k-action-camera",
    name: "4K Action Camera",
    category: "Electronics",
    photos: [
      "photo-1526170375885-4d8ecf77b99f",
      "photo-1516035069371-29a1b244cc32",
    ],
  },
  {
    slug: "wireless-charging-pad",
    name: "Wireless Charging Pad",
    category: "Electronics",
    photos: [
      "photo-1586953208448-b95a79798f07",
      "photo-1615526675159-e248c3021d3f",
    ],
  },

  // Home & Living
  {
    slug: "ceramic-pour-over-set",
    name: "Ceramic Pour-Over Set",
    category: "Home & Living",
    photos: [
      "photo-1514432324607-a09d9b4aefdd",
      "photo-1544787219-7f47ccb76574",
      "photo-1495474472287-4d71bcdd2085",
    ],
  },
  {
    slug: "linen-duvet-cover",
    name: "Linen Duvet Cover",
    category: "Home & Living",
    photos: [
      "photo-1522771739844-6a9f6d5f14af",
      "photo-1584100936595-c0654b55a2e2",
    ],
  },
  {
    slug: "ambient-floor-lamp",
    name: "Ambient Floor Lamp",
    category: "Home & Living",
    photos: [
      "photo-1507473885765-e6ed057f782c",
      "photo-1513506003901-1e6a229e2d15",
    ],
  },
  {
    slug: "scented-soy-candle",
    name: "Scented Soy Candle",
    category: "Home & Living",
    photos: [
      "photo-1603006905003-be475563bc59",
      "photo-1602874801007-bd458bb1b8b6",
    ],
  },
  {
    slug: "oak-serving-board",
    name: "Oak Serving Board",
    category: "Home & Living",
    photos: [
      "photo-1590794056226-79ef3a8147e1",
      "photo-1584992236310-6edddc08acff",
    ],
  },
  {
    slug: "woven-throw-blanket",
    name: "Woven Throw Blanket",
    category: "Home & Living",
    photos: [
      "photo-1580301762395-21ce84d00bc6",
      "photo-1579656381226-5fc0f0100c3b",
    ],
  },

  // Beauty
  {
    slug: "vitamin-c-serum",
    name: "Vitamin C Serum",
    category: "Beauty",
    photos: [
      "photo-1620916566398-39f1143ab7be",
      "photo-1601049541289-9b1b7bbbfe19",
    ],
  },
  {
    slug: "hydrating-face-cream",
    name: "Hydrating Face Cream",
    category: "Beauty",
    photos: [
      "photo-1556228720-195a672e8a03",
      "photo-1571781926291-c477ebfd024b",
    ],
  },
  {
    slug: "eau-de-parfum",
    name: "Eau de Parfum",
    category: "Beauty",
    photos: [
      "photo-1592945403244-b3fbafd7f539",
      "photo-1547887537-6158d64c35b3",
    ],
  },
  {
    slug: "restorative-hair-mask",
    name: "Restorative Hair Mask",
    category: "Beauty",
    photos: [
      "photo-1522337360788-8b13dee7a37e",
      "photo-1535585209827-a15fcdbc4c2d",
    ],
  },
  {
    slug: "mineral-sunscreen-spf50",
    name: "Mineral Sunscreen SPF50",
    category: "Beauty",
    photos: [
      "photo-1598440947619-2c35fc9aa908",
      "photo-1570172619644-dfd03ed5d881",
    ],
  },

  // Sports & Outdoors
  {
    slug: "yoga-mat-pro",
    name: "Yoga Mat Pro",
    category: "Sports & Outdoors",
    photos: [
      "photo-1601925260368-ae2f83cf8b7f",
      "photo-1592432678016-e910b452f9a2",
    ],
  },
  {
    slug: "insulated-water-bottle",
    name: "Insulated Water Bottle",
    category: "Sports & Outdoors",
    photos: [
      "photo-1602143407151-7111542de6e8",
      "photo-1589365278144-c9e705f843ba",
    ],
  },
  {
    slug: "resistance-band-set",
    name: "Resistance Band Set",
    category: "Sports & Outdoors",
    photos: [
      "photo-1598289431512-b97b0917affc",
      "photo-1517838277536-f5f99be501cd",
    ],
  },
  {
    slug: "trail-running-backpack",
    name: "Trail Running Backpack",
    category: "Sports & Outdoors",
    photos: [
      "photo-1553062407-98eeb64c6a62",
      "photo-1622560480605-d83c853bc5c3",
    ],
  },
  {
    slug: "compression-training-tights",
    name: "Compression Training Tights",
    category: "Sports & Outdoors",
    photos: [
      "photo-1506152983158-b4a74a01c721",
      "photo-1518611012118-696072aa579a",
    ],
  },
  {
    slug: "camping-hammock",
    name: "Camping Hammock",
    category: "Sports & Outdoors",
    photos: [
      "photo-1510312305653-8ed496efae75",
      "photo-1504280390367-361c6d9f38f4",
    ],
  },

  // Watches
  {
    slug: "automatic-field-watch",
    name: "Automatic Field Watch",
    category: "Watches",
    photos: [
      "photo-1524805444758-089113d48a6d",
      "photo-1522335789203-aabd1fc54bc9",
      "photo-1533139502658-0198f920d8e8",
    ],
  },
  {
    slug: "classic-dress-watch",
    name: "Classic Dress Watch",
    category: "Watches",
    photos: [
      "photo-1509042239860-f550ce710b93",
      "photo-1523275335684-37898b6baf30",
    ],
  },
  {
    slug: "chronograph-sport-watch",
    name: "Chronograph Sport Watch",
    category: "Watches",
    photos: [
      "photo-1548036328-c9fa89d128fa",
      "photo-1524805444758-089113d48a6d",
    ],
  },
  {
    slug: "minimalist-mesh-watch",
    name: "Minimalist Mesh Watch",
    category: "Watches",
    photos: [
      "photo-1522335789203-aabd1fc54bc9",
      "photo-1509042239860-f550ce710b93",
    ],
  },
  {
    slug: "diver-automatic-watch",
    name: "Diver Automatic Watch",
    category: "Watches",
    photos: [
      "photo-1533139502658-0198f920d8e8",
      "photo-1524805444758-089113d48a6d",
    ],
  },
  {
    slug: "solar-digital-watch",
    name: "Solar Digital Watch",
    category: "Watches",
    photos: [
      "photo-1508685096489-7aacd43bd3b1",
      "photo-1523275335684-37898b6baf30",
    ],
  },
];

const PLACEHOLDER_PHOTO = "photo-1513519245088-0e12902e5a38";

async function fetchAndSavePhoto(photoId: string, destPath: string): Promise<boolean> {
  const url = `https://images.unsplash.com/${photoId}?w=800&h=800&fit=crop&q=85`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`Failed to fetch photo ${photoId}: ${res.status}`);
      return false;
    }
    const arrayBuf = await res.arrayBuffer();
    const webpBuffer = await sharp(Buffer.from(arrayBuf))
      .resize(800, 800, { fit: "cover", position: "center" })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    fs.writeFileSync(destPath, webpBuffer);
    return true;
  } catch (err) {
    console.warn(`Error downloading ${photoId}:`, (err as Error).message);
    return false;
  }
}

async function main() {
  console.log("Downloading real authentic high-end studio photographs for NEXORA catalog...");
  let count = 0;

  // Placeholder
  const placeholderPath = path.join(outputDir, "placeholder.webp");
  const placeholderOk = await fetchAndSavePhoto(PLACEHOLDER_PHOTO, placeholderPath);
  if (placeholderOk) {
    count++;
    console.log("✓ Saved placeholder.webp");
  }

  for (const product of PRODUCT_PHOTOS) {
    for (let i = 0; i < product.photos.length; i++) {
      const photoId = product.photos[i];
      const filename = `${product.slug}-${i + 1}.webp`;
      const destPath = path.join(outputDir, filename);

      const ok = await fetchAndSavePhoto(photoId, destPath);
      if (ok) {
        count++;
        process.stdout.write(`✓ [${product.category}] ${filename}\n`);
      } else {
        process.stderr.write(`✗ Failed ${filename}\n`);
      }
    }
  }

  console.log(`\nSuccessfully downloaded and processed ${count} authentic studio WebP photographs.`);

  // Ensure DB points to local images
  const picsumImages = await prisma.productImage.findMany({
    where: { url: { contains: "picsum.photos" } },
  });

  if (picsumImages.length > 0) {
    console.log(`Migrating ${picsumImages.length} database product images from Picsum to local paths...`);
    for (const img of picsumImages) {
      const match = img.url.match(/seed\/nexora-([a-z0-9-]+)-(\d+)/);
      if (match) {
        const [, slug, num] = match;
        await prisma.productImage.update({
          where: { id: img.id },
          data: { url: `/images/products/${slug}-${num}.webp` },
        });
      }
    }
    console.log("Database product image URLs updated to local paths.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Image generation script failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
