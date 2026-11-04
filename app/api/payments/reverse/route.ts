import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { reversePayment } from "@/lib/payments/payment-service";
import { reversePaymentSchema } from "@/lib/validation/payments";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/payments",
    handler: async ({ context, fields }) => {
      await reversePayment(context, parseForm(reversePaymentSchema, fields));
      return withFlash("/payments", "notice", "Payment reversed.");
    }
  });
}
