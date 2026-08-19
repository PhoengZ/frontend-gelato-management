import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, ["CUSTOMER"]);
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion
    });

    const body = await request.json();
    const { amount, currency = "thb" } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ code: "INVALID_AMOUNT", message: "จำนวนเงินไม่ถูกต้อง" }, { status: 400 });
    }

    // Stripe expects amount in smallest currency unit (e.g. Satang for THB -> 100 THB = 10000 satang)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      payment_method_types: ["card", "promptpay"]
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Stripe PaymentIntent Error:", error);
    return NextResponse.json(
      { code: "STRIPE_ERROR", message: error instanceof Error ? error.message : "สร้าง PaymentIntent ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
