import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cajero,
  crearContexto,
  obtenerStocks,
  otroCajero,
  ventaBase,
} from './ayudas.js';

test('misma clave y mismo cuerpo devuelve la venta guardada sin descontar stock otra vez', async () => {
  const contexto = crearContexto();

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });

  const primera = await contexto.registrarVenta({
    usuario: cajero,
    claveIdempotencia: 'idem-1',
    ...ventaBase,
  });
  const stocksTrasPrimera = await obtenerStocks(contexto);

  assert.equal(primera.replay, false);
  assert.equal(contexto.repositorioVentas.listar().length, 1);

  await contexto.cerrarCaja({
    usuario: cajero,
    montoContadoCentavos: 2000,
  });

  const segunda = await contexto.registrarVenta({
    usuario: cajero,
    claveIdempotencia: 'idem-1',
    ...ventaBase,
  });

  assert.equal(segunda.replay, true);
  assert.equal(segunda.venta.id, primera.venta.id);
  assert.equal(contexto.repositorioVentas.listar().length, 1);
  assert.deepEqual(await obtenerStocks(contexto), stocksTrasPrimera);
});

test('misma clave con cuerpo distinto se rechaza sin tocar stock', async () => {
  const contexto = crearContexto();

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });
  await contexto.registrarVenta({
    usuario: cajero,
    claveIdempotencia: 'idem-2',
    ...ventaBase,
  });
  const stocksTrasPrimera = await obtenerStocks(contexto);

  await assert.rejects(
    () =>
      contexto.registrarVenta({
        usuario: cajero,
        claveIdempotencia: 'idem-2',
        items: [
          { productoId: 'prod-1', cantidad: 3 },
          { productoId: 'prod-2', cantidad: 1 },
        ],
        pagos: ventaBase.pagos,
      }),
    (error) => error.codigo === 'IdempotenciaConflicto',
  );

  assert.equal(contexto.repositorioVentas.listar().length, 1);
  assert.deepEqual(await obtenerStocks(contexto), stocksTrasPrimera);
});

test('misma clave usada por otro cajero se rechaza', async () => {
  const contexto = crearContexto();

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });
  await contexto.registrarVenta({
    usuario: cajero,
    claveIdempotencia: 'idem-3',
    ...ventaBase,
  });

  await assert.rejects(
    () =>
      contexto.registrarVenta({
        usuario: otroCajero,
        claveIdempotencia: 'idem-3',
        ...ventaBase,
      }),
    (error) => error.codigo === 'IdempotenciaConflicto',
  );
});
