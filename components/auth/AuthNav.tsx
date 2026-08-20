"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLogout, useSession } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AuthNav() {
  const router = useRouter();
  const session = useSession();
  const logout = useLogout();
  const user = session.data?.user;

  if (!user) return (
    <>
      <Link href="/signup" className="hidden text-xs font-bold transition-colors hover:underline sm:inline">SIGN UP</Link>
      <Link href="/login" className={buttonVariants({ size: "sm" })}>LOGIN</Link>
    </>
  );

  return (
    <>
      {(user.role === "STAFF" || user.role === "MANAGER") && (
        <Link href="/staff" className="hidden transition-colors hover:text-black hover:underline md:inline underline-offset-8">KITCHEN</Link>
      )}
      {user.role === "MANAGER" && (
        <>
          <Link href="/manager" className="hidden transition-colors hover:text-black hover:underline lg:inline underline-offset-8">INVENTORY</Link>
          <Link href="/analytics" className="hidden transition-colors hover:text-black hover:underline lg:inline underline-offset-8">ANALYTICS</Link>
        </>
      )}
      <Button
        size="sm"
        variant="outline"
        className={cn("px-3", logout.isPending && "opacity-50")}
        onClick={() => logout.mutate(undefined, { onSuccess: () => { router.push("/"); router.refresh(); } })}
        disabled={logout.isPending}
        aria-label={`Logout ${user.name}`}
      >
        <span className="hidden sm:inline">{user.role}</span><LogOut className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
