import assert from 'node:assert/strict';
import test from 'node:test';

import {
  admin,
  cajero,
  crearContexto,
  ventaBase,
} from './ayudas.js';

test('abre una caja y calcula el esperado desde sus movimientos', async () => {
  const contexto = crearContexto();

  assert.equal(await contexto.obtenerCajaActual({ usuario: cajero }), null);

  const caja = await contexto.abrirCaja({
    usuario: cajero,
    montoInicialCentavos: 0,
  });

  assert.equal(caja.estado, 'abierta');
  assert.equal(caja.montoInicialCentavos, 0);
  assert.equal(caja.movimientos.length, 1);
  assert.equal(caja.movimientos[0].tipo, 'apertura');
  assert.equal(caja.calcularMontoEsperadoCentavos(), 0);

  const actual = await contexto.obtenerCajaActual({ usuario: cajero });
  assert.equal(actual.id, caja.id);
});

test('no permite abrir una segunda caja al mismo cajero', async () => {
  const contexto = crearContexto();

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });

  await assert.rejects(
    () => contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 600 }),
    (error) => error.codigo === 'CajaYaAbierta',
  );
});

test('exige rol cajero', async () => {
  const contexto = crearContexto();

  await assert.rejects(
    () => contexto.abrirCaja({ usuario: admin, montoInicialCentavos: 500 }),
    (error) => error.codigo === 'SinPermiso',
  );
});

test('el arqueo suma solo el efectivo y calcula diferencias', async (t) => {
  const casos = [
    { contado: 2000, diferencia: 0 },
    { contado: 2100, diferencia: 100 },
    { contado: 1900, diferencia: -100 },
  ];

  for (const caso of casos) {
    await t.test(`contado ${caso.contado}`, async () => {
      const contexto = crearContexto();

      await contexto.abrirCaja({
        usuario: cajero,
        montoInicialCentavos: 500,
      });

      const { venta } = await contexto.registrarVenta({
        usuario: cajero,
        claveIdempotencia: `arqueo-${caso.contado}`,
        ...ventaBase,
      });

      const cierre = await contexto.cerrarCaja({
        usuario: cajero,
        montoContadoCentavos: caso.contado,
      });

      assert.equal(venta.totalCentavos, 2250);
      assert.equal(cierre.esperado, 2000);
      assert.equal(cierre.contado, caso.contado);
      assert.equal(cierre.diferencia, caso.diferencia);
      assert.equal(cierre.cerradaPor, cajero.id);
      assert.equal(cierre.fechaCierre.toISOString(), '2026-01-01T10:00:00.000Z');
    });
  }
});

test('no permite cerrar una caja ya cerrada', async () => {
  const contexto = crearContexto();

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });
  await contexto.cerrarCaja({ usuario: cajero, montoContadoCentavos: 500 });

  await assert.rejects(
    () => contexto.cerrarCaja({ usuario: cajero, montoContadoCentavos: 500 }),
    (error) => error.codigo === 'CajaNoAbierta',
  );
});

test('no permite vender en una caja cerrada', async () => {
  const contexto = crearContexto();

  await contexto.abrirCaja({ usuario: cajero, montoInicialCentavos: 500 });
  await contexto.registrarVenta({
    usuario: cajero,
    claveIdempotencia: 'venta-antes-de-cerrar',
    ...ventaBase,
  });
  await contexto.cerrarCaja({ usuario: cajero, montoContadoCentavos: 2000 });

  const stockAntes = (await contexto.repositorioProductos.obtenerPorId('prod-1')).stock;

  await assert.rejects(
    () =>
      contexto.registrarVenta({
        usuario: cajero,
        claveIdempotencia: 'venta-con-caja-cerrada',
        ...ventaBase,
      }),
    (error) => error.codigo === 'CajaNoAbierta',
  );

  const stockDespues = (await contexto.repositorioProductos.obtenerPorId('prod-1')).stock;
  assert.equal(stockDespues, stockAntes);
});
