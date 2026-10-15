import { ControlPage } from "@/features/sessions/control-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ControlPage id={(await params).id} />;
}
