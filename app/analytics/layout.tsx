import { BackofficeShell } from "@/components/backoffice/BackofficeShell";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <BackofficeShell>{children}</BackofficeShell>;
}
