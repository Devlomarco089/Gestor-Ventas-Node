// la carrera obligatoria del TP (parte de Franco)
// dos cajeros venden la ultima unidad del mismo producto al mismo tiempo
// solo una venta puede salir y el stock tiene que terminar en 0
//
// para que la carrera pase de verdad le ponemos una demora a cada lectura y escritura
// de productos, como si fuera una base de datos real
// el ultimo test muestra que SIN bloqueos se venden 2 unidades teniendo 1

import assert from 'node:assert/strict';
import test from 'node:test';

import { abrirCaja } from '../../src/dominio/casos-uso/abrirCaja.js';
import { registrarVenta } from '../../src/dominio/casos-uso/registrarVenta.js';
import { StockInsuficiente } from '../../src/dominio/errores.js';
import { Producto } from '../../src/dominio/producto.js';
import { crearAlmacenIdempotenciaMemoria } from '../../src/infra/memoria/almacenIdempotenciaMemoria.js';
import { crearBloqueosMemoria } from '../../src/infra/memoria/bloqueosMemoria.js';
import { crearRepositorioCajasMemoria } from '../../src/infra/memoria/repositorioCajasMemoria.js';
import { crearRepositorioProductosMemoria } from '../../src/infra/memoria/repositorioProductosMemoria.js';
import { crearRepositorioVentasMemoria } from '../../src/infra/memoria/repositorioVentasMemoria.js';

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// envuelve el repositorio de productos para que cada operacion tarde un poco
function conDemora(repositorio, ms) {
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

// arma todo lo necesario con un termo que tiene stock 1 y una caja abierta por cajero
async function prepararSistema({ conBloqueos, cantidadCajeros }) {
  let secuencia = 0;

  const dependencias = {
    repositorioProductos: conDemora(
      crearRepositorioProductosMemoria([
        new Producto({ id: 'termo', nombre: 'Termo', precioCentavos: 4599999, stock: 1 }),
      ]),
      5,
    ),
    repositorioCajas: crearRepositorioCajasMemoria(),
    repositorioVentas: crearRepositorioVentasMemoria(),
    almacenIdempotencia: crearAlmacenIdempotenciaMemoria(),
    generadorIds: { generar: () => `id-${++secuencia}` },
    reloj: { ahora: () => new Date('2026-01-01T10:00:00.000Z') },
  };

  // sin la propiedad bloqueos registrarVenta corre sin bloquear
  if (conBloqueos) dependencias.bloqueos = crearBloqueosMemoria();

  const cajeros = Array.from({ length: cantidadCajeros }, (_, i) => ({ id: `cajero-${i}`, rol: 'cajero' }));

  for (const cajero of cajeros) {
    await abrirCaja(dependencias, { usuario: cajero, montoInicialCentavos: 0 });
  }

  return { dependencias, cajeros };
}

// la venta de la ultima unidad que intenta hacer cada cajero
function venderTermo(dependencias, cajero) {
  return registrarVenta(dependencias, {
    usuario: cajero,
    claveIdempotencia: `termo-${cajero.id}`,
    items: [{ productoId: 'termo', cantidad: 1 }],
    pagos: [{ medio: 'tarjeta', montoCentavos: 4599999 }],
  });
}

async function stockDelTermo(dependencias) {
  return (await dependencias.repositorioProductos.obtenerPorId('termo')).stock;
}

test('con bloqueos: dos cajeros a la vez por la ultima unidad, sale una sola venta y el stock queda en 0', async () => {
  const { dependencias, cajeros } = await prepararSistema({ conBloqueos: true, cantidadCajeros: 2 });

  const resultados = await Promise.allSettled(cajeros.map((cajero) => venderTermo(dependencias, cajero)));

  const exitosas = resultados.filter((r) => r.status === 'fulfilled');
  const rechazadas = resultados.filter((r) => r.status === 'rejected');

  assert.equal(exitosas.length, 1, 'solo una venta puede salir');
  assert.equal(rechazadas.length, 1);
  assert.ok(rechazadas[0].reason instanceof StockInsuficiente);
  assert.equal(await stockDelTermo(dependencias), 0);
});

test('con bloqueos: 20 cajeros a la vez por 1 unidad, sale una sola venta', async () => {
  const { dependencias, cajeros } = await prepararSistema({ conBloqueos: true, cantidadCajeros: 20 });

  const resultados = await Promise.allSettled(cajeros.map((cajero) => venderTermo(dependencias, cajero)));

  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await stockDelTermo(dependencias), 0);
});

test('con bloqueos: dos reintentos simultaneos con la misma clave no duplican la venta', async () => {
  const { dependencias, cajeros } = await prepararSistema({ conBloqueos: true, cantidadCajeros: 1 });

  const resultados = await Promise.all([
    venderTermo(dependencias, cajeros[0]),
    venderTermo(dependencias, cajeros[0]),
  ]);

  // la segunda es un replay de la primera, misma venta
  assert.equal(resultados[0].venta.id, resultados[1].venta.id);
  assert.equal(resultados.filter((r) => r.replay).length, 1);
  assert.equal(await stockDelTermo(dependencias), 0);
});

test('SIN bloqueos (para mostrar el problema): las dos ventas salen teniendo 1 sola unidad', async () => {
  const { dependencias, cajeros } = await prepararSistema({ conBloqueos: false, cantidadCajeros: 2 });

  const resultados = await Promise.allSettled(cajeros.map((cajero) => venderTermo(dependencias, cajero)));

  // las dos leen stock 1 antes de que alguna lo descuente y las dos venden
  // esto es justo lo que no tiene que pasar, por eso estan los bloqueos
  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 2);
});
