"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthFooter, GoogleButton, OrDivider } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useLogin } from "@/lib/api";
import loginHero from "@/public/illustrations/login-hero.png";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ email, password }, {
      onSuccess: (session) => {
        const requested = new URLSearchParams(window.location.search).get("next");
        const fallback = session.user.role === "MANAGER" ? "/manager" : session.user.role === "STAFF" ? "/staff" : "/";
        router.replace(requested?.startsWith("/") && !requested.startsWith("//") ? requested : fallback);
        router.refresh();
      }
    });
  };

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-2">
      <Image src={loginHero} alt="เจลาโตพิสตาชิโอ สตรอว์เบอร์รี และวานิลลา" priority className="h-[168px] w-full rounded-3xl object-cover" />

      <div>
        <h1 className="text-[26px] font-semibold">ยินดีต้อนรับกลับ</h1>
        <p className="mt-1 text-[13px] text-subtle">เข้าสู่ระบบเพื่อสั่งเจลาโตและติดตามคิวของคุณ</p>
      </div>

      <GoogleButton />
      <OrDivider />

      <form onSubmit={submit} className="space-y-4">
        <Field label="อีเมล">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required />
        </Field>
        <Field label="รหัสผ่าน" error={login.isError ? login.error.message : undefined}>
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            maxLength={72}
            placeholder="••••••••"
            required
            aria-invalid={login.isError}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />} เข้าสู่ระบบ
        </Button>
      </form>

      <AuthFooter text="ยังไม่มีบัญชี?" href="/signup" label="สมัครสมาชิก" />
    </main>
  );
}
