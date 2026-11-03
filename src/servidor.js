import express from 'express';
import { config } from './config/index.js';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(`Servidor escuchando en el puerto ${config.port}`);
});
