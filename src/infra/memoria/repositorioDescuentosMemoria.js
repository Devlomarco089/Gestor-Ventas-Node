// reglas de descuento guardadas en memoria (parte de Franco)
// cuando haya base de datos se hace otro con la misma funcion listar

export function crearRepositorioDescuentosMemoria(reglasIniciales = []) {
  const reglas = reglasIniciales.map((regla) => Object.freeze({ ...regla }));

  return {
    // devuelve todas las reglas activas
    async listar() {
      return [...reglas];
    },
  };
}
