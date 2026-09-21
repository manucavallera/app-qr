import { getServerEnv } from "@/lib/env";
import { FakePaymentGateway } from "./fake-payment-gateway";
import { MercadoPagoGateway } from "./mercado-pago-gateway";
import type { PaymentGateway } from "./payment-gateway";

let gateway: PaymentGateway | undefined;

export function createPaymentGateway(): PaymentGateway {
  if (gateway) return gateway;
  const env = getServerEnv();
  gateway = env.PAYMENT_PROVIDER === "mercadopago"
    ? new MercadoPagoGateway(env.MERCADOPAGO_ACCESS_TOKEN!)
    : new FakePaymentGateway();
  return gateway;
}
