import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireApiRole } from "@/lib/auth/api-guards";
import { STAFF_ROLES } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireApiRole(STAFF_ROLES);
  if ("error" in gate) return gate.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    // Validate mime type
    const validMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/gif",
    ];
    if (!validMimes.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Unsupported image format. Please upload JPG, PNG, WEBP, or AVIF." },
        { status: 400 }
      );
    }

    // Max 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Image file exceeds maximum allowed size (10MB)." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize extension and filename
    const ext = path.extname(file.name) || `.${file.type.split("/")[1] || "jpg"}`;
    const cleanExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, "");
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = `product-${uniqueSuffix}${cleanExt}`;

    let publicUrl = "";

    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);
      publicUrl = `/uploads/${filename}`;
    } catch {
      // In serverless environments (like Vercel production with read-only root),
      // embed image cleanly as high-fidelity Base64 Data URI
      const base64 = buffer.toString("base64");
      publicUrl = `data:${file.type};base64,${base64}`;
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
      mimeType: file.type,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Image upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
