import { Router } from 'express';

import { ErrorHttp } from './errores.js';
import { validarApertura, validarCierre } from './validacion.js';

function serializarCaja(caja) {
  return {
    id: caja.id,
    cajeroId: caja.cajeroId,
    montoInicialCentavos: caja.montoInicialCentavos,
    estado: caja.estado,
    movimientos: caja.movimientos,
    montoEsperadoCentavos: caja.calcularMontoEsperadoCentavos(),
    ...(caja.cierre ? { cierre: caja.cierre } : {}),
  };
}

export function crearRutasCajas({ abrirCaja, cerrarCaja, obtenerCajaActual }) {
  const router = Router();

  router.post('/abrir', async (req, res) => {
    const { montoInicialCentavos } = validarApertura(req.body);
    const caja = await abrirCaja({
      usuario: req.usuario,
      montoInicialCentavos,
    });

    res.status(201).json(serializarCaja(caja));
  });

  router.get('/actual', async (req, res) => {
    const caja = await obtenerCajaActual({ usuario: req.usuario });

    if (!caja) {
      throw new ErrorHttp(404, 'CajaNoAbierta', 'No tenés una caja abierta.');
    }

    res.json(serializarCaja(caja));
  });

  router.post('/cerrar', async (req, res) => {
    const { montoContadoCentavos } = validarCierre(req.body);
    const cierre = await cerrarCaja({
      usuario: req.usuario,
      montoContadoCentavos,
    });

    res.json(cierre);
  });

  return router;
}
