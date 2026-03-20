import sharp from "sharp";
import path from "path";
import fs from "fs";

const SOURCE = path.resolve(__dirname, "../public/bud.png");
const ICONS_DIR = path.resolve(__dirname, "../public/icons");
const PUBLIC_DIR = path.resolve(__dirname, "../public");

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const source = sharp(SOURCE);
  const { width, height } = await source.metadata();
  console.log(`Source image: ${width}x${height}`);

  // Standard icons: resize to exact dimensions
  const sizes = [
    { name: "icon-192x192.png", size: 192 },
    { name: "icon-512x512.png", size: 512 },
  ];

  for (const { name, size } of sizes) {
    await sharp(SOURCE)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .png()
      .toFile(path.join(ICONS_DIR, name));
    console.log(`Generated icons/${name}`);
  }

  // Maskable icon: 512x512 with ~20% padding (safe zone)
  // The logo occupies the center 80% of the canvas
  const maskableSize = 512;
  const logoSize = Math.round(maskableSize * 0.8); // 410px logo area
  await sharp(SOURCE)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .extend({
      top: Math.round((maskableSize - logoSize) / 2),
      bottom: Math.round((maskableSize - logoSize) / 2),
      left: Math.round((maskableSize - logoSize) / 2),
      right: Math.round((maskableSize - logoSize) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toFile(path.join(ICONS_DIR, "icon-maskable-512x512.png"));
  console.log("Generated icons/icon-maskable-512x512.png");

  // Apple touch icon: 180x180
  await sharp(SOURCE)
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toFile(path.join(PUBLIC_DIR, "apple-touch-icon.png"));
  console.log("Generated apple-touch-icon.png");

  console.log("Done!");
}

main().catch(console.error);
