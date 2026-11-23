# ADR 0001 - Descuentos y carrera por la ultima unidad (parte de Franco)

## Descuentos

- Hay dos tipos de regla: `producto` (porcentaje fijo para un producto) y `cantidad` (porcentaje si se llevan al menos N unidades)
- Los porcentajes van en puntos basicos: 1000 bp = 10 %, asi no usamos decimales
- Si a una linea le sirven varias reglas gana la que mas descuenta, no se acumulan
- El redondeo es HALF-UP y se hace una sola vez por linea, no por unidad (el test `descuadre por redondeo` muestra que da distinto)
- Cada item guarda `subtotalCentavos` (precio x cantidad), `descuentoCentavos`, `reglaDescuentoId` y `totalCentavos`
- El total de la venta ya viene con el descuento restado y los pagos tienen que sumar exactamente eso, si no da `PagosNoCuadran` (422)
- Las reglas salen de un puerto `RepositorioDescuentos` con `listar()`, hoy en memoria con las reglas de `datosSemilla.js`

## Carrera por la ultima unidad

- Problema: Node tiene un solo hilo pero dos ventas se intercalan en cada `await`, las dos leen stock 1 y las dos venden
- Solucion: un puerto `Bloqueos` con `conBloqueo(claves, tarea)`, en memoria es una fila por clave
- `registrarVenta` bloquea `idempotencia:<clave>`, `caja:<cajero>` y `producto:<id>` de cada item
- Las claves se toman ordenadas para que no se trabe nadie (deadlock)
- Con base de datos esto se reemplaza por una transaccion con `SELECT ... FOR UPDATE` sobre los productos
- Tests en `tests/concurrencia/ultimaUnidad.test.js`: con bloqueos sale 1 venta y el stock queda en 0, sin bloqueos salen 2
