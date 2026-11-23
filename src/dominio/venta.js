import {
  DatosInvalidos,
  PagosNoCuadran,
} from './errores.js';
import {
  exigirCentavosPositivos,
  multiplicarCentavos,
  sumarCentavos,
} from './dinero.js';
import { mejorDescuento } from './descuentos.js';

const MEDIOS_DE_PAGO = new Set(['efectivo', 'tarjeta', 'transferencia']);

export class Venta {
  constructor({ id, cajaId, cajeroId, items, pagos, totalCentavos, descuentoCentavos = 0, fecha }) {
    this.id = id;
    this.cajaId = cajaId;
    this.cajeroId = cajeroId;
    this.items = items;
    this.pagos = pagos;
    this.totalCentavos = totalCentavos;
    // cuanto se desconto en total por reglas de descuento (Franco)
    this.descuentoCentavos = descuentoCentavos;
    this.fecha = fecha;

    Object.freeze(this.items);
    Object.freeze(this.pagos);
    Object.freeze(this);
  }

  // reglasDescuento es opcional, si no viene la venta queda igual que antes sin descuentos
  static crear({ id, cajaId, cajeroId, items, pagos, fecha, reglasDescuento = [] }) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new DatosInvalidos('El id de la venta es obligatorio.');
    }

    if (typeof cajaId !== 'string' || cajaId.trim() === '' || typeof cajeroId !== 'string' || cajeroId.trim() === '') {
      throw new DatosInvalidos('La venta debe tener caja y cajero.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new DatosInvalidos('La venta debe tener al menos un ítem.');
    }

    if (!Array.isArray(pagos) || pagos.length === 0) {
      throw new DatosInvalidos('La venta debe tener al menos un pago.');
    }

    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
      throw new DatosInvalidos('La fecha de la venta no es válida.');
    }

    const itemsNormalizados = items.map((item) => {
      if (typeof item.productoId !== 'string' || item.productoId.trim() === '') {
        throw new DatosInvalidos('El producto del ítem es obligatorio.');
      }

      if (typeof item.nombre !== 'string' || item.nombre.trim() === '') {
        throw new DatosInvalidos('El nombre del ítem es obligatorio.');
      }

      const subtotalCentavos = multiplicarCentavos(item.precioUnitarioCentavos, item.cantidad);

      // descuento de la linea: se elige la mejor regla que aplique (Franco)
      const { descuentoCentavos, reglaDescuentoId } = mejorDescuento(
        { productoId: item.productoId, cantidad: item.cantidad, subtotalCentavos },
        reglasDescuento,
      );

      return Object.freeze({
        productoId: item.productoId,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnitarioCentavos: item.precioUnitarioCentavos,
        subtotalCentavos,
        descuentoCentavos,
        reglaDescuentoId,
        // lo que realmente se cobra por esta linea
        totalCentavos: subtotalCentavos - descuentoCentavos,
      });
    });

    const pagosNormalizados = pagos.map((pago) => {
      if (!MEDIOS_DE_PAGO.has(pago.medio)) {
        throw new DatosInvalidos(`El medio de pago "${pago.medio}" no es válido.`);
      }

      exigirCentavosPositivos(pago.montoCentavos, 'montoCentavos');

      return Object.freeze({
        medio: pago.medio,
        montoCentavos: pago.montoCentavos,
      });
    });

    // el total de la venta ya viene con los descuentos restados (Franco)
    const totalCentavos = sumarCentavos(
      itemsNormalizados.map((item) => item.totalCentavos),
    );
    const descuentoCentavos = sumarCentavos(
      itemsNormalizados.map((item) => item.descuentoCentavos),
    );
    const totalPagosCentavos = sumarCentavos(
      pagosNormalizados.map((pago) => pago.montoCentavos),
    );

    if (totalPagosCentavos !== totalCentavos) {
      throw new PagosNoCuadran(
        `La suma de los pagos (${totalPagosCentavos}) no coincide con el total (${totalCentavos}).`,
      );
    }

    return new Venta({
      id,
      cajaId,
      cajeroId,
      items: Object.freeze(itemsNormalizados),
      pagos: Object.freeze(pagosNormalizados),
      totalCentavos,
      descuentoCentavos,
      fecha,
    });
  }
}
