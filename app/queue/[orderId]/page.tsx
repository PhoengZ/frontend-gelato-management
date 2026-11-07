import { QueueTracker } from "@/components/QueueTracker";

export default async function QueuePage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { orderId } = await params;
  const returnedAt = Number((await searchParams).returned_at);
  return <QueueTracker orderId={orderId} returnedAt={Number.isFinite(returnedAt) && returnedAt > 0 ? returnedAt : undefined} />;
}
