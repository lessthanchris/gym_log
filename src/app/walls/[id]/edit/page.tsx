import { notFound } from "next/navigation";
import { WallEditor } from "@/components/WallEditor";
import { getWallDetail } from "@/lib/db";
import { parseId } from "@/lib/http";

export default async function EditWallPage({ params }: PageProps<"/walls/[id]/edit">) {
  const id = parseId((await params).id);
  const detail = id && getWallDetail(id);
  if (!detail) notFound();
  return <WallEditor initial={detail} />;
}
