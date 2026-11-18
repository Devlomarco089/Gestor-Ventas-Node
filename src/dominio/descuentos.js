// descuentos de la venta (parte de Franco)
//
// hay dos tipos de regla:
//   producto  -> un porcentaje fijo para un producto, ej 10 % en el arroz
//   cantidad  -> un porcentaje si llevas al menos N unidades, ej 15 % llevando 3 yerbas
//
// los porcentajes van en puntos basicos (bp) para no usar decimales: 1000 bp = 10 %
// si a una linea le sirven varias reglas se usa la que mas descuenta, no se suman

import { DatosInvalidos } from './errores.js';

const TIPOS = new Set(['producto', 'cantidad']);

// revisa que la regla tenga todo lo que necesita antes de usarla
export function validarRegla(regla) {
  if (!regla || typeof regla.id !== 'string' || regla.id.trim() === '') {
    throw new DatosInvalidos('La regla de descuento necesita un id');
  }

  if (!TIPOS.has(regla.tipo)) {
    throw new DatosInvalidos(`La regla ${regla.id} tiene un tipo invalido`);
  }

  if (typeof regla.productoId !== 'string' || regla.productoId.trim() === '') {
    throw new DatosInvalidos(`La regla ${regla.id} necesita productoId`);
  }

  // entre 1 bp y 10000 bp o sea entre 0,01 % y 100 %
  if (!Number.isSafeInteger(regla.porcentajeBp) || regla.porcentajeBp <= 0 || regla.porcentajeBp > 10000) {
    throw new DatosInvalidos(`La regla ${regla.id} tiene un porcentaje invalido`);
  }

  if (regla.tipo === 'cantidad' && (!Number.isSafeInteger(regla.cantidadMinima) || regla.cantidadMinima <= 0)) {
    throw new DatosInvalidos(`La regla ${regla.id} necesita cantidadMinima`);
  }

  return regla;
}

// calcula el porcentaje de un monto en centavos y redondea al centavo mas cercano
// los empates (x,5) van para arriba, es el redondeo comercial de siempre
// ej 10 % de 999 centavos = 99,9 -> 100 centavos
export function porcentajeCentavos(montoCentavos, porcentajeBp) {
  const producto = montoCentavos * porcentajeBp;

  if (!Number.isSafeInteger(producto)) {
    throw new DatosInvalidos('El monto es demasiado grande para calcular el descuento');
  }

  // sumar la mitad del divisor antes de dividir hace el redondeo hacia arriba en el empate
  return Math.floor((producto + 5000) / 10000);
}

// dice si una regla le sirve a una linea
function aplica(regla, linea) {
  if (regla.productoId !== linea.productoId) return false;
  if (regla.tipo === 'cantidad') return linea.cantidad >= regla.cantidadMinima;
  return true;
}

// busca el mejor descuento para una linea
// linea = { productoId, cantidad, subtotalCentavos }
// devuelve cuanto descuenta y que regla uso (null si ninguna)
export function mejorDescuento(linea, reglas = []) {
  let mejor = { descuentoCentavos: 0, reglaDescuentoId: null };

  for (const regla of reglas) {
    validarRegla(regla);

    if (!aplica(regla, linea)) continue;

    // el redondeo se hace una vez sobre la linea entera, no por unidad
    const descuentoCentavos = porcentajeCentavos(linea.subtotalCentavos, regla.porcentajeBp);

    if (descuentoCentavos > mejor.descuentoCentavos) {
      mejor = { descuentoCentavos, reglaDescuentoId: regla.id };
    }
  }

  return mejor;
}
