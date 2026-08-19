import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
      }

      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion
      });
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // Fallback parsing for test environments
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (error) {
    console.error("Stripe Webhook Signature Verification Failed:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Invalid Webhook Signature" },
      { status: 400 }
    );
  }

  // Handle Stripe Event Types
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`✅ [Stripe Webhook] PaymentIntent Succeeded: ${paymentIntent.id} (Amount: ${paymentIntent.amount / 100} THB)`);
      // Update order payment status in database
      break;
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.warn(`❌ [Stripe Webhook] PaymentIntent Failed: ${paymentIntent.id}`);
      break;
    }
    default:
      console.log(`ℹ️ [Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
