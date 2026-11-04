"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import EdgeCard, { primaryAction, secondaryAction } from "@/components/EdgeCard";
import { reportError } from "@/lib/error-reporting";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);

  return (
    <EdgeCard
      inLayout
      label="Something went wrong"
      title="This page didn't load."
      actions={
        <>
          <button type="button" onClick={() => unstable_retry()} className={primaryAction}>
            Try again
          </button>
          <Link href="/dashboard" className={secondaryAction}>
            Go to the dashboard
          </Link>
        </>
      }
    >
      We hit an unexpected problem and have been told about it. Your bookings are safe.
    </EdgeCard>
  );
}
