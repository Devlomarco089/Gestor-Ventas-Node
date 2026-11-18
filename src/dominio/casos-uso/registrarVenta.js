import {
  CajaNoAbierta,
  DatosInvalidos,
  IdempotenciaConflicto,
  ProductoNoEncontrado,
  StockInsuficiente,
  VentaNoEncontrada,
} from '../errores.js';
import { exigirCentavosPositivos } from '../dinero.js';
import { exigirCajero } from '../permisos.js';
import { Venta } from '../venta.js';

const MEDIOS_DE_PAGO = new Set(['efectivo', 'tarjeta', 'transferencia']);

function normalizarItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new DatosInvalidos('La venta debe tener al menos un ítem.');
  }

  return items.map((item) => {
    if (
      !item ||
      typeof item.productoId !== 'string' ||
      item.productoId.trim() === '' ||
      !Number.isSafeInteger(item.cantidad) ||
      item.cantidad <= 0
    ) {
      throw new DatosInvalidos('Cada ítem debe tener productoId y una cantidad entera positiva.');
    }

    return {
      productoId: item.productoId.trim(),
      cantidad: item.cantidad,
    };
  });
}

function normalizarPagos(pagos) {
  if (!Array.isArray(pagos) || pagos.length === 0) {
    throw new DatosInvalidos('La venta debe tener al menos un pago.');
  }

  return pagos.map((pago) => {
    if (!pago || !MEDIOS_DE_PAGO.has(pago.medio)) {
      throw new DatosInvalidos('El medio de pago no es válido.');
    }

    exigirCentavosPositivos(pago.montoCentavos, 'montoCentavos');

    return {
      medio: pago.medio,
      montoCentavos: pago.montoCentavos,
    };
  });
}

function agruparCantidades(items) {
  const cantidades = new Map();

  for (const item of items) {
    cantidades.set(
      item.productoId,
      (cantidades.get(item.productoId) ?? 0) + item.cantidad,
    );
  }

  return cantidades;
}

export async function registrarVenta(
  {
    repositorioProductos,
    repositorioCajas,
    repositorioVentas,
    almacenIdempotencia,
    generadorIds,
    reloj,
    // agregados por Franco, los dos son opcionales para no romper lo que ya andaba
    repositorioDescuentos = null,
    bloqueos = SIN_BLOQUEOS,
  },
  { usuario, claveIdempotencia, items, pagos },
) {
  exigirCajero(usuario);

  if (
    typeof claveIdempotencia !== 'string' ||
    claveIdempotencia.trim() === ''
  ) {
    throw new DatosInvalidos('La clave de idempotencia es obligatoria.');
  }

  const clave = claveIdempotencia.trim();
  const itemsNormalizados = normalizarItems(items);
  const pagosNormalizados = normalizarPagos(pagos);
  const huella = JSON.stringify({
    items: itemsNormalizados,
    pagos: pagosNormalizados,
  });

  // todo lo que sigue corre con los bloqueos tomados (Franco)
  // se bloquea la clave de idempotencia (dos reintentos a la vez no duplican), la caja del
  // cajero y cada producto (dos ventas de la ultima unidad no la venden dos veces)
  // el que llega segundo espera y cuando entra ya ve el stock descontado por el primero
  const claves = [
    `idempotencia:${clave}`,
    `caja:${usuario.id}`,
    ...itemsNormalizados.map((item) => `producto:${item.productoId}`),
  ];

  return bloqueos.conBloqueo(claves, () => registrarDentroDelBloqueo({
    repositorioProductos,
    repositorioCajas,
    repositorioVentas,
    almacenIdempotencia,
    generadorIds,
    reloj,
    repositorioDescuentos,
  }, { usuario, clave, huella, itemsNormalizados, pagosNormalizados }));
}

// si no pasan bloqueos se corre sin bloquear, sirve para el test que muestra el problema
const SIN_BLOQUEOS = {
  async conBloqueo(_claves, tarea) {
    return tarea();
  },
};

// esto es lo que ya estaba hecho, solo se movio aca adentro para que corra bloqueado
async function registrarDentroDelBloqueo(
  {
    repositorioProductos,
    repositorioCajas,
    repositorioVentas,
    almacenIdempotencia,
    generadorIds,
    reloj,
    repositorioDescuentos,
  },
  { usuario, clave, huella, itemsNormalizados, pagosNormalizados },
) {
  const registro = await almacenIdempotencia.obtener(clave);

  if (registro) {
    if (registro.cajeroId !== usuario.id || registro.huella !== huella) {
      throw new IdempotenciaConflicto();
    }

    const ventaGuardada = await repositorioVentas.obtenerPorId(registro.ventaId);

    if (!ventaGuardada) {
      throw new VentaNoEncontrada('No se encontró la venta asociada a la clave de idempotencia.');
    }

    return { venta: ventaGuardada, replay: true };
  }

  const caja = await repositorioCajas.obtenerAbiertaPorCajero(usuario.id);

  if (!caja) {
    throw new CajaNoAbierta('No tenés una caja abierta para vender.');
  }

  const cantidades = agruparCantidades(itemsNormalizados);
  const productos = await repositorioProductos.obtenerPorIds([...cantidades.keys()]);
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
  const itemsVenta = [];
  const productosActualizados = [];

  for (const [productoId, cantidad] of cantidades) {
    const producto = productosPorId.get(productoId);

    if (!producto) {
      throw new ProductoNoEncontrado(`No existe el producto "${productoId}".`);
    }

    if (!producto.tieneStock(cantidad)) {
      throw new StockInsuficiente(
        `Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock}, solicitado: ${cantidad}).`,
      );
    }

    itemsVenta.push({
      productoId: producto.id,
      nombre: producto.nombre,
      cantidad,
      precioUnitarioCentavos: producto.precioCentavos,
    });
    productosActualizados.push(producto.conStockDescontado(cantidad));
  }

  // reglas de descuento vigentes, si no hay repositorio no se descuenta nada (Franco)
  const reglasDescuento = repositorioDescuentos ? await repositorioDescuentos.listar() : [];

  const venta = Venta.crear({
    id: generadorIds.generar(),
    cajaId: caja.id,
    cajeroId: usuario.id,
    items: itemsVenta,
    pagos: pagosNormalizados,
    fecha: reloj.ahora(),
    reglasDescuento,
  });

  for (const producto of productosActualizados) {
    await repositorioProductos.guardar(producto);
  }

  for (const pago of venta.pagos) {
    caja.agregarPago({
      id: generadorIds.generar(),
      ventaId: venta.id,
      medio: pago.medio,
      montoCentavos: pago.montoCentavos,
      fecha: venta.fecha,
    });
  }

  await repositorioCajas.guardar(caja);
  await repositorioVentas.guardar(venta);
  await almacenIdempotencia.guardar(clave, {
    cajeroId: usuario.id,
    huella,
    ventaId: venta.id,
  });

  return { venta, replay: false };
}
