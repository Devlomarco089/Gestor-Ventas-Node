import { abrirCaja } from './dominio/casos-uso/abrirCaja.js';
import { anularVenta } from './dominio/casos-uso/anularVenta.js';
import { cerrarCaja } from './dominio/casos-uso/cerrarCaja.js';
import { obtenerCajaActual } from './dominio/casos-uso/obtenerCajaActual.js';
import { obtenerVenta } from './dominio/casos-uso/obtenerVenta.js';
import { registrarVenta } from './dominio/casos-uso/registrarVenta.js';
import { Producto } from './dominio/producto.js';
import { crearGeneradorIds } from './infra/generadorIds.js';
import { crearAlmacenIdempotenciaMemoria } from './infra/memoria/almacenIdempotenciaMemoria.js';
import { crearBloqueosMemoria } from './infra/memoria/bloqueosMemoria.js';
import { datosSemilla, reglasDescuentoSemilla } from './infra/memoria/datosSemilla.js';
import { crearRepositorioAnulacionesMemoria } from './infra/memoria/repositorioAnulacionesMemoria.js';
import { crearRepositorioDescuentosMemoria } from './infra/memoria/repositorioDescuentosMemoria.js';
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
  const repositorioAnulaciones = crearRepositorioAnulacionesMemoria();
  const almacenIdempotencia = crearAlmacenIdempotenciaMemoria();
  const generadorIds = crearGeneradorIds();
  const reloj = crearRelojSistema();
  // parte de Franco: reglas de descuento y bloqueos para la carrera de la ultima unidad
  const repositorioDescuentos = crearRepositorioDescuentosMemoria(reglasDescuentoSemilla);
  const bloqueos = crearBloqueosMemoria();

  const dependencias = {
    repositorioProductos,
    repositorioCajas,
    repositorioVentas,
    repositorioAnulaciones,
    almacenIdempotencia,
    generadorIds,
    reloj,
    repositorioDescuentos,
    bloqueos,
  };

  return {
    abrirCaja: (datos) => abrirCaja(dependencias, datos),
    registrarVenta: (datos) => registrarVenta(dependencias, datos),
    anularVenta: (datos) => anularVenta(dependencias, datos),
    cerrarCaja: (datos) => cerrarCaja(dependencias, datos),
    obtenerCajaActual: (datos) => obtenerCajaActual(dependencias, datos),
    obtenerVenta: (datos) => obtenerVenta(dependencias, datos),
  };
}
