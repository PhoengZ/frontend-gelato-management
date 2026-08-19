"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLogin } from "@/lib/api";
import gelatoLineup from "@/public/hero/gelato-lineup.png";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Default mapping for demo login matching system credentials if needed
    const emailToUse = username.includes("@") ? username : `${username}@gelatte.test`;
    login.mutate({ email: emailToUse, password }, {
      onSuccess: (session) => {
        const requested = new URLSearchParams(window.location.search).get("next");
        const fallback = session.user.role === "MANAGER" ? "/manager" : session.user.role === "STAFF" ? "/staff" : "/";
        router.replace(requested?.startsWith("/") ? requested : fallback);
        router.refresh();
      }
    });
  };

  const handleGoogleSignIn = () => {
    toast.info("Google Sign-In (Demo Mock)", {
      description: "ระบบล็อกอินด้วย Google จำลองไว้สำหรับการทดสอบอินเทอร์เฟซ"
    });
  };

  return (
    <main className="font-prompt relative isolate flex min-h-[calc(100svh-4rem)] sm:min-h-[calc(100svh-5rem)] items-center justify-center overflow-hidden py-6">
      {/* Background Gelato Image Overlayed Behind Card */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 opacity-90">
        <Image
          src={gelatoLineup}
          alt=""
          className="h-auto w-full max-h-[35vh] sm:max-h-[42vh] object-cover object-top"
          priority
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md px-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-black sm:text-4xl">SIGN IN</h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-black/70 sm:text-xs">
            เข้าสู่ระบบเพื่อสั่งเจลาโต้และติดตามคิวของคุณ
          </p>
        </div>

        <div className="mt-5 border border-black bg-white/95 backdrop-blur-md p-5 shadow-2xl sm:mt-6 sm:p-7">
          {/* Mock Google Sign in button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex h-11 w-full items-center justify-center gap-3 border border-black bg-white px-4 text-xs font-bold uppercase tracking-wider text-black transition-all hover:bg-stone-50"
          >
            <GoogleIcon />
            SIGN IN WITH GOOGLE
          </button>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/15" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">OR</span>
            <div className="h-px flex-1 bg-black/15" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-black/70">
                Username / Email
              </label>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                type="text"
                placeholder="customer"
                required
                className="mt-1 h-10 w-full border border-black/20 bg-stone-50 px-3.5 text-sm text-black outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-black/70">
                Password
              </label>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="••••••••"
                required
                className="mt-1 h-10 w-full border border-black/20 bg-stone-50 px-3.5 text-sm text-black outline-none focus:border-black"
              />
            </div>

            {login.isError && <p className="text-xs font-semibold text-red-600">{login.error.message}</p>}

            <Button type="submit" className="h-11 w-full text-xs font-bold uppercase tracking-wider" disabled={login.isPending}>
              {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              SIGN IN
            </Button>
          </form>

          {/* Quick preset buttons for demo testing convenience */}
          <div className="mt-4 border-t border-black/10 pt-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-black/40">DEMO ACCOUNTS:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => { setUsername("customer"); setPassword("customer123"); }}
                className="border border-black/15 bg-stone-50 px-2 py-0.5 font-mono font-bold hover:bg-stone-200"
              >
                Customer
              </button>
              <button
                type="button"
                onClick={() => { setUsername("staff"); setPassword("staff123"); }}
                className="border border-black/15 bg-stone-50 px-2 py-0.5 font-mono font-bold hover:bg-stone-200"
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => { setUsername("manager"); setPassword("manager123"); }}
                className="border border-black/15 bg-stone-50 px-2 py-0.5 font-mono font-bold hover:bg-stone-200"
              >
                Manager
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

