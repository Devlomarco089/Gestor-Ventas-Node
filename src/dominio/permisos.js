import { SinPermiso } from './errores.js';

export function exigirCajero(usuario) {
  if (
    !usuario ||
    typeof usuario.id !== 'string' ||
    usuario.id.trim() === '' ||
    usuario.rol !== 'cajero'
  ) {
    throw new SinPermiso();
  }

  return usuario;
}

export function exigirSupervisor(usuario) {
  if (
    !usuario ||
    typeof usuario.id !== 'string' ||
    usuario.id.trim() === '' ||
    usuario.rol !== 'supervisor'
  ) {
    throw new SinPermiso('Se requiere rol supervisor.');
  }

  return usuario;
}
