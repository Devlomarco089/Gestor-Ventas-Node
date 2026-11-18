import assert from 'node:assert/strict';
import test from 'node:test';

import {
  admin,
  cajero,
  crearContexto,
  obtenerStocks,
  otroCajero,
  ventaBase,
} from './ayudas.js';

test('registra una venta feliz con varios ítems y dos medios de pago', async () => {
  const contexto = crearContexto();

  const caja = await contexto.abrirCaja({
    usuario: cajero,
    montoInicialCentavos: 500,
  });

  const { venta, replay } = await contexto.registrarVenta({
    usuario: cajero,
    claveIdempotencia: 'venta-feliz',
    ...ventaBase,
  });

  assert.equal(replay, false);
  assert.equal(venta.totalCentavos, 2250);
  assert.equal(venta.cajaId, caja.id);
  assert.equal(venta.cajeroId, cajero.id);
  assert.deepEqual(
    venta.items.map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioUnitarioCentavos: item.precioUnitarioCentavos,
      subtotalCentavos: item.subtotalCentavos,
    })),
    [
      {
        productoId: 'prod-1',
        cantidad: 2,
        precioUnitarioCentavos: 1000,
        subtotalCentavos: 2000,
      },
      {
        productoId: 'prod-2',
        cantidad: 1,
        precioUnitarioCentavos: 250,
        subtotalCentavos: 250,
      },
    ],
  );

  assert.equal((await contexto.repositorioProductos.obtenerPorId('prod-1')).stock, 8);
  assert.equal((await contexto.repositorioProductos.obtenerPorId('prod-2')).stock, 4);
  assert.equal(caja.movimientos.length, 3);
  assert.equal(caja.movimientos.filter((movimiento) => movimiento.tipo === 'pago').length, 2);
  assert.equal(caja.calcularMontoEsperadoCentavos(), 2000);
  assert.equal(Object.isFrozen(venta), true);
  assert.equal(Object.isFrozen(venta.items), true);
});

test('rechaza vender sin una caja abierta', async () => {
  const contexto = crearContexto();

  await assert.rejects(
    () =>
      contexto.registrarVenta({
        usuario: cajero,
        claveIdempotencia: 'sin-caja',
        ...ventaBase,
      }),
    (error) => error.codigo === 'CajaNoAbierta',
  );
});

test('rechaza pagos que no suman el total sin tocar el stock', async () => {
  const contexto = crearContexto();
  const stocksIniciales = await obtenerStocks(contexto);

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });

  await assert.rejects(
    () =>
      contexto.registrarVenta({
        usuario: cajero,
        claveIdempotencia: 'pagos-descuadrados',
        items: ventaBase.items,
        pagos: [{ medio: 'efectivo', montoCentavos: 2000 }],
      }),
    (error) => error.codigo === 'PagosNoCuadran',
  );

  assert.deepEqual(await obtenerStocks(contexto), stocksIniciales);
});

test('rechaza stock insuficiente y deja intacto el stock de todos los productos', async () => {
  const contexto = crearContexto();
  const stocksIniciales = await obtenerStocks(contexto);

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });

  await assert.rejects(
    () =>
      contexto.registrarVenta({
        usuario: cajero,
        claveIdempotencia: 'stock-insuficiente',
        items: [{ productoId: 'prod-3', cantidad: 3 }],
        pagos: [{ medio: 'efectivo', montoCentavos: 900 }],
      }),
    (error) => error.codigo === 'StockInsuficiente',
  );

  assert.deepEqual(await obtenerStocks(contexto), stocksIniciales);
});

test('rechaza un producto inexistente sin tocar el stock', async () => {
  const contexto = crearContexto();
  const stocksIniciales = await obtenerStocks(contexto);

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });

  await assert.rejects(
    () =>
      contexto.registrarVenta({
        usuario: cajero,
        claveIdempotencia: 'producto-inexistente',
        items: [{ productoId: 'prod-inexistente', cantidad: 1 }],
        pagos: [{ medio: 'efectivo', montoCentavos: 1000 }],
      }),
    (error) => error.codigo === 'ProductoNoEncontrado',
  );

  assert.deepEqual(await obtenerStocks(contexto), stocksIniciales);
});

test('rechaza vender con un rol distinto de cajero', async () => {
  const contexto = crearContexto();
  const stocksIniciales = await obtenerStocks(contexto);

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });

  await assert.rejects(
    () =>
      contexto.registrarVenta({
        usuario: admin,
        claveIdempotencia: 'rol-admin',
        ...ventaBase,
      }),
    (error) => error.codigo === 'SinPermiso',
  );

  assert.deepEqual(await obtenerStocks(contexto), stocksIniciales);
});

test('solo devuelve una venta al cajero que la registró', async () => {
  const contexto = crearContexto();

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });
  const { venta } = await contexto.registrarVenta({
    usuario: cajero,
    claveIdempotencia: 'venta-propia',
    ...ventaBase,
  });

  const propia = await contexto.obtenerVenta({
    usuario: cajero,
    ventaId: venta.id,
  });
  assert.equal(propia.id, venta.id);

  await assert.rejects(
    () =>
      contexto.obtenerVenta({
        usuario: otroCajero,
        ventaId: venta.id,
      }),
    (error) => error.codigo === 'VentaNoEncontrada',
  );
});

test('el repositorio de ventas no expone edición ni borrado', () => {
  const contexto = crearContexto();

  assert.equal(contexto.repositorioVentas.actualizar, undefined);
  assert.equal(contexto.repositorioVentas.eliminar, undefined);
});
