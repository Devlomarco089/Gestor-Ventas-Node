import { DatosInvalidos, StockInsuficiente } from './errores.js';

export class Producto {
  constructor({ id, nombre, precioCentavos, stock }) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new DatosInvalidos('El id del producto es obligatorio.');
    }

    if (typeof nombre !== 'string' || nombre.trim() === '') {
      throw new DatosInvalidos('El nombre del producto es obligatorio.');
    }

    if (!Number.isSafeInteger(precioCentavos) || precioCentavos <= 0) {
      throw new DatosInvalidos('El precio del producto debe ser un entero positivo en centavos.');
    }

    if (!Number.isSafeInteger(stock) || stock < 0) {
      throw new DatosInvalidos('El stock del producto debe ser un entero no negativo.');
    }

    this.id = id;
    this.nombre = nombre;
    this.precioCentavos = precioCentavos;
    this.stock = stock;

    Object.freeze(this);
  }

  tieneStock(cantidad) {
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
      throw new DatosInvalidos('La cantidad debe ser un entero positivo.');
    }

    return this.stock >= cantidad;
  }

  conStockDescontado(cantidad) {
    if (!this.tieneStock(cantidad)) {
      throw new StockInsuficiente(
        `Stock insuficiente para "${this.nombre}" (disponible: ${this.stock}, solicitado: ${cantidad}).`,
      );
    }

    return new Producto({
      id: this.id,
      nombre: this.nombre,
      precioCentavos: this.precioCentavos,
      stock: this.stock - cantidad,
    });
  }
}
