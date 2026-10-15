import { PresentationPage } from "@/features/presentation/presentation-page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const [{ id }, { source }] = await Promise.all([params, searchParams]);
  return (
    <PresentationPage
      id={id}
      source={source === "session" ? "session" : "set"}
    />
  );
}
