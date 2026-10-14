"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/image-uploader";

const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    description: z.string().trim().min(5, "Description is required").max(5000),
    price: z.number().int("Price must be whole cents").min(0).max(10_000_000),
    compareAtPrice: z.number().int().min(0).max(10_000_000).nullable(),
    stock: z.number().int().min(0).max(1_000_000),
    brand: z.string().trim().max(60).nullable(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    categoryId: z.string().trim().min(1, "Category is required"),
    imageUrl: z.string().trim().max(500).nullable(),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes")
      .optional(),
    sku: z.string().trim().min(2).max(64).optional(),
  })
  .strict();

type ProductFormInput = z.infer<typeof productFormSchema>;

export type ProductFormValues = ProductFormInput & { slug?: string; sku?: string };

export function ProductForm({
  mode,
  productId,
  categories,
  initial,
}: {
  mode: "create" | "edit";
  productId?: string;
  categories: { id: string; name: string }[];
  initial?: ProductFormValues;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initial ?? {
      name: "",
      description: "",
      price: 0,
      compareAtPrice: null,
      stock: 0,
      brand: null,
      status: "DRAFT",
      categoryId: categories[0]?.id ?? "",
      imageUrl: null,
      slug: "",
      sku: "",
    },
  });

  async function onSubmit(values: ProductFormInput) {
    if (pending) return;
    if (mode === "create" && !values.slug) {
      form.setError("slug", { message: "Slug is required" });
      return;
    }
    if (mode === "create" && !values.sku) {
      form.setError("sku", { message: "SKU is required" });
      return;
    }
    setPending(true);
    try {
      const { slug, sku, ...editable } = values;
      const payload =
        mode === "create" ? { ...editable, slug, sku } : editable;
      const response = await fetch(
        mode === "create" ? "/api/admin/products" : `/api/admin/products/${productId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Unable to save product.");
        return;
      }
      toast.success(mode === "create" ? "Product created" : "Product saved");
      router.push("/admin/products");
      router.refresh();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6" noValidate>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Product details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <Field label="SKU" error={form.formState.errors.sku?.message}>
            <Input {...form.register("sku")} readOnly={mode === "edit"} disabled={mode === "edit"} />
          </Field>
          <Field label="Slug (URL)" error={form.formState.errors.slug?.message}>
            <Input placeholder="automatic-field-watch" {...form.register("slug")} readOnly={mode === "edit"} disabled={mode === "edit"} />
          </Field>
          <Field label="Brand" error={form.formState.errors.brand?.message}>
            <Input {...form.register("brand")} />
          </Field>
          <Field label="Category" error={form.formState.errors.categoryId?.message}>
            <select
              {...form.register("categoryId")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" error={form.formState.errors.status?.message}>
            <select
              {...form.register("status")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <Field
            label="Price (cents)"
            error={form.formState.errors.price?.message}
            hint="$429.00 = 42900"
          >
            <Input type="number" min={0} {...form.register("price", { valueAsNumber: true })} />
          </Field>
          <Field
            label="Compare-at price (cents, optional)"
            error={form.formState.errors.compareAtPrice?.message}
          >
            <Input
              type="number"
              min={0}
              {...form.register("compareAtPrice", {
                setValueAs: (value) => (value === "" || value === null ? null : Number(value)),
              })}
            />
          </Field>
          <Field label="Stock on hand" error={form.formState.errors.stock?.message}>
            <Input type="number" min={0} {...form.register("stock", { valueAsNumber: true })} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Product Imagery (File Upload, Direct URL, or Presets)"
              error={form.formState.errors.imageUrl?.message}
            >
              <ImageUploader
                value={form.watch("imageUrl") ?? null}
                onChange={(url) =>
                  form.setValue("imageUrl", url, { shouldDirty: true, shouldValidate: true })
                }
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" error={form.formState.errors.description?.message}>
              <Textarea rows={5} {...form.register("description")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {mode === "create" ? "Create product" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
