import { BankPage } from "@/features/questions/bank-page";
import { gameCatalog } from "@/features/games/catalog";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game } = await searchParams;
  return (
    <BankPage
      game={
        game && Object.hasOwn(gameCatalog, game)
          ? (game as keyof typeof gameCatalog)
          : "all"
      }
    />
  );
}
