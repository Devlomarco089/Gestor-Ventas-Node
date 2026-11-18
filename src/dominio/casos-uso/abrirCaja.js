import { Caja } from '../caja.js';
import { CajaYaAbierta } from '../errores.js';
import { exigirCentavosNoNegativos } from '../dinero.js';
import { exigirCajero } from '../permisos.js';

export async function abrirCaja(
  { repositorioCajas, generadorIds, reloj },
  { usuario, montoInicialCentavos },
) {
  exigirCajero(usuario);
  exigirCentavosNoNegativos(montoInicialCentavos, 'montoInicialCentavos');

  const cajaAbierta = await repositorioCajas.obtenerAbiertaPorCajero(usuario.id);

  if (cajaAbierta) {
    throw new CajaYaAbierta();
  }

  const caja = Caja.abrir({
    id: generadorIds.generar(),
    cajeroId: usuario.id,
    montoInicialCentavos,
    fecha: reloj.ahora(),
    movimientoId: generadorIds.generar(),
  });

  await repositorioCajas.guardar(caja);

  return caja;
}
