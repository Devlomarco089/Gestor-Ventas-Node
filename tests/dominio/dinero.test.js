import assert from 'node:assert/strict';
import test from 'node:test';

import { multiplicarCentavos, sumarCentavos } from '../../src/dominio/dinero.js';

test('los decimales no representan dinero de forma exacta', () => {
  assert.notEqual(0.1 + 0.2, 0.3);

  const preciosDecimales = [0.1, 0.2];
  const totalDecimal = preciosDecimales.reduce((total, precio) => total + precio, 0);

  assert.notEqual(totalDecimal, 0.3);
  assert.equal(sumarCentavos([10, 20]), 30);
});

test('multiplicar centavos mantiene el cálculo exacto', () => {
  assert.equal(multiplicarCentavos(1999, 3), 5997);
  assert.equal(sumarCentavos([5997, 1]), 5998);
});
