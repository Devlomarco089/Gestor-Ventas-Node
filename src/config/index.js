const rawPort = process.env.PORT;
const port = Number(rawPort);

if (!rawPort || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(
    `[config] La variable de entorno PORT es inválida o no está definida (valor recibido: ${JSON.stringify(rawPort)}). Debe ser un número entero entre 1 y 65535.`
  );
  process.exit(1);
}

export const config = { port };
