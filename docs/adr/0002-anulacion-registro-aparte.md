# ADR 0002 - Anulamos la venta con un registro aparte y no editando la venta original

- **Estado:** propuesto
- **Fecha:** 2026-11-25
- **Participantes:** Burgos Lucas (supervisor del grupo). Pendiente de revisión por el resto del grupo.

## Contexto

Un supervisor tiene que poder anular una venta confirmada con un motivo, sin perder el registro de la venta original. El stock, la caja y los reportes tienen que quedar consistentes. La consigna pide que el estado actual sea el resultado de los movimientos y no un número que se sobrescribe, y que la venta confirmada no se edite ni se borre.

## Opciones consideradas

**A. Campo `estado` en la venta.** La venta pasa de `confirmada` a `anulada` cuando se anula.

- Ventajas: consultar si una venta está anulada es directo, sin buscar en otro registro.
- Desventajas: se sobrescribe un dato de la venta, lo que contradice la consigna. Además, el motivo y el supervisor tienen que guardarse en la venta o en otra tabla igual, así que no se simplifica nada.

**B. Registro de anulación aparte, con la venta inmutable.** Una anulación apunta a la venta y se guarda en su propio registro. Una venta está confirmada si no tiene anulación.

- Ventajas: la venta original nunca cambia, la anulación queda auditada con supervisor, motivo y fecha, y el estado sale de los registros, como pide la consigna.
- Desventajas: para saber si una venta está anulada hay que consultar otro registro. Hace falta un bloqueo para que dos anulaciones simultáneas no pasen las dos (ver ADR 0001).

**C. Venta inversa.** Anular crea una segunda venta con importes negativos.

- Ventajas: todo queda en un solo tipo de registro, y los reportes suman sin tratamiento especial.
- Desventajas: mezcla ventas reales con operaciones de corrección, complica los reportes por producto y por vendedor, y obliga a decidir qué pasa con el stock y con los descuentos de la venta inversa.

## Decisión

Elegimos **B**. La venta queda inmutable y cada anulación es un registro propio con su supervisor, su motivo y su fecha. La caja registra un movimiento de anulación por cada pago revertido, y el stock de cada producto vuelve a sumar la cantidad vendida.

## Consecuencias

- Ganamos auditoría: cada anulación tiene quién, cuándo y por qué.
- Ganamos consistencia: la venta original nunca se toca, y el estado se deduce de los registros.
- Perdemos simplicidad en las consultas: mostrar si una venta está anulada requiere un segundo acceso. Con base de datos se resuelve con un `LEFT JOIN` a la tabla de anulaciones.
- Queda más difícil cambiar después la forma de anular (por ejemplo, anulaciones parciales), porque cada anulación hoy es total y revierte todos los pagos.
- La anulación depende de los bloqueos para evitar la doble anulación simultánea.

## Qué nos haría cambiar de decisión

Si los reportes necesitan el neto de cada venta en una sola consulta muy frecuente, y el `LEFT JOIN` se vuelve un cuello de botella, reconsideramos la opción C o desnormalizamos el estado en la venta como dato derivado.
