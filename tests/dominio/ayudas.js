import { abrirCaja } from '../../src/dominio/casos-uso/abrirCaja.js';
import { anularVenta } from '../../src/dominio/casos-uso/anularVenta.js';
import { cerrarCaja } from '../../src/dominio/casos-uso/cerrarCaja.js';
import { obtenerCajaActual } from '../../src/dominio/casos-uso/obtenerCajaActual.js';
import { obtenerVenta } from '../../src/dominio/casos-uso/obtenerVenta.js';
import { registrarVenta } from '../../src/dominio/casos-uso/registrarVenta.js';
import { Producto } from '../../src/dominio/producto.js';
import { crearAlmacenIdempotenciaMemoria } from '../../src/infra/memoria/almacenIdempotenciaMemoria.js';
import { crearRepositorioAnulacionesMemoria } from '../../src/infra/memoria/repositorioAnulacionesMemoria.js';
import { crearRepositorioCajasMemoria } from '../../src/infra/memoria/repositorioCajasMemoria.js';
import { crearRepositorioProductosMemoria } from '../../src/infra/memoria/repositorioProductosMemoria.js';
import { crearRepositorioVentasMemoria } from '../../src/infra/memoria/repositorioVentasMemoria.js';

export const productosPrueba = [
  { id: 'prod-1', nombre: 'Producto 1', precioCentavos: 1000, stock: 10 },
  { id: 'prod-2', nombre: 'Producto 2', precioCentavos: 250, stock: 5 },
  { id: 'prod-3', nombre: 'Producto 3', precioCentavos: 300, stock: 2 },
];

export const cajero = { id: 'cajero-1', rol: 'cajero' };
export const otroCajero = { id: 'cajero-2', rol: 'cajero' };
export const admin = { id: 'admin-1', rol: 'admin' };

export const ventaBase = {
  items: [
    { productoId: 'prod-1', cantidad: 2 },
    { productoId: 'prod-2', cantidad: 1 },
  ],
  pagos: [
    { medio: 'efectivo', montoCentavos: 1500 },
    { medio: 'tarjeta', montoCentavos: 750 },
  ],
};

export async function obtenerStocks(contexto, ids = ['prod-1', 'prod-2', 'prod-3']) {
  const productos = await Promise.all(
    ids.map((id) => contexto.repositorioProductos.obtenerPorId(id)),
  );

  return Object.fromEntries(productos.map((producto) => [producto.id, producto.stock]));
}

export function crearContexto({
  ahora = new Date('2026-01-01T10:00:00.000Z'),
} = {}) {
  let secuencia = 0;

  const generadorIds = {
    generar() {
      secuencia += 1;
      return `id-${secuencia}`;
    },
  };
  const reloj = {
    ahora() {
      return new Date(ahora);
    },
  };
  const repositorioProductos = crearRepositorioProductosMemoria(
    productosPrueba.map((producto) => new Producto(producto)),
  );
  const repositorioCajas = crearRepositorioCajasMemoria();
  const repositorioVentas = crearRepositorioVentasMemoria();
  const repositorioAnulaciones = crearRepositorioAnulacionesMemoria();
  const almacenIdempotencia = crearAlmacenIdempotenciaMemoria();

  const dependencias = {
    repositorioProductos,
    repositorioCajas,
    repositorioVentas,
    repositorioAnulaciones,
    almacenIdempotencia,
    generadorIds,
    reloj,
  };

  return {
    repositorioProductos,
    repositorioCajas,
    repositorioVentas,
    repositorioAnulaciones,
    almacenIdempotencia,
    abrirCaja: (datos) => abrirCaja(dependencias, datos),
    registrarVenta: (datos) => registrarVenta(dependencias, datos),
    anularVenta: (datos) => anularVenta(dependencias, datos),
    cerrarCaja: (datos) => cerrarCaja(dependencias, datos),
    obtenerCajaActual: (datos) => obtenerCajaActual(dependencias, datos),
    obtenerVenta: (datos) => obtenerVenta(dependencias, datos),
  };
}
