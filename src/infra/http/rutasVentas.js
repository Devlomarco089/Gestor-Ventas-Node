import { Router } from 'express';

import {
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
    totalCentavos: venta.totalCentavos,
    fecha: venta.fecha,
  };
}

export function crearRutasVentas({ registrarVenta, obtenerVenta }) {
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

  return router;
}
