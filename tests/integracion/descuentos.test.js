// test por HTTP de la venta con descuento (parte de Franco)
// usa la app real con las reglas de ejemplo de datosSemilla: 10 % en el arroz (prod-5)

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { app } from '../../src/servidor.js';

let servidor;
let baseUrl;

// levanta el servidor en un puerto libre
before(async () => {
  await new Promise((resolve) => {
    servidor = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${servidor.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => servidor.close(resolve));
});

// hace un pedido como cajero
async function pedir(ruta, { metodo = 'GET', body, headers = {} } = {}) {
  const respuesta = await fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'X-Usuario-Id': 'cajero-descuentos',
      'X-Rol': 'cajero',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { status: respuesta.status, json: await respuesta.json() };
}

test('vender 2 arroces aplica el 10 % y el total ya viene descontado', async () => {
  await pedir('/cajas/abrir', { metodo: 'POST', body: { montoInicialCentavos: 0 } });

  // 2 x $ 2200 = $ 4400 y con 10 % queda $ 3960
  const venta = await pedir('/ventas', {
    metodo: 'POST',
    headers: { 'Idempotency-Key': 'arroz-1' },
    body: {
      items: [{ productoId: 'prod-5', cantidad: 2 }],
      pagos: [{ medio: 'efectivo', montoCentavos: 396000 }],
    },
  });

  assert.equal(venta.status, 201);
  assert.equal(venta.json.totalCentavos, 396000);
  assert.equal(venta.json.descuentoCentavos, 44000);
  assert.equal(venta.json.items[0].reglaDescuentoId, 'desc-arroz-10');
});

test('si pagan el precio lleno sin el descuento responde 422', async () => {
  const venta = await pedir('/ventas', {
    metodo: 'POST',
    headers: { 'Idempotency-Key': 'arroz-2' },
    body: {
      items: [{ productoId: 'prod-5', cantidad: 1 }],
      pagos: [{ medio: 'efectivo', montoCentavos: 220000 }],
    },
  });

  assert.equal(venta.status, 422);
  assert.equal(venta.json.error.codigo, 'PagosNoCuadran');
});
