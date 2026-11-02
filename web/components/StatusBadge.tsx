import { STATUS_LABELS } from "@/lib/templates";
import type { BookingStatus } from "@/lib/types";

const STYLES: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  READY: "bg-green-100 text-green-800",
  COMPLETED: "bg-neutral-200 text-neutral-700",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const cls = STYLES[status] ?? "bg-neutral-200 text-neutral-700";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}
