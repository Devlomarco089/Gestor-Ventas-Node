import { randomUUID } from 'node:crypto';

import express from 'express';

import { autenticacionTemporal } from './autenticacion.js';
import { ErrorHttp, middlewareErrores } from './errores.js';
import { crearRutasCajas } from './rutasCajas.js';
import { crearRutasVentas } from './rutasVentas.js';

export function crearApp({
  abrirCaja,
  registrarVenta,
  cerrarCaja,
  obtenerCajaActual,
  obtenerVenta,
}) {
  const app = express();

  app.use((req, _res, next) => {
    req.idCorrelacion = randomUUID();
    next();
  });

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/cajas',
    autenticacionTemporal,
    crearRutasCajas({ abrirCaja, cerrarCaja, obtenerCajaActual }),
  );

  app.use(
    '/ventas',
    autenticacionTemporal,
    crearRutasVentas({ registrarVenta, obtenerVenta }),
  );

  app.use((_req, _res, next) => {
    next(new ErrorHttp(404, 'RutaNoEncontrada', 'La ruta solicitada no existe.'));
  });

  app.use(middlewareErrores);

  return app;
}
