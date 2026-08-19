"use client";

import { FormEvent, useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StripeCheckoutForm({
  totalAmount,
  onSuccess,
  isProcessing
}: {
  totalAmount: number;
  onSuccess: () => void;
  isProcessing: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href
      },
      redirect: "if_required"
    });

    if (error) {
      setErrorMessage(error.message ?? "การชำระเงินขัดข้อง");
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess();
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="font-prompt mt-4 space-y-4">
      <div className="border border-black/20 bg-stone-50 p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {errorMessage && (
        <p className="text-xs font-bold text-red-600">{errorMessage}</p>
      )}

      <Button
        type="submit"
        size="lg"
        className="h-14 w-full text-xs font-bold uppercase tracking-wider"
        disabled={!stripe || loading || isProcessing}
      >
        {loading || isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> CONFIRMING STRIPE PAYMENT...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" /> PAY VIA STRIPE
          </>
        )}
      </Button>
    </form>
  );
}
