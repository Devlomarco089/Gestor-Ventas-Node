// la anulacion tambien corre con los bloqueos de Franco (ver docs/adr/0001-descuentos-y-bloqueos.md)
// varios supervisores anulan la misma venta a la vez: tiene que salir una sola anulacion
// y el stock tiene que volver una sola vez
//
// como en ultimaUnidad.test.js, cada lectura y escritura tarda un poco para que
// las operaciones se intercalen

import assert from 'node:assert/strict';
import test from 'node:test';

import { abrirCaja } from '../../src/dominio/casos-uso/abrirCaja.js';
import { anularVenta } from '../../src/dominio/casos-uso/anularVenta.js';
import { registrarVenta } from '../../src/dominio/casos-uso/registrarVenta.js';
import { Producto } from '../../src/dominio/producto.js';
import { crearAlmacenIdempotenciaMemoria } from '../../src/infra/memoria/almacenIdempotenciaMemoria.js';
import { crearBloqueosMemoria } from '../../src/infra/memoria/bloqueosMemoria.js';
import { crearRepositorioAnulacionesMemoria } from '../../src/infra/memoria/repositorioAnulacionesMemoria.js';
import { crearRepositorioCajasMemoria } from '../../src/infra/memoria/repositorioCajasMemoria.js';
import { crearRepositorioProductosMemoria } from '../../src/infra/memoria/repositorioProductosMemoria.js';
import { crearRepositorioVentasMemoria } from '../../src/infra/memoria/repositorioVentasMemoria.js';

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function conDemoraProductos(repositorio, ms) {
  return {
    async obtenerPorId(id) {
      await esperar(ms);
      return repositorio.obtenerPorId(id);
    },
    async obtenerPorIds(ids) {
      await esperar(ms);
      return repositorio.obtenerPorIds(ids);
    },
    async guardar(producto) {
      await esperar(ms);
      return repositorio.guardar(producto);
    },
  };
}

function conDemoraAnulaciones(repositorio, ms) {
  return {
    async obtenerPorVentaId(ventaId) {
      await esperar(ms);
      return repositorio.obtenerPorVentaId(ventaId);
    },
    async guardar(anulacion) {
      await esperar(ms);
      return repositorio.guardar(anulacion);
    },
    eliminarPorVentaId(ventaId) {
      return repositorio.eliminarPorVentaId(ventaId);
    },
  };
}

// deja una caja abierta y una venta de la ultima unidad de un termo ya cobrada
async function prepararTermoVendido({ conBloqueos }) {
  let secuencia = 0;
  const generadorIds = { generar: () => `id-${++secuencia}` };
  const reloj = { ahora: () => new Date('2026-01-01T10:00:00.000Z') };

  const repositorioProductos = crearRepositorioProductosMemoria([
    new Producto({ id: 'termo', nombre: 'Termo', precioCentavos: 4599999, stock: 1 }),
  ]);
  const repositorioCajas = crearRepositorioCajasMemoria();
  const repositorioVentas = crearRepositorioVentasMemoria();
  const repositorioAnulaciones = crearRepositorioAnulacionesMemoria();
  const almacenIdempotencia = crearAlmacenIdempotenciaMemoria();
  const base = {
    repositorioProductos,
    repositorioCajas,
    repositorioVentas,
    repositorioAnulaciones,
    almacenIdempotencia,
    generadorIds,
    reloj,
  };

  const cajero = { id: 'cajero-1', rol: 'cajero' };
  await abrirCaja(base, { usuario: cajero, montoInicialCentavos: 0 });
  const { venta } = await registrarVenta(base, {
    usuario: cajero,
    claveIdempotencia: 'venta-termo',
    items: [{ productoId: 'termo', cantidad: 1 }],
    pagos: [{ medio: 'tarjeta', montoCentavos: 4599999 }],
  });

  // desde aca las anulaciones corren con demora en cada acceso a los datos
  const paraAnular = {
    ...base,
    repositorioProductos: conDemoraProductos(repositorioProductos, 5),
    repositorioAnulaciones: conDemoraAnulaciones(repositorioAnulaciones, 5),
    ...(conBloqueos ? { bloqueos: crearBloqueosMemoria() } : {}),
  };

  return { paraAnular, ventaId: venta.id, repositorioProductos, repositorioCajas, cajero };
}

test('con bloqueos: cinco supervisores anulan la misma venta a la vez, sale una sola anulacion y el stock vuelve una vez', async () => {
  const { paraAnular, ventaId, repositorioProductos, repositorioCajas, cajero } =
    await prepararTermoVendido({ conBloqueos: true });
  const supervisores = Array.from({ length: 5 }, (_, i) => ({ id: `sup-${i}`, rol: 'supervisor' }));

  const resultados = await Promise.allSettled(
    supervisores.map((usuario, i) => anularVenta(paraAnular, {
      usuario,
      claveIdempotencia: `anular-${i}`,
      ventaId,
      motivo: 'Duplicada',
    })),
  );

  const exitosas = resultados.filter((r) => r.status === 'fulfilled');
  const rechazadas = resultados.filter((r) => r.status === 'rejected');

  assert.equal(exitosas.length, 1, 'solo una anulacion puede salir');
  assert.equal(rechazadas.length, 4);
  assert.ok(rechazadas.every((r) => r.reason.codigo === 'VentaYaAnulada'));
  assert.equal((await repositorioProductos.obtenerPorId('termo')).stock, 1);

  const caja = await repositorioCajas.obtenerAbiertaPorCajero(cajero.id);
  assert.equal(caja.calcularMontoEsperadoCentavos(), 0);
});

test('con bloqueos: dos reintentos simultaneos con la misma clave devuelven la misma anulacion', async () => {
  const { paraAnular, ventaId, repositorioProductos } = await prepararTermoVendido({ conBloqueos: true });
  const supervisor = { id: 'sup-0', rol: 'supervisor' };
  const pedido = {
    usuario: supervisor,
    claveIdempotencia: 'anular-misma',
    ventaId,
    motivo: 'Duplicada',
  };

  const resultados = await Promise.all([
    anularVenta(paraAnular, pedido),
    anularVenta(paraAnular, pedido),
  ]);

  assert.equal(resultados[0].anulacion.id, resultados[1].anulacion.id);
  assert.equal(resultados.filter((r) => r.replay).length, 1);
  assert.equal((await repositorioProductos.obtenerPorId('termo')).stock, 1);
});

test('SIN bloqueos (para mostrar el problema): dos supervisores a la vez salen con dos anulaciones', async () => {
  const { paraAnular, ventaId } = await prepararTermoVendido({ conBloqueos: false });

  const resultados = await Promise.allSettled([
    anularVenta(paraAnular, {
      usuario: { id: 'sup-0', rol: 'supervisor' },
      claveIdempotencia: 'anular-a',
      ventaId,
      motivo: 'Duplicada',
    }),
    anularVenta(paraAnular, {
      usuario: { id: 'sup-1', rol: 'supervisor' },
      claveIdempotencia: 'anular-b',
      ventaId,
      motivo: 'Duplicada',
    }),
  ]);

  // las dos leen que la venta no tiene anulacion antes de que alguna la guarde
  // esto es justo lo que no tiene que pasar, por eso estan los bloqueos
  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 2);
});
