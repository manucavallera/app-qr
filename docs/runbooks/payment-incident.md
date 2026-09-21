# Incidente de pagos

Si no llegan webhooks, conservar pedidos en espera y revisar logs por `providerOrderId`. Consultar el estado remoto en Mercado Pago. Si el importe no coincide, no confirmar el pedido y usar la conciliación administrativa con nota. Un reembolso externo se registra con `PAYMENT_RECONCILED`; el sistema no lo ejecuta automáticamente.
