"use client";

import { useState } from "react";

export default function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const isOpen = open === i;
        const panelId = `faq-panel-${i}`;
        const btnId = `faq-btn-${i}`;
        return (
          <div
            key={it.q}
            className={`overflow-hidden rounded-2xl border bg-white transition-colors ${
              isOpen ? "border-brand/40" : "border-neutral-200 hover:border-neutral-300"
            }`}
          >
            <button
              type="button"
              id={btnId}
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-bold text-neutral-900">{it.q}</span>
              <span
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-full transition-all duration-300 ${
                  isOpen ? "rotate-45 bg-brand text-white" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              inert={!isOpen}
              className="grid transition-all duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-neutral-600">{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
