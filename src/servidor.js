import { pathToFileURL } from 'node:url';

import { crearComposicion } from './composicion.js';
import { crearApp } from './infra/http/crearApp.js';

export const app = crearApp(crearComposicion());

const esEjecucionDirecta =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  const { config } = await import('./config/index.js');

  app.listen(config.port, () => {
    console.log(`Servidor escuchando en el puerto ${config.port}`);
  });
}
