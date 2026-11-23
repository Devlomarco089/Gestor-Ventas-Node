import { randomUUID } from 'node:crypto';

import { ErrorDominio } from '../../dominio/errores.js';

const ESTADOS_POR_CODIGO_DOMINIO = {
  SinPermiso: 403,
  CajaNoAbierta: 409,
  CajaYaAbierta: 409,
  StockInsuficiente: 409,
  PagosNoCuadran: 422,
  ProductoNoEncontrado: 422,
  VentaNoEncontrada: 404,
  VentaYaAnulada: 409,
  IdempotenciaConflicto: 422,
  ImporteInvalido: 400,
  DatosInvalidos: 400,
};

export class ErrorHttp extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.name = codigo;
    this.status = status;
    this.codigo = codigo;
  }
}

function enviarError(res, status, codigo, mensaje, idCorrelacion) {
  res.status(status).json({
    error: {
      codigo,
      mensaje,
      idCorrelacion,
    },
  });
}

export function middlewareErrores(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const idCorrelacion = req.idCorrelacion ?? randomUUID();

  if (err instanceof ErrorHttp) {
    enviarError(res, err.status, err.codigo, err.message, idCorrelacion);
    return;
  }

  if (err instanceof ErrorDominio) {
    const status = ESTADOS_POR_CODIGO_DOMINIO[err.codigo] ?? 500;

    if (status === 500) {
      console.error(`[${idCorrelacion}]`, err);
      enviarError(res, 500, 'ErrorInterno', 'Error interno del servidor.', idCorrelacion);
      return;
    }

    enviarError(res, status, err.codigo, err.message, idCorrelacion);
    return;
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    enviarError(res, 400, 'SolicitudInvalida', 'El cuerpo JSON es inválido.', idCorrelacion);
    return;
  }

  console.error(`[${idCorrelacion}]`, err);
  enviarError(res, 500, 'ErrorInterno', 'Error interno del servidor.', idCorrelacion);
}
