import { DatosInvalidos, ImporteInvalido } from './errores.js';

export function exigirCentavosPositivos(valor, campo = 'importe') {
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new ImporteInvalido(`${campo} debe ser un entero positivo en centavos.`);
  }
  return valor;
}

export function exigirCentavosNoNegativos(valor, campo = 'importe') {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new ImporteInvalido(`${campo} debe ser un entero no negativo en centavos.`);
  }
  return valor;
}

export function sumarCentavos(valores) {
  let total = 0;

  for (const valor of valores) {
    exigirCentavosNoNegativos(valor);
    total += valor;

    if (!Number.isSafeInteger(total)) {
      throw new ImporteInvalido('El total en centavos excede el rango seguro.');
    }
  }

  return total;
}

export function multiplicarCentavos(precioCentavos, cantidad) {
  exigirCentavosPositivos(precioCentavos, 'precioCentavos');

  if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
    throw new DatosInvalidos('La cantidad debe ser un entero positivo.');
  }

  const total = precioCentavos * cantidad;

  if (!Number.isSafeInteger(total)) {
    throw new ImporteInvalido('El subtotal en centavos excede el rango seguro.');
  }

  return total;
}

export function restarCentavos(minuendo, sustraendo) {
  exigirCentavosNoNegativos(minuendo, 'minuendo');
  exigirCentavosNoNegativos(sustraendo, 'sustraendo');

  const diferencia = minuendo - sustraendo;

  if (!Number.isSafeInteger(diferencia)) {
    throw new ImporteInvalido('La diferencia en centavos excede el rango seguro.');
  }

  return diferencia;
}
