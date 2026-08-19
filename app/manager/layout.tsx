import { BackofficeShell } from "@/components/backoffice/BackofficeShell";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <BackofficeShell>{children}</BackofficeShell>;
}
