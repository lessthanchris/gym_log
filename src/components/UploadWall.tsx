"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "./api";

export function UploadWall() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("photo", file);
    form.set("name", name);
    try {
      const wall = await api.uploadWall(form);
      router.push(`/walls/${wall.id}/edit`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h1 className="mb-1 text-lg font-semibold">Add a wall</h1>
      <p className="mb-3 text-sm text-stone-600">
        Take a straight-on photo of the whole wall. AI will find the routes and holds, then you can fix anything it got
        wrong and add grades.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wall name (e.g. Lead cave)"
          maxLength={100}
          className="min-w-0 flex-1 rounded border border-stone-300 px-3 py-2"
        />
        <button
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="rounded bg-stone-900 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Take photo"}
        </button>
        <button
          disabled={busy}
          onClick={() => libraryRef.current?.click()}
          className="rounded bg-stone-200 px-4 py-2 font-medium disabled:opacity-50"
        >
          Choose photo
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files?.[0])} />
      <input ref={libraryRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
