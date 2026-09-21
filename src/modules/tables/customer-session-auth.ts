import { CUSTOMER_SESSION_COOKIE, customerSessionService, type CustomerPrincipal } from "./customer-session-service";

export { CUSTOMER_SESSION_COOKIE };

export async function authenticateCustomerSession(
  token: string | undefined,
  qrToken?: string,
): Promise<CustomerPrincipal | null> {
  return customerSessionService.authenticate(token, qrToken);
}
