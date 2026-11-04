"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { AuthFooter, GoogleButton, OrDivider } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useSignup } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignup();
  const [passwordError, setPasswordError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirmPassword"))) {
      setPasswordError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setPasswordError("");
    signup.mutate({ display_name: String(data.get("display_name")).trim(), email: String(data.get("email")).trim(), password }, {
      onSuccess: () => { router.replace("/"); router.refresh(); }
    });
  };

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-2">
      <div>
        <h1 className="text-[26px] font-semibold">สร้างบัญชีใหม่</h1>
        <p className="mt-1 text-[13px] text-subtle">สมัครสมาชิกเพื่อสั่งเจลาโตได้รวดเร็วยิ่งขึ้น</p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-pink-soft px-3.5 py-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pink"><Check className="h-4 w-4" /></span>
        <p className="text-xs font-medium">สั่งล่วงหน้า · ติดตามคิวแบบเรียลไทม์ · แจ้งเตือนเมื่อพร้อมรับ</p>
      </div>

      <GoogleButton />
      <OrDivider />

      <form onSubmit={submit} className="space-y-4">
        <Field label="ชื่อที่แสดง">
          <Input name="display_name" autoComplete="name" maxLength={100} required placeholder="ชื่อของคุณ" />
        </Field>
        <Field label="อีเมล">
          <Input name="email" autoComplete="email" type="email" required placeholder="you@example.com" />
        </Field>
        <Field label="รหัสผ่าน" hint="รหัสผ่านอย่างน้อย 8 ตัวอักษร">
          <Input name="password" autoComplete="new-password" type="password" minLength={8} maxLength={72} required placeholder="••••••••" />
        </Field>
        <Field label="ยืนยันรหัสผ่าน" error={passwordError || (signup.isError ? signup.error?.message : undefined)}>
          <Input name="confirmPassword" autoComplete="new-password" type="password" minLength={8} required placeholder="••••••••" aria-invalid={Boolean(passwordError)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={signup.isPending}>
          {signup.isPending && <Loader2 className="h-4 w-4 animate-spin" />} สร้างบัญชี
        </Button>
      </form>

      <AuthFooter text="มีบัญชีอยู่แล้ว?" href="/login" label="เข้าสู่ระบบ" />
    </main>
  );
}
