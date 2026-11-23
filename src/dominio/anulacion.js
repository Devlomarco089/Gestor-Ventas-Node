import { DatosInvalidos } from './errores.js';

export const LONGITUD_MAXIMA_MOTIVO = 255;

export class Anulacion {
  constructor({ id, ventaId, supervisorId, motivo, fecha }) {
    this.id = id;
    this.ventaId = ventaId;
    this.supervisorId = supervisorId;
    this.motivo = motivo;
    this.fecha = fecha;

    Object.freeze(this);
  }

  static exigirMotivo(motivo) {
    if (typeof motivo !== 'string' || motivo.trim() === '') {
      throw new DatosInvalidos('El motivo de la anulación es obligatorio.');
    }

    const motivoLimpio = motivo.trim();

    if (motivoLimpio.length > LONGITUD_MAXIMA_MOTIVO) {
      throw new DatosInvalidos(
        `El motivo no puede superar los ${LONGITUD_MAXIMA_MOTIVO} caracteres.`,
      );
    }

    return motivoLimpio;
  }

  static crear({ id, ventaId, supervisorId, motivo, fecha }) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new DatosInvalidos('El id de la anulación es obligatorio.');
    }

    if (typeof ventaId !== 'string' || ventaId.trim() === '') {
      throw new DatosInvalidos('La anulación debe tener una venta asociada.');
    }

    if (typeof supervisorId !== 'string' || supervisorId.trim() === '') {
      throw new DatosInvalidos('La anulación debe tener un supervisor.');
    }

    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
      throw new DatosInvalidos('La fecha de la anulación no es válida.');
    }

    return new Anulacion({
      id,
      ventaId,
      supervisorId,
      motivo: Anulacion.exigirMotivo(motivo),
      fecha,
    });
  }
}
