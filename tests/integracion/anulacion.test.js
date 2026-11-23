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
    usuario = 'cajero-anula',
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

test('flujo de anulación: cajero recibe 403, supervisor anula, reintento y doble anulación', async () => {
  const cajeroUsuario = 'cajero-anula-1';
  const supervisorUsuario = 'sup-anula-1';

  await pedir('/cajas/abrir', {
    metodo: 'POST',
    usuario: cajeroUsuario,
    body: { montoInicialCentavos: 0 },
  });

  const venta = await pedir('/ventas', {
    metodo: 'POST',
    usuario: cajeroUsuario,
    headers: { 'Idempotency-Key': 'venta-anula-1' },
    body: {
      // el arroz tiene 10 % de descuento (regla de Franco): 220000 - 22000
      items: [{ productoId: 'prod-5', cantidad: 1 }],
      pagos: [{ medio: 'efectivo', montoCentavos: 198000 }],
    },
  });
  assert.equal(venta.respuesta.status, 201);

  const rutaAnulacion = `/ventas/${venta.json.id}/anulacion`;

  const intentoCajero = await pedir(rutaAnulacion, {
    metodo: 'POST',
    usuario: cajeroUsuario,
    headers: { 'Idempotency-Key': 'anular-cajero-1' },
    body: { motivo: 'Quiero anular' },
  });
  assert.equal(intentoCajero.respuesta.status, 403);

  const anulacion = await pedir(rutaAnulacion, {
    metodo: 'POST',
    usuario: supervisorUsuario,
    rol: 'supervisor',
    headers: { 'Idempotency-Key': 'anular-sup-1' },
    body: { motivo: 'Error de carga' },
  });
  assert.equal(anulacion.respuesta.status, 201);
  assert.equal(anulacion.json.ventaId, venta.json.id);
  assert.equal(anulacion.json.motivo, 'Error de carga');
  assert.equal(anulacion.json.supervisorId, supervisorUsuario);

  const reintento = await pedir(rutaAnulacion, {
    metodo: 'POST',
    usuario: supervisorUsuario,
    rol: 'supervisor',
    headers: { 'Idempotency-Key': 'anular-sup-1' },
    body: { motivo: 'Error de carga' },
  });
  assert.equal(reintento.respuesta.status, 201);
  assert.equal(reintento.respuesta.headers.get('Idempotent-Replayed'), 'true');
  assert.equal(reintento.json.id, anulacion.json.id);

  const segunda = await pedir(rutaAnulacion, {
    metodo: 'POST',
    usuario: supervisorUsuario,
    rol: 'supervisor',
    headers: { 'Idempotency-Key': 'anular-sup-2' },
    body: { motivo: 'Otra vez' },
  });
  assert.equal(segunda.respuesta.status, 409);
  assert.equal(segunda.json.error.codigo, 'VentaYaAnulada');
});

test('rechaza la anulación sin Idempotency-Key o sin motivo', async () => {
  const sinClave = await pedir('/ventas/venta-x/anulacion', {
    metodo: 'POST',
    usuario: 'sup-val',
    rol: 'supervisor',
    body: { motivo: 'Algo' },
  });
  assert.equal(sinClave.respuesta.status, 400);

  const sinMotivo = await pedir('/ventas/venta-x/anulacion', {
    metodo: 'POST',
    usuario: 'sup-val',
    rol: 'supervisor',
    headers: { 'Idempotency-Key': 'anular-val-1' },
    body: {},
  });
  assert.equal(sinMotivo.respuesta.status, 400);
});
