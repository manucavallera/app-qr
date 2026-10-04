export const customerOrderSteps = [
  { status: "AWAITING_PAYMENT", label: "Pedido recibido" },
  { status: "CONFIRMED", label: "Pago confirmado" },
  { status: "PREPARING", label: "En preparación" },
  { status: "READY", label: "Listo" },
  { status: "DELIVERED", label: "Entregado" },
] as const;

type OrderProgressProps = Readonly<{
  currentStatus: string;
}>;

export function OrderProgress({ currentStatus }: OrderProgressProps) {
  const currentIndex = customerOrderSteps.findIndex((step) => step.status === currentStatus);

  return (
    <ol className="cm-steps" aria-label="Estado del pedido">
      {customerOrderSteps.map((step, index) => {
        const isDone = currentIndex >= index;
        return (
          <li className={`${isDone ? "is-done " : ""}${currentStatus === step.status ? "is-current" : ""}`.trim()} key={step.status}>
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
          </li>
        );
      })}
    </ol>
  );
}
