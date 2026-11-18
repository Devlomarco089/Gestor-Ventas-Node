// bloqueos en memoria (parte de Franco)
//
// sirve para que dos ventas no toquen el mismo producto al mismo tiempo
// node tiene un solo hilo pero igual se mezclan las ventas en cada await, entonces
// dos ventas pueden leer stock 1 antes de que alguna lo descuente y se venden 2 unidades
//
// con esto cada clave (ej producto:prod-1) tiene una fila y el que llega segundo espera
// a que el primero termine, es lo mismo que haria un SELECT FOR UPDATE en una base
// cuando haya base de datos este archivo se cambia por uno que use la transaccion

export function crearBloqueosMemoria() {
  // clave -> promesa que termina cuando se suelta el ultimo que hizo fila
  const filas = new Map();

  // espera su turno para una clave y devuelve la funcion para soltarla
  async function tomar(clave) {
    const anterior = filas.get(clave) ?? Promise.resolve();

    let soltar;
    const miTurno = new Promise((resolver) => {
      soltar = resolver;
    });

    // el que venga despues de mi tiene que esperar a que yo suelte
    const fila = anterior.then(() => miTurno);
    filas.set(clave, fila);

    await anterior;

    return () => {
      soltar();
      // si nadie mas hizo fila limpiamos para no juntar basura en el map
      if (filas.get(clave) === fila) filas.delete(clave);
    };
  }

  return {
    // corre la tarea con todas las claves tomadas y las suelta al final aunque falle
    async conBloqueo(claves, tarea) {
      // se ordenan para que todos tomen las claves en el mismo orden y no se trabe
      // nadie esperando al otro (deadlock)
      const ordenadas = [...new Set(claves)].sort();
      const soltadores = [];

      try {
        for (const clave of ordenadas) {
          soltadores.push(await tomar(clave));
        }

        return await tarea();
      } finally {
        for (const soltar of soltadores.reverse()) soltar();
      }
    },
  };
}
