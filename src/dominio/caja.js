import {
  CajaNoAbierta,
  DatosInvalidos,
} from './errores.js';
import {
  exigirCentavosNoNegativos,
  exigirCentavosPositivos,
  restarCentavos,
  sumarCentavos,
} from './dinero.js';

const MEDIOS_DE_PAGO = new Set(['efectivo', 'tarjeta', 'transferencia']);
const ESTADOS = new Set(['abierta', 'cerrada']);

export class Caja {
  constructor({
    id,
    cajeroId,
    montoInicialCentavos,
    estado = 'abierta',
    movimientos = [],
    cierre = null,
  }) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new DatosInvalidos('El id de la caja es obligatorio.');
    }

    if (typeof cajeroId !== 'string' || cajeroId.trim() === '') {
      throw new DatosInvalidos('El cajero de la caja es obligatorio.');
    }

    exigirCentavosNoNegativos(montoInicialCentavos, 'montoInicialCentavos');

    if (!ESTADOS.has(estado)) {
      throw new DatosInvalidos('El estado de la caja no es válido.');
    }

    if (!Array.isArray(movimientos)) {
      throw new DatosInvalidos('Los movimientos de la caja deben ser un arreglo.');
    }

    this.id = id;
    this.cajeroId = cajeroId;
    this.montoInicialCentavos = montoInicialCentavos;
    this.estado = estado;
    this.movimientos = movimientos.map((movimiento) => ({ ...movimiento }));
    this.cierre = cierre ? { ...cierre } : null;
  }

  static abrir({ id, cajeroId, montoInicialCentavos, fecha, movimientoId }) {
    const caja = new Caja({ id, cajeroId, montoInicialCentavos });

    caja.movimientos.push({
      id: movimientoId,
      tipo: 'apertura',
      medio: 'efectivo',
      montoCentavos: montoInicialCentavos,
      fecha,
    });

    return caja;
  }

  get estaAbierta() {
    return this.estado === 'abierta';
  }

  calcularMontoEsperadoCentavos() {
    return sumarCentavos(
      this.movimientos
        .filter((movimiento) => movimiento.medio === 'efectivo')
        .map((movimiento) => movimiento.montoCentavos),
    );
  }

  agregarPago({ id, ventaId, medio, montoCentavos, fecha }) {
    if (!this.estaAbierta) {
      throw new CajaNoAbierta('La caja está cerrada y no admite movimientos.');
    }

    if (!MEDIOS_DE_PAGO.has(medio)) {
      throw new DatosInvalidos(`El medio de pago "${medio}" no es válido.`);
    }

    exigirCentavosPositivos(montoCentavos, 'montoCentavos');

    if (typeof id !== 'string' || id.trim() === '' || typeof ventaId !== 'string' || ventaId.trim() === '') {
      throw new DatosInvalidos('El movimiento debe tener id y venta asociada.');
    }

    this.movimientos.push({
      id,
      tipo: 'pago',
      ventaId,
      medio,
      montoCentavos,
      fecha,
    });
  }

  cerrar({ montoContadoCentavos, cerradaPor, fecha }) {
    if (!this.estaAbierta) {
      throw new CajaNoAbierta('La caja ya está cerrada.');
    }

    exigirCentavosNoNegativos(montoContadoCentavos, 'montoContadoCentavos');

    if (typeof cerradaPor !== 'string' || cerradaPor.trim() === '') {
      throw new DatosInvalidos('El id de quien cierra la caja es obligatorio.');
    }

    const esperadoCentavos = this.calcularMontoEsperadoCentavos();
    const diferenciaCentavos = restarCentavos(montoContadoCentavos, esperadoCentavos);

    this.estado = 'cerrada';
    this.cierre = {
      esperadoCentavos,
      contadoCentavos: montoContadoCentavos,
      diferenciaCentavos,
      cerradaPor,
      fechaCierre: fecha,
    };

    return {
      esperado: esperadoCentavos,
      contado: montoContadoCentavos,
      diferencia: diferenciaCentavos,
      cerradaPor,
      fechaCierre: fecha,
    };
  }
}
