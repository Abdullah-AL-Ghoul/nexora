import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConsultationStatusSelect } from "@/components/admin/consultation-status-select";
import { STAFF_ROLES, requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import {
  CONSULTATION_STATUS_LABEL,
  CONSULTATION_TYPE_LABEL,
  type CONSULTATION_TYPES,
} from "@/lib/consultations";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Consultations" };

const PER_PAGE = 25;

type ConsultationTypeKey = (typeof CONSULTATION_TYPES)[number];

export default async function AdminConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole(STAFF_ROLES);

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [requests, total] = await Promise.all([
    prisma.consultationRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
    }),
    prisma.consultationRequest.count(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Consultations</h1>
        <p className="text-sm text-muted-foreground">
          Private consultation requests submitted from the storefront — follow up by
          phone or email, then move the request through its status flow.
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No consultation requests yet. New submissions from the “Private Consultation”
          dialog will appear here.
        </p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-card">
                <TableHead className="px-4 py-3 text-muted-foreground">Client</TableHead>
                <TableHead className="px-4 py-3 text-muted-foreground">Contact</TableHead>
                <TableHead className="px-4 py-3 text-muted-foreground">Focus</TableHead>
                <TableHead className="px-4 py-3 text-muted-foreground">Product</TableHead>
                <TableHead className="px-4 py-3 text-muted-foreground">Requested</TableHead>
                <TableHead className="px-4 py-3 text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">
                      {request.fullName}
                    </div>
                    {request.notes && (
                      <div className="mt-0.5 max-w-64 truncate text-xs text-muted-foreground">
                        {request.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    <div className="text-xs">{request.email}</div>
                    <div className="text-xs tabular-nums">{request.phone}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                    {CONSULTATION_TYPE_LABEL[request.type as ConsultationTypeKey] ??
                      request.type}
                    {request.preferredDate && (
                      <div className="mt-0.5">Pref. {formatDate(request.preferredDate)}</div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs">
                    {request.productSlug ? (
                      <Link
                        href={`/product/${request.productSlug}`}
                        className="text-primary hover:underline"
                      >
                        {request.productName ?? request.productSlug}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(request.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <ConsultationStatusSelect
                      requestId={request.id}
                      currentStatus={
                        request.status as keyof typeof CONSULTATION_STATUS_LABEL
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((target) => (
            <Link
              key={target}
              href={`/admin/consultations?page=${target}`}
              className={
                target === page
                  ? "rounded-md bg-primary/10 px-2.5 py-1 font-medium text-primary"
                  : "rounded-md px-2.5 py-1 hover:bg-muted hover:text-foreground"
              }
            >
              {target}
            </Link>
          ))}
          <span>
            Page {page} of {pageCount} · {total} total
          </span>
          <Badge variant="outline" className="sr-only">
            Consultations pagination
          </Badge>
        </div>
      )}
    </div>
  );
}
