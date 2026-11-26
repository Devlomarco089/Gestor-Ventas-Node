import { Anulacion } from '../anulacion.js';
import { Caja } from '../caja.js';
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

// igual que en registrarVenta: si no llegan bloqueos, se corre sin bloquear
const SIN_BLOQUEOS = {
  async conBloqueo(_claves, tarea) {
    return tarea();
  },
};

export async function anularVenta(dependencias, { usuario, claveIdempotencia, ventaId, motivo }) {
  exigirSupervisor(usuario);

  if (typeof claveIdempotencia !== 'string' || claveIdempotencia.trim() === '') {
    throw new DatosInvalidos('La clave de idempotencia es obligatoria.');
  }

  const clave = `${PREFIJO_IDEMPOTENCIA}${claveIdempotencia.trim()}`;
  const motivoLimpio = Anulacion.exigirMotivo(motivo);
  const huella = JSON.stringify({ ventaId, motivo: motivoLimpio });

  // la venta es inmutable, así que leerla sin bloqueo sirve para saber qué claves tomar
  const ventaInicial = await dependencias.repositorioVentas.obtenerPorId(ventaId);

  if (!ventaInicial) {
    throw new VentaNoEncontrada('La venta no existe.');
  }

  // se bloquean: la clave de idempotencia, la venta (una sola anulación), la caja del cajero
  // que hizo la venta (la misma clave que usa registrarVenta) y cada producto de la venta
  const claves = [
    clave,
    `venta:${ventaInicial.id}`,
    `caja:${ventaInicial.cajeroId}`,
    ...ventaInicial.items.map((item) => `producto:${item.productoId}`),
  ];

  const bloqueos = dependencias.bloqueos ?? SIN_BLOQUEOS;

  return bloqueos.conBloqueo(claves, () =>
    anularDentroDelBloqueo(dependencias, { usuario, clave, ventaId, huella, motivo: motivoLimpio }),
  );
}

async function anularDentroDelBloqueo(
  {
    repositorioVentas,
    repositorioCajas,
    repositorioProductos,
    repositorioAnulaciones,
    almacenIdempotencia,
    generadorIds,
    reloj,
  },
  { usuario, clave, ventaId, huella, motivo },
) {
  const registro = await almacenIdempotencia.obtener(clave);

  if (registro) {
    if (registro.cajeroId !== usuario.id || registro.huella !== huella) {
      throw new IdempotenciaConflicto();
    }

    const anulacion = await repositorioAnulaciones.obtenerPorVentaId(registro.ventaId);

    return { anulacion, replay: true };
  }

  const venta = await repositorioVentas.obtenerPorId(ventaId);

  if (await repositorioAnulaciones.obtenerPorVentaId(venta.id)) {
    throw new VentaYaAnulada();
  }

  const cajaOriginal = await repositorioCajas.obtenerPorId(venta.cajaId);

  if (!cajaOriginal) {
    throw new VentaNoEncontrada('No se encontró la caja de la venta.');
  }

  if (!cajaOriginal.estaAbierta) {
    throw new CajaNoAbierta('La caja de la venta está cerrada y no admite anulaciones.');
  }

  // se trabaja sobre una copia de la caja: si algo falla después, la original no cambió
  const cajaNueva = new Caja({
    id: cajaOriginal.id,
    cajeroId: cajaOriginal.cajeroId,
    montoInicialCentavos: cajaOriginal.montoInicialCentavos,
    estado: cajaOriginal.estado,
    movimientos: cajaOriginal.movimientos,
    cierre: cajaOriginal.cierre,
  });

  // todas las validaciones van antes de la primera escritura
  const productosOriginales = [];
  const productosNuevos = [];

  for (const item of venta.items) {
    const producto = await repositorioProductos.obtenerPorId(item.productoId);

    if (!producto) {
      throw new ProductoNoEncontrado(`No existe el producto "${item.productoId}".`);
    }

    productosOriginales.push(producto);
    productosNuevos.push(producto.conStockRestituido(item.cantidad));
  }

  const anulacion = Anulacion.crear({
    id: generadorIds.generar(),
    ventaId: venta.id,
    supervisorId: usuario.id,
    motivo,
    fecha: reloj.ahora(),
  });

  for (const pago of venta.pagos) {
    cajaNueva.anularPago({
      id: generadorIds.generar(),
      ventaId: venta.id,
      medio: pago.medio,
      montoCentavos: pago.montoCentavos,
      fecha: anulacion.fecha,
    });
  }

  // escrituras: si una falla, se vuelve a guardar lo que estaba antes de cada una
  const deshacer = [];

  try {
    for (const [indice, producto] of productosNuevos.entries()) {
      deshacer.push(() => repositorioProductos.guardar(productosOriginales[indice]));
      await repositorioProductos.guardar(producto);
    }

    deshacer.push(() => repositorioCajas.guardar(cajaOriginal));
    await repositorioCajas.guardar(cajaNueva);

    deshacer.push(() => repositorioAnulaciones.eliminarPorVentaId(venta.id));
    await repositorioAnulaciones.guardar(anulacion);

    await almacenIdempotencia.guardar(clave, {
      cajeroId: usuario.id,
      huella,
      ventaId: venta.id,
    });
  } catch (error) {
    for (const revertir of deshacer.reverse()) {
      await revertir();
    }

    throw error;
  }

  return { anulacion, replay: false };
}
