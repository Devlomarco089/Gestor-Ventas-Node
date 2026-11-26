import { Router } from 'express';

import {
  validarAnulacion,
  validarIdVenta,
  validarIdempotencyKey,
  validarVenta,
} from './validacion.js';

function serializarVenta(venta) {
  return {
    id: venta.id,
    cajaId: venta.cajaId,
    cajeroId: venta.cajeroId,
    items: venta.items,
    pagos: venta.pagos,
    descuentoCentavos: venta.descuentoCentavos,
    totalCentavos: venta.totalCentavos,
    fecha: venta.fecha,
  };
}

function serializarAnulacion(anulacion) {
  return {
    id: anulacion.id,
    ventaId: anulacion.ventaId,
    supervisorId: anulacion.supervisorId,
    motivo: anulacion.motivo,
    fecha: anulacion.fecha,
  };
}

export function crearRutasVentas({ registrarVenta, obtenerVenta, anularVenta }) {
  const router = Router();

  router.post('/', async (req, res) => {
    const claveIdempotencia = validarIdempotencyKey(req);
    const { items, pagos } = validarVenta(req.body);
    const { venta, replay } = await registrarVenta({
      usuario: req.usuario,
      claveIdempotencia,
      items,
      pagos,
    });

    if (replay) {
      res.set('Idempotent-Replayed', 'true');
    }

    res.status(201).json(serializarVenta(venta));
  });

  router.get('/:id', async (req, res) => {
    const ventaId = validarIdVenta(req.params.id);
    const venta = await obtenerVenta({
      usuario: req.usuario,
      ventaId,
    });

    res.json(serializarVenta(venta));
  });

  router.post('/:id/anulacion', async (req, res) => {
    const ventaId = validarIdVenta(req.params.id);
    const claveIdempotencia = validarIdempotencyKey(req);
    const { motivo } = validarAnulacion(req.body);
    const { anulacion, replay } = await anularVenta({
      usuario: req.usuario,
      claveIdempotencia,
      ventaId,
      motivo,
    });

    if (replay) {
      res.set('Idempotent-Replayed', 'true');
    }

    res.status(201).json(serializarAnulacion(anulacion));
  });

  return router;
}
