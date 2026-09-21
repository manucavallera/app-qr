export type HealthResponse = {
  status: "ok";
  service: "app-qr";
};

export async function GET(): Promise<Response> {
  const body: HealthResponse = { status: "ok", service: "app-qr" };
  return Response.json(body);
}
