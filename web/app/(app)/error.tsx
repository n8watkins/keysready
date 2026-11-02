"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center">
      <p className="text-xs font-extrabold uppercase tracking-wider text-brand">
        KeysReady
      </p>
      <h1 className="mt-3 text-2xl font-extrabold text-neutral-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        We hit an unexpected problem. Please try again — your booking is safe.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-6 min-h-[48px] w-full rounded-xl bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
