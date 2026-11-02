"use client";

import { useState } from "react";

const FIELD =
  "w-full min-h-[48px] rounded-xl border border-neutral-300 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export interface NewCar {
  year: number;
  make: string;
  model: string;
  plate?: string;
}

interface Props {
  /** Resolves true on success so the form can reset; false leaves inputs intact. */
  onAdd: (car: NewCar) => Promise<boolean>;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function CarForm({ onAdd }: Props) {
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const y = Number(year);
    if (!Number.isInteger(y) || y < 1900 || y > 2100) {
      setError("Enter a valid year (1900–2100).");
      return;
    }
    if (!make.trim() || !model.trim()) {
      setError("Make and model are required.");
      return;
    }

    setSaving(true);
    const ok = await onAdd({
      year: y,
      make: make.trim(),
      model: model.trim(),
      plate: plate.trim() || undefined,
    });
    setSaving(false);

    if (ok) {
      setYear("");
      setMake("");
      setModel("");
      setPlate("");
    } else {
      setError("Couldn't add that car. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Year</span>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            placeholder={String(CURRENT_YEAR)}
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Make</span>
          <input
            value={make}
            onChange={(e) => setMake(e.target.value)}
            required
            maxLength={40}
            placeholder="Honda"
            className={FIELD}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Model</span>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          required
          maxLength={40}
          placeholder="Civic"
          className={FIELD}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          License plate <span className="font-normal text-neutral-400">(optional)</span>
        </span>
        <input
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          maxLength={16}
          autoCapitalize="characters"
          placeholder="ABC-1234"
          className={`${FIELD} uppercase`}
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="min-h-[48px] w-full rounded-xl bg-brand px-5 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {saving ? "Adding…" : "Add car"}
      </button>
    </form>
  );
}
