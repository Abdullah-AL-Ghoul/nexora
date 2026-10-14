"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import { 
  UploadCloud, 
  Link as LinkIcon, 
  Sparkles, 
  X, 
  Check, 
  Loader2, 
  ImageIcon, 
  AlertCircle 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const LUXURY_PRESETS = [
  {
    name: "Chronograph Timepiece",
    url: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1200&q=80",
    category: "Watches",
  },
  {
    name: "Classic Minimalist Watch",
    url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80",
    category: "Watches",
  },
  {
    name: "Diamond Solitaire Ring",
    url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80",
    category: "Jewelry",
  },
  {
    name: "Gold Pendant Necklace",
    url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80",
    category: "Jewelry",
  },
  {
    name: "Handcrafted Leather Briefcase",
    url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80",
    category: "Leather",
  },
  {
    name: "Luxury Silk Scarf",
    url: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1200&q=80",
    category: "Accessories",
  },
];

export function ImageUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [mode, setMode] = useState<"upload" | "url" | "presets">("upload");
  const [urlInput, setUrlInput] = useState(value ?? "");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WEBP, AVIF).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file is too large (max 10MB).");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload image");
      }

      onChange(data.url);
      setUrlInput(data.url);
      toast.success("Image uploaded successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error uploading file";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFile(e.dataTransfer.files[0]);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      void handleFile(e.target.files[0]);
    }
  }

  function applyUrl() {
    if (!urlInput.trim()) {
      onChange(null);
      return;
    }
    onChange(urlInput.trim());
    toast.success("Image URL applied");
  }

  return (
    <div className="space-y-3">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === "upload"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <UploadCloud className="size-3.5" />
          <span>Upload File</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === "url"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <LinkIcon className="size-3.5" />
          <span>Image URL</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("presets")}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === "presets"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Sparkles className="size-3.5" />
          <span>Luxury Presets</span>
        </button>
      </div>

      {/* Mode 1: Direct File Upload & Drag-and-Drop */}
      {mode === "upload" && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={onFileChange}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-xs font-medium text-foreground">Processing and optimizing image…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-primary/10 p-3 text-primary transition-transform group-hover:scale-110">
                <UploadCloud className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  Click to browse or drag and drop an image
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Supports high-resolution PNG, JPG, WEBP, or AVIF (Up to 10MB)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Direct URL Input */}
      {mode === "url" && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://images.unsplash.com/... or https://..."
            className="h-9 text-xs"
          />
          <Button type="button" size="sm" onClick={applyUrl} className="h-9 text-xs shrink-0">
            Apply
          </Button>
        </div>
      )}

      {/* Mode 3: Curated Luxury Presets */}
      {mode === "presets" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LUXURY_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                onChange(preset.url);
                setUrlInput(preset.url);
                toast.success(`Selected "${preset.name}"`);
              }}
              className={`group flex flex-col items-start rounded-lg border p-2 text-left transition-all hover:border-primary/50 hover:bg-muted/30 ${
                value === preset.url
                  ? "border-primary bg-primary/5 ring-1 ring-primary/50"
                  : "border-border/60"
              }`}
            >
              <div className="relative aspect-video w-full overflow-hidden rounded bg-muted mb-1.5">
                <Image
                  src={preset.url}
                  alt={preset.name}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              </div>
              <p className="truncate text-[11px] font-medium text-foreground w-full">
                {preset.name}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono">
                {preset.category}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Live Active Preview */}
      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-3">
          <div className="flex items-center gap-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-background shadow-xs">
              <Image
                src={value}
                alt="Product preview"
                fill
                className="object-cover"
                unoptimized={value.startsWith("data:")}
              />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Check className="size-3.5 text-emerald-500" />
                Active Product Image
              </p>
              <p className="truncate text-[11px] font-mono text-muted-foreground max-w-[280px] sm:max-w-md">
                {value.startsWith("data:") ? "Base64 Optimized Data URI" : value}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setUrlInput("");
            }}
            className="size-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
          <ImageIcon className="size-3.5" />
          <span>No image selected yet. Products without an image will display an elegant atelier monogram.</span>
        </div>
      )}
    </div>
  );
}
