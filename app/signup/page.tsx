"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignup } from "@/lib/api";
import gelatoLineup from "@/public/hero/gelato-lineup.png";

const inputClass = "mt-1 h-10 w-full border border-black/20 bg-stone-50 px-3.5 text-sm text-black outline-none focus:border-black";

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignup();
  const [passwordError, setPasswordError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirmPassword"))) {
      setPasswordError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setPasswordError("");
    signup.mutate({ name: String(data.get("name")), email: String(data.get("email")), password }, {
      onSuccess: () => { router.replace("/"); router.refresh(); }
    });
  };

  return (
    <main className="font-prompt relative isolate flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden py-6 sm:min-h-[calc(100svh-5rem)] sm:py-8">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 opacity-90">
        <Image src={gelatoLineup} alt="" className="max-h-[35vh] h-auto w-full object-cover object-top sm:max-h-[42vh]" priority />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md px-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-black sm:text-4xl">CREATE ACCOUNT</h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-black/70 sm:text-xs">สมัครสมาชิกเพื่อสั่งเจลาโต้ได้รวดเร็วยิ่งขึ้น</p>
        </div>

        <div className="mt-5 border border-black bg-white/95 p-5 shadow-2xl backdrop-blur-md sm:mt-6 sm:p-7">
          <div className="mb-4 flex items-center gap-3 border border-black/10 bg-[#fff3f7] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-black/65">
            <span className="grid h-6 w-6 shrink-0 place-items-center bg-[#f79bad] text-black"><Check className="h-3.5 w-3.5" /></span>
            Member account · Order & queue tracking
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-black/70">
              Display name
              <input name="name" autoComplete="name" minLength={2} required placeholder="ชื่อของคุณ" className={inputClass} />
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-black/70">
              Email
              <input name="email" autoComplete="email" type="email" required placeholder="you@example.com" className={inputClass} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-black/70">
                Password
                <input name="password" autoComplete="new-password" type="password" minLength={8} required placeholder="8+ characters" className={inputClass} />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-black/70">
                Confirm
                <input name="confirmPassword" autoComplete="new-password" type="password" minLength={8} required placeholder="อีกครั้ง" className={inputClass} />
              </label>
            </div>

            {(passwordError || signup.isError) && <p role="alert" className="text-xs font-semibold text-red-600">{passwordError || signup.error?.message}</p>}

            <Button type="submit" className="h-11 w-full text-xs font-bold uppercase tracking-wider" disabled={signup.isPending}>
              {signup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} CREATE MY ACCOUNT
            </Button>
          </form>

          <p className="mt-4 border-t border-black/10 pt-4 text-center text-[11px] font-semibold text-black/60">
            มีบัญชีอยู่แล้ว? <Link href="/login" className="font-black uppercase tracking-wider text-black underline underline-offset-4">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
