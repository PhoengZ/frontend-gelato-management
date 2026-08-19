import { BackofficeShell } from "@/components/backoffice/BackofficeShell";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <BackofficeShell>{children}</BackofficeShell>;
}
