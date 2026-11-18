import {
  DatosInvalidos,
  PagosNoCuadran,
} from './errores.js';
import {
  exigirCentavosPositivos,
  multiplicarCentavos,
  sumarCentavos,
} from './dinero.js';

const MEDIOS_DE_PAGO = new Set(['efectivo', 'tarjeta', 'transferencia']);

export class Venta {
  constructor({ id, cajaId, cajeroId, items, pagos, totalCentavos, fecha }) {
    this.id = id;
    this.cajaId = cajaId;
    this.cajeroId = cajeroId;
    this.items = items;
    this.pagos = pagos;
    this.totalCentavos = totalCentavos;
    this.fecha = fecha;

    Object.freeze(this.items);
    Object.freeze(this.pagos);
    Object.freeze(this);
  }

  static crear({ id, cajaId, cajeroId, items, pagos, fecha }) {
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

      return Object.freeze({
        productoId: item.productoId,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnitarioCentavos: item.precioUnitarioCentavos,
        subtotalCentavos,
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

    const totalCentavos = sumarCentavos(
      itemsNormalizados.map((item) => item.subtotalCentavos),
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
      fecha,
    });
  }
}
