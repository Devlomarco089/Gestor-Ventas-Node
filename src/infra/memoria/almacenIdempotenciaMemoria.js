export function crearAlmacenIdempotenciaMemoria() {
  const registros = new Map();

  return {
    async obtener(clave) {
      return registros.get(clave) ?? null;
    },

    async guardar(clave, registro) {
      registros.set(clave, registro);
    },
  };
}
