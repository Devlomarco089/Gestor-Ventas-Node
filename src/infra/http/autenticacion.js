import { ErrorHttp } from './errores.js';

export function autenticacionTemporal(req, _res, next) {
  // TEMPORAL: reemplazar por autenticación real (JWT/sesión)
  const id = req.get('X-Usuario-Id');
  const rol = req.get('X-Rol');

  if (!id?.trim() || !rol?.trim()) {
    next(
      new ErrorHttp(
        401,
        'NoAutenticado',
        'Faltan los encabezados X-Usuario-Id y X-Rol.',
      ),
    );
    return;
  }

  req.usuario = {
    id: id.trim(),
    rol: rol.trim(),
  };

  next();
}
