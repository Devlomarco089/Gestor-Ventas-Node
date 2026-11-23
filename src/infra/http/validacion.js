import { ErrorHttp } from './errores.js';

const MEDIOS_DE_PAGO = new Set(['efectivo', 'tarjeta', 'transferencia']);

export function exigirObjeto(valor, nombre) {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new ErrorHttp(400, 'SolicitudInvalida', `${nombre} debe ser un objeto.`);
  }

  return valor;
}

export function exigirCamposExactos(objeto, permitidos, nombre) {
  for (const campo of Object.keys(objeto)) {
    if (!permitidos.includes(campo)) {
      throw new ErrorHttp(
        400,
        'SolicitudInvalida',
        `El campo "${campo}" no está permitido en ${nombre}.`,
      );
    }
  }
}

export function exigirEnteroSeguro(valor, nombre, { positivo = true } = {}) {
  const invalido = !Number.isSafeInteger(valor) || (positivo ? valor <= 0 : valor < 0);

  if (invalido) {
    throw new ErrorHttp(
      400,
      'SolicitudInvalida',
      `${nombre} debe ser un entero ${positivo ? 'positivo' : 'no negativo'}.`,
    );
  }

  return valor;
}

export function exigirArrayNoVacio(valor, nombre) {
  if (!Array.isArray(valor) || valor.length === 0) {
    throw new ErrorHttp(400, 'SolicitudInvalida', `${nombre} debe ser un arreglo no vacío.`);
  }

  return valor;
}

export function exigirStringNoVacio(valor, nombre) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorHttp(400, 'SolicitudInvalida', `${nombre} debe ser un texto no vacío.`);
  }

  return valor.trim();
}

export function exigirMedioDePago(valor, nombre) {
  const medio = exigirStringNoVacio(valor, nombre);

  if (!MEDIOS_DE_PAGO.has(medio)) {
    throw new ErrorHttp(
      400,
      'SolicitudInvalida',
      `${nombre} debe ser uno de: efectivo, tarjeta o transferencia.`,
    );
  }

  return medio;
}

export function validarApertura(body) {
  const datos = exigirObjeto(body, 'El cuerpo');
  exigirCamposExactos(datos, ['montoInicialCentavos'], 'la apertura de caja');

  return {
    montoInicialCentavos: exigirEnteroSeguro(
      datos.montoInicialCentavos,
      'montoInicialCentavos',
      { positivo: false },
    ),
  };
}

export function validarCierre(body) {
  const datos = exigirObjeto(body, 'El cuerpo');
  exigirCamposExactos(datos, ['montoContadoCentavos'], 'el cierre de caja');

  return {
    montoContadoCentavos: exigirEnteroSeguro(
      datos.montoContadoCentavos,
      'montoContadoCentavos',
      { positivo: false },
    ),
  };
}

export function validarVenta(body) {
  const datos = exigirObjeto(body, 'El cuerpo');
  exigirCamposExactos(datos, ['items', 'pagos'], 'la venta');

  const items = exigirArrayNoVacio(datos.items, 'items').map((item, indice) => {
    const nombre = `items[${indice}]`;
    const itemObjeto = exigirObjeto(item, nombre);
    exigirCamposExactos(itemObjeto, ['productoId', 'cantidad'], nombre);

    return {
      productoId: exigirStringNoVacio(itemObjeto.productoId, `${nombre}.productoId`),
      cantidad: exigirEnteroSeguro(itemObjeto.cantidad, `${nombre}.cantidad`),
    };
  });

  const pagos = exigirArrayNoVacio(datos.pagos, 'pagos').map((pago, indice) => {
    const nombre = `pagos[${indice}]`;
    const pagoObjeto = exigirObjeto(pago, nombre);
    exigirCamposExactos(pagoObjeto, ['medio', 'montoCentavos'], nombre);

    return {
      medio: exigirMedioDePago(pagoObjeto.medio, `${nombre}.medio`),
      montoCentavos: exigirEnteroSeguro(
        pagoObjeto.montoCentavos,
        `${nombre}.montoCentavos`,
      ),
    };
  });

  return { items, pagos };
}

export function validarIdempotencyKey(req) {
  const clave = req.get('Idempotency-Key');

  if (typeof clave !== 'string' || clave.trim() === '') {
    throw new ErrorHttp(
      400,
      'SolicitudInvalida',
      'El encabezado Idempotency-Key es obligatorio.',
    );
  }

  return clave.trim();
}

export function validarAnulacion(body) {
  const datos = exigirObjeto(body, 'El cuerpo');
  exigirCamposExactos(datos, ['motivo'], 'la anulación');

  return {
    motivo: exigirStringNoVacio(datos.motivo, 'motivo'),
  };
}

export function validarIdVenta(valor) {
  return exigirStringNoVacio(valor, 'id');
}
