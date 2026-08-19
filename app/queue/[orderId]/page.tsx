import { QueueTracker } from "@/components/QueueTracker";

export default async function QueuePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <QueueTracker orderId={orderId} />;
}
