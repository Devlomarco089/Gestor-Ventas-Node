import { Anulacion } from '../anulacion.js';
import {
  CajaNoAbierta,
  DatosInvalidos,
  IdempotenciaConflicto,
  ProductoNoEncontrado,
  VentaNoEncontrada,
  VentaYaAnulada,
} from '../errores.js';
import { exigirSupervisor } from '../permisos.js';

const PREFIJO_IDEMPOTENCIA = 'anulacion:';

export async function anularVenta(
  {
    repositorioVentas,
    repositorioCajas,
    repositorioProductos,
    repositorioAnulaciones,
    almacenIdempotencia,
    generadorIds,
    reloj,
  },
  { usuario, claveIdempotencia, ventaId, motivo },
) {
  exigirSupervisor(usuario);

  if (typeof claveIdempotencia !== 'string' || claveIdempotencia.trim() === '') {
    throw new DatosInvalidos('La clave de idempotencia es obligatoria.');
  }

  const clave = `${PREFIJO_IDEMPOTENCIA}${claveIdempotencia.trim()}`;
  const motivoLimpio = Anulacion.exigirMotivo(motivo);
  const huella = JSON.stringify({ ventaId, motivo: motivoLimpio });

  const registro = await almacenIdempotencia.obtener(clave);

  if (registro) {
    if (registro.cajeroId !== usuario.id || registro.huella !== huella) {
      throw new IdempotenciaConflicto();
    }

    const anulacion = await repositorioAnulaciones.obtenerPorVentaId(registro.ventaId);

    return { anulacion, replay: true };
  }

  const venta = await repositorioVentas.obtenerPorId(ventaId);

  if (!venta) {
    throw new VentaNoEncontrada('La venta no existe.');
  }

  if (await repositorioAnulaciones.obtenerPorVentaId(venta.id)) {
    throw new VentaYaAnulada();
  }

  const caja = await repositorioCajas.obtenerPorId(venta.cajaId);

  if (!caja) {
    throw new VentaNoEncontrada('No se encontró la caja de la venta.');
  }

  if (!caja.estaAbierta) {
    throw new CajaNoAbierta('La caja de la venta está cerrada y no admite anulaciones.');
  }

  // Todas las validaciones van antes de cualquier escritura.
  const productosActualizados = [];

  for (const item of venta.items) {
    const producto = await repositorioProductos.obtenerPorId(item.productoId);

    if (!producto) {
      throw new ProductoNoEncontrado(`No existe el producto "${item.productoId}".`);
    }

    productosActualizados.push(producto.conStockRestituido(item.cantidad));
  }

  const anulacion = Anulacion.crear({
    id: generadorIds.generar(),
    ventaId: venta.id,
    supervisorId: usuario.id,
    motivo: motivoLimpio,
    fecha: reloj.ahora(),
  });

  for (const pago of venta.pagos) {
    caja.anularPago({
      id: generadorIds.generar(),
      ventaId: venta.id,
      medio: pago.medio,
      montoCentavos: pago.montoCentavos,
      fecha: anulacion.fecha,
    });
  }

  for (const producto of productosActualizados) {
    await repositorioProductos.guardar(producto);
  }

  await repositorioCajas.guardar(caja);
  await repositorioAnulaciones.guardar(anulacion);
  await almacenIdempotencia.guardar(clave, {
    cajeroId: usuario.id,
    huella,
    ventaId: venta.id,
  });

  return { anulacion, replay: false };
}
