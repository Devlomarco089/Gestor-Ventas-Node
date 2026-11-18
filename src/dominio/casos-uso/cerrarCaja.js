import { CajaNoAbierta } from '../errores.js';
import { exigirCentavosNoNegativos } from '../dinero.js';
import { exigirCajero } from '../permisos.js';

export async function cerrarCaja(
  { repositorioCajas, reloj },
  { usuario, montoContadoCentavos },
) {
  exigirCajero(usuario);
  exigirCentavosNoNegativos(montoContadoCentavos, 'montoContadoCentavos');

  const caja = await repositorioCajas.obtenerAbiertaPorCajero(usuario.id);

  if (!caja) {
    throw new CajaNoAbierta('No tenés una caja abierta para cerrar.');
  }

  const cierre = caja.cerrar({
    montoContadoCentavos,
    cerradaPor: usuario.id,
    fecha: reloj.ahora(),
  });

  await repositorioCajas.guardar(caja);

  return cierre;
}
