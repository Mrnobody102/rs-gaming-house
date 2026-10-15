import { CreateSession } from "@/features/sessions/create-page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  return <CreateSession initialSetId={(await searchParams).set} />;
}
