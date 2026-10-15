import { CreateSession } from "@/features/sessions/create-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <CreateSession setId={(await params).id} />;
}
