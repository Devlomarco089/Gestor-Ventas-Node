import { VentaNoEncontrada } from '../errores.js';
import { exigirCajero } from '../permisos.js';

export async function obtenerVenta(
  { repositorioVentas },
  { usuario, ventaId },
) {
  exigirCajero(usuario);

  const venta = await repositorioVentas.obtenerPorId(ventaId);

  if (!venta || venta.cajeroId !== usuario.id) {
    throw new VentaNoEncontrada();
  }

  return venta;
}
