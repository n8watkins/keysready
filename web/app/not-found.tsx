import type { Metadata } from "next";
import Link from "next/link";
import EdgeCard, { primaryAction, secondaryAction } from "@/components/EdgeCard";

export const metadata: Metadata = {
  title: "Page not found - KeysReady",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <EdgeCard
      label="404 - page not found"
      title="This page isn't here."
      actions={
        <>
          <Link href="/" className={primaryAction}>
            Go to the home page
          </Link>
          <Link href="/status" className={secondaryAction}>
            Track a repair
          </Link>
        </>
      }
    >
      The link may be old or mistyped. To check on a car, use the link your shop sent you, or track it here.
    </EdgeCard>
  );
}
