# API del Gestor de Ventas

Todas las respuestas son JSON. El puerto sale de la variable `PORT` del archivo `.env`.

## Autenticación (temporal)

Todas las rutas, salvo `GET /health`, piden estos encabezados:

| Encabezado | Valor |
| --- | --- |
| `X-Usuario-Id` | id del usuario (texto no vacío) |
| `X-Rol` | `cajero` o `supervisor` |

Si falta alguno, la respuesta es `401 NoAutenticado`. Esta autenticación es temporal y se reemplaza por JWT o sesiones (ver el ADR de autenticación cuando esté escrito).

## Idempotencia

Las operaciones que crean algo (`POST /ventas` y `POST /ventas/:id/anulacion`) piden el encabezado `Idempotency-Key`. Si llega una clave ya usada:

- Con el mismo cuerpo, la respuesta es la misma de la primera vez y trae el encabezado `Idempotent-Replayed: true`. No se vuelve a ejecutar nada.
- Con otro cuerpo, la respuesta es `422 IdempotenciaConflicto`.

## Errores

Todos los errores tienen esta forma:

```json
{
  "error": {
    "codigo": "VentaYaAnulada",
    "mensaje": "La venta ya fue anulada.",
    "idCorrelacion": "6f1c0c2e-4a57-4f0e-9d1b-2f7e1a9c3b10"
  }
}
```

| Estado | Códigos | Cuándo |
| --- | --- | --- |
| 400 | `SolicitudInvalida`, `DatosInvalidos`, `ImporteInvalido` | Cuerpo, parámetros o encabezados mal formados. |
| 401 | `NoAutenticado` | Faltan `X-Usuario-Id` o `X-Rol`. |
| 403 | `SinPermiso` | El rol no puede hacer la operación. |
| 404 | `VentaNoEncontrada`, `RutaNoEncontrada` | La venta no existe o no es del cajero, o la ruta no existe. |
| 409 | `CajaNoAbierta`, `CajaYaAbierta`, `StockInsuficiente`, `VentaYaAnulada` | Estado de la caja, stock o la venta no permite la operación. |
| 422 | `PagosNoCuadran`, `ProductoNoEncontrado`, `IdempotenciaConflicto` | Los datos son válidos pero no se pueden procesar. |
| 500 | `ErrorInterno` | Error no esperado. No se devuelve detalle interno. |

## Salud

### `GET /health`

Responde `200` con `{"status": "ok"}`. No pide autenticación.

## Cajas

### `POST /cajas/abrir`

Rol: `cajero`. Abre la caja del cajero.

Cuerpo:

```json
{ "montoInicialCentavos": 50000 }
```

`montoInicialCentavos` es un entero mayor o igual que 0. Responde `201` con la caja. Si el cajero ya tiene una caja abierta, responde `409 CajaYaAbierta`.

### `GET /cajas/actual`

Rol: `cajero`. Responde `200` con la caja abierta del cajero, o `404 CajaNoAbierta` si no tiene.

### `POST /cajas/cerrar`

Rol: `cajero`. Cierra la caja y calcula la diferencia del arqueo.

Cuerpo:

```json
{ "montoContadoCentavos": 50000 }
```

Responde `200` con el arqueo: `esperado`, `contado`, `diferencia`, `cerradaPor` y `fechaCierre`.

## Ventas

### `POST /ventas`

Rol: `cajero`. Requiere `Idempotency-Key`. Registra una venta en la caja abierta del cajero.

Cuerpo:

```json
{
  "items": [{ "productoId": "prod-5", "cantidad": 1 }],
  "pagos": [{ "medio": "efectivo", "montoCentavos": 198000 }]
}
```

- `medio` es `efectivo`, `tarjeta` o `transferencia`.
- La suma de los pagos tiene que coincidir con el total de la venta, que ya viene con los descuentos aplicados (ver ADR 0001). Si no coincide, responde `422 PagosNoCuadran`.

Responde `201` con la venta: `id`, `cajaId`, `cajeroId`, `items`, `pagos`, `descuentoCentavos`, `totalCentavos` y `fecha`.

### `GET /ventas/:id`

Rol: `cajero`. Responde `200` con la venta si la registró ese cajero. Si no, responde `404 VentaNoEncontrada`.

### `POST /ventas/:id/anulacion`

Rol: `supervisor`. Requiere `Idempotency-Key`. Anula la venta indicada.

Cuerpo:

```json
{ "motivo": "Error de carga" }
```

- `motivo` es obligatorio, no puede estar vacío y tiene como máximo 255 caracteres.

Efectos: restituye el stock de cada ítem, registra un movimiento de anulación por cada pago en la caja de la venta y guarda la anulación. La venta original no se modifica.

Responde `201` con la anulación:

```json
{
  "id": "id-12",
  "ventaId": "id-7",
  "supervisorId": "sup-1",
  "motivo": "Error de carga",
  "fecha": "2026-11-25T10:00:00.000Z"
}
```

Errores específicos:

- `403 SinPermiso` si el rol no es `supervisor`. Un cajero recibe esta respuesta aunque la venta exista.
- `404 VentaNoEncontrada` si la venta no existe.
- `409 VentaYaAnulada` si la venta ya tiene una anulación, aunque la clave de idempotencia sea distinta.
- `409 CajaNoAbierta` si la caja de la venta está cerrada.
- `400 SolicitudInvalida` si falta `Idempotency-Key` o `motivo`.
