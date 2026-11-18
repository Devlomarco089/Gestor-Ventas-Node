export function crearRepositorioVentasMemoria() {
  const ventas = new Map();

  return {
    async obtenerPorId(id) {
      return ventas.get(id) ?? null;
    },

    async guardar(venta) {
      ventas.set(venta.id, venta);
    },

    listar() {
      return [...ventas.values()];
    },
  };
}
