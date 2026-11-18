// tests de descuentos (parte de Franco)
// son cuentas a mano, no usan HTTP ni repositorios

import assert from 'node:assert/strict';
import test from 'node:test';

import { mejorDescuento, porcentajeCentavos } from '../../src/dominio/descuentos.js';
import { DatosInvalidos, PagosNoCuadran } from '../../src/dominio/errores.js';
import { Venta } from '../../src/dominio/venta.js';

// reglas de ejemplo para todos los tests
const reglas = [
  { id: 'cafe-10', tipo: 'producto', productoId: 'cafe', porcentajeBp: 1000 },
  { id: 'cafe-3x', tipo: 'cantidad', productoId: 'cafe', cantidadMinima: 3, porcentajeBp: 2000 },
  { id: 'galle-6x', tipo: 'cantidad', productoId: 'galle', cantidadMinima: 6, porcentajeBp: 1500 },
];

// atajo para armar una venta con lo minimo
function crearVenta(items, pagos) {
  return Venta.crear({
    id: 'v-1',
    cajaId: 'caja-1',
    cajeroId: 'cajero-1',
    items,
    pagos,
    fecha: new Date('2026-01-01T10:00:00.000Z'),
    reglasDescuento: reglas,
  });
}

test('por que no usamos number: 0.1 + 0.2 no da 0.3 pero en centavos si', () => {
  // con number da 0.30000000000000004
  assert.notEqual(0.1 + 0.2, 0.3);
  // en centavos es 10 + 20 = 30 justo
  assert.equal(10 + 20, 30);
});

test('descuadre por redondeo: redondear por unidad no da lo mismo que por linea', () => {
  // 3 unidades de $ 3,33 con 10 % de descuento
  // por unidad: 10 % de 333 es 33,3 que queda 33, por 3 da 99 centavos
  const porUnidad = porcentajeCentavos(333, 1000) * 3;
  // por linea: 10 % de 999 es 99,9 que queda 100 centavos
  const porLinea = porcentajeCentavos(333 * 3, 1000);

  assert.equal(porUnidad, 99);
  assert.equal(porLinea, 100);
  // nosotros usamos siempre por linea, asi el ticket da igual en todos lados
  assert.notEqual(porUnidad, porLinea);
});

test('porcentaje redondea al centavo mas cercano y el empate va para arriba', () => {
  assert.equal(porcentajeCentavos(1000, 1000), 100); // 10 % de $ 10
  assert.equal(porcentajeCentavos(1005, 1000), 101); // 100,5 sube
  assert.equal(porcentajeCentavos(1004, 1000), 100); // 100,4 baja
  assert.equal(porcentajeCentavos(201, 5000), 101); // la mitad de $ 2,01 es 1,005 -> 1,01
});

test('si aplican dos reglas gana la que mas descuenta, no se suman', () => {
  // 3 cafes de $ 10: aplica 10 % por producto y 20 % por cantidad, gana el 20 %
  const resultado = mejorDescuento({ productoId: 'cafe', cantidad: 3, subtotalCentavos: 3000 }, reglas);

  assert.equal(resultado.descuentoCentavos, 600);
  assert.equal(resultado.reglaDescuentoId, 'cafe-3x');
});

test('la regla por cantidad no aplica si no llegas al minimo', () => {
  const resultado = mejorDescuento({ productoId: 'galle', cantidad: 5, subtotalCentavos: 5000 }, reglas);

  assert.equal(resultado.descuentoCentavos, 0);
  assert.equal(resultado.reglaDescuentoId, null);
});

test('la venta resta los descuentos del total y los pagos tienen que cubrir el total con descuento', () => {
  const venta = crearVenta(
    [
      { productoId: 'cafe', nombre: 'Cafe', cantidad: 2, precioUnitarioCentavos: 1000 }, // 2000 - 10 % = 1800
      { productoId: 'galle', nombre: 'Galletitas', cantidad: 6, precioUnitarioCentavos: 500 }, // 3000 - 15 % = 2550
      { productoId: 'yerba', nombre: 'Yerba', cantidad: 1, precioUnitarioCentavos: 4200 }, // sin descuento
    ],
    [
      { medio: 'efectivo', montoCentavos: 5000 },
      { medio: 'tarjeta', montoCentavos: 3550 },
    ],
  );

  assert.deepEqual(
    venta.items.map((item) => [item.productoId, item.subtotalCentavos, item.descuentoCentavos, item.totalCentavos]),
    [
      ['cafe', 2000, 200, 1800],
      ['galle', 3000, 450, 2550],
      ['yerba', 4200, 0, 4200],
    ],
  );
  assert.equal(venta.descuentoCentavos, 650);
  assert.equal(venta.totalCentavos, 8550);
});

test('si pagan el precio sin descuento la venta se rechaza porque no cuadra', () => {
  assert.throws(
    () => crearVenta(
      [{ productoId: 'cafe', nombre: 'Cafe', cantidad: 1, precioUnitarioCentavos: 1000 }],
      [{ medio: 'efectivo', montoCentavos: 1000 }], // tendria que ser 900
    ),
    PagosNoCuadran,
  );
});

test('una regla mal armada se rechaza', () => {
  assert.throws(
    () => mejorDescuento(
      { productoId: 'cafe', cantidad: 1, subtotalCentavos: 1000 },
      [{ id: 'mala', tipo: 'producto', productoId: 'cafe', porcentajeBp: 20000 }],
    ),
    DatosInvalidos,
  );
});
