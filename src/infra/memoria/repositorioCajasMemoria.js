export function crearRepositorioCajasMemoria() {
  const cajas = new Map();

  return {
    async obtenerPorId(id) {
      return cajas.get(id) ?? null;
    },

    async obtenerAbiertaPorCajero(cajeroId) {
      for (const caja of cajas.values()) {
        if (caja.cajeroId === cajeroId && caja.estaAbierta) {
          return caja;
        }
      }

      return null;
    },

    async guardar(caja) {
      cajas.set(caja.id, caja);
    },
  };
}
