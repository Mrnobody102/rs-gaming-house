import { EditorPage } from "@/features/questions/editor-page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ game?: string; set?: string }>;
}) {
  const query = await searchParams;
  return (
    <EditorPage id={(await params).id} game={query.game} setId={query.set} />
  );
}
