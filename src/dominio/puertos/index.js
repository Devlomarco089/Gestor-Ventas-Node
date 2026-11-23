/**
 * @typedef {import('../producto.js').Producto} Producto
 * @typedef {import('../caja.js').Caja} Caja
 * @typedef {import('../venta.js').Venta} Venta
 * @typedef {import('../anulacion.js').Anulacion} Anulacion
 */

/**
 * @typedef {Object} RepositorioProductos
 * @property {(id: string) => Promise<Producto|null>} obtenerPorId
 * @property {(ids: string[]) => Promise<Producto[]>} obtenerPorIds
 * @property {(producto: Producto) => Promise<void>} guardar
 */

/**
 * @typedef {Object} RepositorioCajas
 * @property {(id: string) => Promise<Caja|null>} obtenerPorId
 * @property {(cajeroId: string) => Promise<Caja|null>} obtenerAbiertaPorCajero
 * @property {(caja: Caja) => Promise<void>} guardar
 */

/**
 * @typedef {Object} RepositorioVentas
 * @property {(id: string) => Promise<Venta|null>} obtenerPorId
 * @property {(venta: Venta) => Promise<void>} guardar
 */

/**
 * @typedef {Object} RepositorioAnulaciones
 * @property {(ventaId: string) => Promise<Anulacion|null>} obtenerPorVentaId
 * @property {(anulacion: Anulacion) => Promise<void>} guardar
 */

/**
 * @typedef {Object} RegistroIdempotencia
 * @property {string} cajeroId
 * @property {string} huella
 * @property {string} ventaId
 */

/**
 * @typedef {Object} AlmacenIdempotencia
 * @property {(clave: string) => Promise<RegistroIdempotencia|null>} obtener
 * @property {(clave: string, registro: RegistroIdempotencia) => Promise<void>} guardar
 */

/**
 * @typedef {Object} GeneradorIds
 * @property {() => string} generar
 */

/**
 * @typedef {Object} Reloj
 * @property {() => Date} ahora
 */

export {};
