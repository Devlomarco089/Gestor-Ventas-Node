export function crearRepositorioProductosMemoria(productosIniciales = []) {
  const productos = new Map(
    productosIniciales.map((producto) => [producto.id, producto]),
  );

  return {
    async obtenerPorId(id) {
      return productos.get(id) ?? null;
    },

    async obtenerPorIds(ids) {
      return ids
        .map((id) => productos.get(id))
        .filter((producto) => producto !== undefined);
    },

    async guardar(producto) {
      productos.set(producto.id, producto);
    },
  };
}
