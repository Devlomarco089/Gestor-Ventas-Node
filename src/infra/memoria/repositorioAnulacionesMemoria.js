export function crearRepositorioAnulacionesMemoria() {
  // Indexado por ventaId: una venta tiene como máximo una anulación.
  const anulaciones = new Map();

  return {
    async obtenerPorVentaId(ventaId) {
      return anulaciones.get(ventaId) ?? null;
    },

    async guardar(anulacion) {
      anulaciones.set(anulacion.ventaId, anulacion);
    },

    // solo se usa para deshacer una anulación que no terminó de guardarse
    async eliminarPorVentaId(ventaId) {
      anulaciones.delete(ventaId);
    },
  };
}
