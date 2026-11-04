export class ErrorDeAnulacion extends Error
{
    constructor (codigo, mensaje)
    {
        super(mensaje)
        this.codigo = codigo;
    }
}

export function anularVenta({venta, usuario, motivo, fecha})
{
    if (usuario.rol !== 'supervisor')
    {
        throw new ErrorDeAnulacion('SIN_PERMISO','Solo un supervisor')
    }
    const motivoLimpio  = (motivo ?? '').trim()
    if (motivoLimpio === '')
    {
        throw new ErrorDeAnulacion('MOTIVO_OBLIGATORIO', 'El motivo es obligatorio')
    }
    if (venta.estado !== 'confirmada')
    {
        throw new ErrorDeAnulacion('VENTA_NO_ANULABLE', 'Solo se anulan ventas confirmadas')
    }
    return{
        tipo: 'anulacion',
        ventaId: venta.id,
        usuarioId: usuario.id,
        motivo: motivoLimpio,
        fecha,
    }
}















