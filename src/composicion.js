import { abrirCaja } from './dominio/casos-uso/abrirCaja.js';
import { cerrarCaja } from './dominio/casos-uso/cerrarCaja.js';
import { obtenerCajaActual } from './dominio/casos-uso/obtenerCajaActual.js';
import { obtenerVenta } from './dominio/casos-uso/obtenerVenta.js';
import { registrarVenta } from './dominio/casos-uso/registrarVenta.js';
import { Producto } from './dominio/producto.js';
import { crearGeneradorIds } from './infra/generadorIds.js';
import { crearAlmacenIdempotenciaMemoria } from './infra/memoria/almacenIdempotenciaMemoria.js';
import { datosSemilla } from './infra/memoria/datosSemilla.js';
import { crearRepositorioCajasMemoria } from './infra/memoria/repositorioCajasMemoria.js';
import { crearRepositorioProductosMemoria } from './infra/memoria/repositorioProductosMemoria.js';
import { crearRepositorioVentasMemoria } from './infra/memoria/repositorioVentasMemoria.js';
import { crearRelojSistema } from './infra/reloj.js';

export function crearComposicion() {
  const repositorioProductos = crearRepositorioProductosMemoria(
    datosSemilla.map((producto) => new Producto(producto)),
  );
  const repositorioCajas = crearRepositorioCajasMemoria();
  const repositorioVentas = crearRepositorioVentasMemoria();
  const almacenIdempotencia = crearAlmacenIdempotenciaMemoria();
  const generadorIds = crearGeneradorIds();
  const reloj = crearRelojSistema();

  const dependencias = {
    repositorioProductos,
    repositorioCajas,
    repositorioVentas,
    almacenIdempotencia,
    generadorIds,
    reloj,
  };

  return {
    abrirCaja: (datos) => abrirCaja(dependencias, datos),
    registrarVenta: (datos) => registrarVenta(dependencias, datos),
    cerrarCaja: (datos) => cerrarCaja(dependencias, datos),
    obtenerCajaActual: (datos) => obtenerCajaActual(dependencias, datos),
    obtenerVenta: (datos) => obtenerVenta(dependencias, datos),
  };
}
