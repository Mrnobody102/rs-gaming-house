import { GameScreen } from "@/features/play/game-screen";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  return (
    <GameScreen
      id={(await params).id}
      accessToken={(await searchParams).view || ""}
      projector
    />
  );
}
