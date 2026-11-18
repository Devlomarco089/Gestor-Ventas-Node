import { randomUUID } from 'node:crypto';

export function crearGeneradorIds() {
  return {
    generar() {
      return randomUUID();
    },
  };
}
