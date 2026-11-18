import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { app } from '../../src/servidor.js';

let servidor;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    servidor = app.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    servidor.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

async function pedir(
  ruta,
  {
    metodo = 'GET',
    usuario = 'cajero-a',
    rol = 'cajero',
    body,
    headers = {},
  } = {},
) {
  const respuesta = await fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'X-Usuario-Id': usuario,
      'X-Rol': rol,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await respuesta.text();
  const json = texto === '' ? null : JSON.parse(texto);

  return { respuesta, json };
}

test('flujo completo: abrir caja, vender y cerrar con arqueo', async () => {
  const usuario = 'cajero-flujo';

  const apertura = await pedir('/cajas/abrir', {
    metodo: 'POST',
    usuario,
    body: { montoInicialCentavos: 50000 },
  });

  assert.equal(apertura.respuesta.status, 201);
  assert.equal(apertura.json.estado, 'abierta');
  assert.equal(apertura.json.montoEsperadoCentavos, 50000);
  const cajaId = apertura.json.id;

  const venta = await pedir('/ventas', {
    metodo: 'POST',
    usuario,
    headers: { 'Idempotency-Key': 'flujo-1' },
    body: {
      items: [
        { productoId: 'prod-1', cantidad: 1 },
        { productoId: 'prod-3', cantidad: 2 },
      ],
      pagos: [
        { medio: 'efectivo', montoCentavos: 1000000 },
        { medio: 'transferencia', montoCentavos: 210000 },
      ],
    },
  });

  assert.equal(venta.respuesta.status, 201);
  assert.equal(venta.json.totalCentavos, 1210000);
  assert.equal(venta.json.cajaId, cajaId);
  assert.equal(venta.json.cajeroId, usuario);
  assert.equal(venta.json.items[0].precioUnitarioCentavos, 850000);
  assert.equal(venta.respuesta.headers.get('idempotent-replayed'), null);

  const actual = await pedir('/cajas/actual', { usuario });
  assert.equal(actual.respuesta.status, 200);
  assert.equal(actual.json.id, cajaId);
  assert.equal(actual.json.montoEsperadoCentavos, 1050000);

  const cierre = await pedir('/cajas/cerrar', {
    metodo: 'POST',
    usuario,
    body: { montoContadoCentavos: 1050000 },
  });

  assert.equal(cierre.respuesta.status, 200);
  assert.equal(cierre.json.esperado, 1050000);
  assert.equal(cierre.json.contado, 1050000);
  assert.equal(cierre.json.diferencia, 0);
  assert.equal(cierre.json.cerradaPor, usuario);
  assert.equal(typeof cierre.json.fechaCierre, 'string');
  assert.equal(Number.isNaN(Date.parse(cierre.json.fechaCierre)), false);

  const sinCaja = await pedir('/cajas/actual', { usuario });
  assert.equal(sinCaja.respuesta.status, 404);
  assert.equal(sinCaja.json.error.codigo, 'CajaNoAbierta');
});

test('repetir la misma venta devuelve la guardada y el encabezado de replay', async () => {
  const usuario = 'cajero-idempotente';
  const body = {
    items: [{ productoId: 'prod-2', cantidad: 1 }],
    pagos: [{ medio: 'efectivo', montoCentavos: 420000 }],
  };

  await pedir('/cajas/abrir', {
    metodo: 'POST',
    usuario,
    body: { montoInicialCentavos: 10000 },
  });

  const primera = await pedir('/ventas', {
    metodo: 'POST',
    usuario,
    headers: { 'Idempotency-Key': 'replay-1' },
    body,
  });
  const segunda = await pedir('/ventas', {
    metodo: 'POST',
    usuario,
    headers: { 'Idempotency-Key': 'replay-1' },
    body,
  });

  assert.equal(primera.respuesta.status, 201);
  assert.equal(segunda.respuesta.status, 201);
  assert.equal(segunda.respuesta.headers.get('idempotent-replayed'), 'true');
  assert.equal(segunda.json.id, primera.json.id);
  assert.equal(segunda.json.totalCentavos, primera.json.totalCentavos);
});

test('un cajero no puede obtener la venta de otro', async () => {
  const duenio = 'cajero-duenio';

  await pedir('/cajas/abrir', {
    metodo: 'POST',
    usuario: duenio,
    body: { montoInicialCentavos: 0 },
  });

  const venta = await pedir('/ventas', {
    metodo: 'POST',
    usuario: duenio,
    headers: { 'Idempotency-Key': 'venta-ajena-1' },
    body: {
      items: [{ productoId: 'prod-4', cantidad: 1 }],
      pagos: [{ medio: 'tarjeta', montoCentavos: 350000 }],
    },
  });

  assert.equal(venta.respuesta.status, 201);

  const consulta = await pedir(`/ventas/${venta.json.id}`, {
    usuario: 'cajero-intruso',
  });

  assert.equal(consulta.respuesta.status, 404);
  assert.equal(consulta.json.error.codigo, 'VentaNoEncontrada');
  assert.equal(typeof consulta.json.error.idCorrelacion, 'string');
});

test('rechaza campos no declarados y devuelve el formato de error sin stack', async () => {
  const { respuesta, json } = await pedir('/ventas', {
    metodo: 'POST',
    usuario: 'cajero-validacion',
    headers: { 'Idempotency-Key': 'campo-extra-1' },
    body: {
      items: [{ productoId: 'prod-1', cantidad: 1, precio: 1 }],
      pagos: [{ medio: 'efectivo', montoCentavos: 850000 }],
    },
  });

  assert.equal(respuesta.status, 400);
  assert.equal(json.error.codigo, 'SolicitudInvalida');
  assert.equal(typeof json.error.idCorrelacion, 'string');
  assert.equal('stack' in json.error, false);
  assert.equal('stack' in json, false);
  assert.match(json.error.mensaje, /precio/);
});

test('exige el encabezado Idempotency-Key', async () => {
  const { respuesta, json } = await pedir('/ventas', {
    metodo: 'POST',
    usuario: 'cajero-sin-clave',
    body: {
      items: [{ productoId: 'prod-1', cantidad: 1 }],
      pagos: [{ medio: 'efectivo', montoCentavos: 850000 }],
    },
  });

  assert.equal(respuesta.status, 400);
  assert.equal(json.error.codigo, 'SolicitudInvalida');
  assert.equal(typeof json.error.idCorrelacion, 'string');
});

test('mapea errores de dominio a los estados HTTP correspondientes', async (t) => {
  await t.test('sin permiso -> 403', async () => {
    const { respuesta, json } = await pedir('/cajas/abrir', {
      metodo: 'POST',
      usuario: 'admin-mapeo',
      rol: 'admin',
      body: { montoInicialCentavos: 0 },
    });

    assert.equal(respuesta.status, 403);
    assert.equal(json.error.codigo, 'SinPermiso');
  });

  await t.test('caja no abierta -> 409', async () => {
    const { respuesta, json } = await pedir('/ventas', {
      metodo: 'POST',
      usuario: 'cajero-sin-caja-mapeo',
      headers: { 'Idempotency-Key': 'mapeo-sin-caja' },
      body: {
        items: [{ productoId: 'prod-1', cantidad: 1 }],
        pagos: [{ medio: 'efectivo', montoCentavos: 850000 }],
      },
    });

    assert.equal(respuesta.status, 409);
    assert.equal(json.error.codigo, 'CajaNoAbierta');
  });

  await t.test('pagos que no cuadran -> 422', async () => {
    const usuario = 'cajero-pagos-mapeo';

    await pedir('/cajas/abrir', {
      metodo: 'POST',
      usuario,
      body: { montoInicialCentavos: 0 },
    });

    const { respuesta, json } = await pedir('/ventas', {
      metodo: 'POST',
      usuario,
      headers: { 'Idempotency-Key': 'mapeo-pagos' },
      body: {
        items: [{ productoId: 'prod-1', cantidad: 1 }],
        pagos: [{ medio: 'efectivo', montoCentavos: 1 }],
      },
    });

    assert.equal(respuesta.status, 422);
    assert.equal(json.error.codigo, 'PagosNoCuadran');
  });

  await t.test('producto inexistente -> 422', async () => {
    const usuario = 'cajero-producto-mapeo';

    await pedir('/cajas/abrir', {
      metodo: 'POST',
      usuario,
      body: { montoInicialCentavos: 0 },
    });

    const { respuesta, json } = await pedir('/ventas', {
      metodo: 'POST',
      usuario,
      headers: { 'Idempotency-Key': 'mapeo-producto' },
      body: {
        items: [{ productoId: 'prod-inexistente', cantidad: 1 }],
        pagos: [{ medio: 'efectivo', montoCentavos: 1000 }],
      },
    });

    assert.equal(respuesta.status, 422);
    assert.equal(json.error.codigo, 'ProductoNoEncontrado');
  });
});
