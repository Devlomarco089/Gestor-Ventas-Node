import { exigirCajero } from '../permisos.js';

export async function obtenerCajaActual({ repositorioCajas }, { usuario }) {
  exigirCajero(usuario);

  return repositorioCajas.obtenerAbiertaPorCajero(usuario.id);
}
