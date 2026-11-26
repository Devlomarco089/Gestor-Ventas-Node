# Gestor de Ventas - Backend

Trabajo práctico universitario. Backend con Node.js 22, Express 5 y arquitectura hexagonal.

## Cómo arrancar

```bash
cp .env.example .env
npm install
npm run dev
```

## Tests

```bash
npm test
```

Corre los tests de dominio, de concurrencia y de integración.

## Qué hace

Registra ventas con descuentos por reglas, controla la caja de cada cajero (apertura, cierre y arqueo) y permite que un supervisor anule una venta con un motivo. La venta original no se modifica: la anulación restituye el stock y revierte los pagos en la caja.

## Roles

| Acción | cajero | supervisor |
| --- | --- | --- |
| Abrir, consultar y cerrar su caja | Sí | No |
| Registrar una venta | Sí | No |
| Consultar una venta propia | Sí | No |
| Anular una venta | No (403) | Sí |

Todavía no hay roles de administrador ni vendedor. Esta tabla se revisa con el grupo.

## Usuarios de prueba

Hoy la autenticación es temporal: el cliente manda los encabezados `X-Usuario-Id` y `X-Rol`. Cualquier valor sirve; por ejemplo, `cajero-1` con rol `cajero`, o `sup-1` con rol `supervisor`.

## Documentación

- [API](docs/api.md): endpoints, encabezados, errores y ejemplos.
- [Modelo de dominio](docs/modelo.md): entidades, invariantes y estados.
- [ADR 0001](docs/adr/0001-descuentos-y-bloqueos.md): descuentos y carrera por la última unidad.
- [ADR 0002](docs/adr/0002-anulacion-registro-aparte.md): anulación con registro aparte.
- [Demo de anulación](docs/demo-anulacion.http): requests para probar la anulación desde VS Code (extensión REST Client) o similar.
