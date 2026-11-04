import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { recordPayment } from "@/lib/payments/payment-service";
import { paymentSchema } from "@/lib/validation/payments";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/payments",
    handler: async ({ context, fields }) => {
      await recordPayment(context, parseForm(paymentSchema, fields));
      return withFlash("/payments", "notice", "Payment recorded.");
    }
  });
}
