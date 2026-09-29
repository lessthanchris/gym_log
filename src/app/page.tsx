import Link from "next/link";
import { connection } from "next/server";
import { UploadWall } from "@/components/UploadWall";
import { listWalls } from "@/lib/db";

export default async function Home() {
  await connection();
  const walls = listWalls();
  return (
    <div className="flex flex-col gap-6">
      <UploadWall />
      <section>
        <h2 className="mb-3 text-lg font-semibold">Walls</h2>
        {walls.length === 0 ? (
          <p className="text-stone-600">No walls yet. Snap a photo of one to get started.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {walls.map((w) => (
              <li key={w.id}>
                <Link href={`/walls/${w.id}`} className="block overflow-hidden rounded-lg border border-stone-200 bg-white hover:shadow">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served from our own API */}
                  <img src={`/api/walls/${w.id}/image`} alt="" className="h-48 w-full object-cover" loading="lazy" />
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="truncate font-medium">{w.name}</span>
                    <span className="text-sm text-stone-500">
                      {w.status === "detecting" ? "Detecting…" : `${w.route_count} routes`}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
