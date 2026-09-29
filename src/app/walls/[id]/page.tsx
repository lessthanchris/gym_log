import { notFound } from "next/navigation";
import { WallView } from "@/components/WallView";
import { getWallDetail } from "@/lib/db";
import { parseId } from "@/lib/http";

export default async function WallPage({ params }: PageProps<"/walls/[id]">) {
  const id = parseId((await params).id);
  const detail = id && getWallDetail(id);
  if (!detail) notFound();
  return <WallView initial={detail} />;
}
