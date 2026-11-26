export class ErrorDominio extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = codigo;
    this.codigo = codigo;
  }
}

export class SinPermiso extends ErrorDominio {
  constructor(mensaje = 'Se requiere rol cajero.') {
    super('SinPermiso', mensaje);
  }
}

export class CajaNoAbierta extends ErrorDominio {
  constructor(mensaje = 'No hay una caja abierta.') {
    super('CajaNoAbierta', mensaje);
  }
}

export class CajaYaAbierta extends ErrorDominio {
  constructor(mensaje = 'El cajero ya tiene una caja abierta.') {
    super('CajaYaAbierta', mensaje);
  }
}

export class StockInsuficiente extends ErrorDominio {
  constructor(mensaje = 'No hay stock suficiente.') {
    super('StockInsuficiente', mensaje);
  }
}

export class PagosNoCuadran extends ErrorDominio {
  constructor(mensaje = 'La suma de los pagos no coincide con el total.') {
    super('PagosNoCuadran', mensaje);
  }
}

export class ProductoNoEncontrado extends ErrorDominio {
  constructor(mensaje = 'El producto no existe.') {
    super('ProductoNoEncontrado', mensaje);
  }
}

export class VentaNoEncontrada extends ErrorDominio {
  constructor(mensaje = 'La venta no existe o no pertenece al cajero.') {
    super('VentaNoEncontrada', mensaje);
  }
}

export class VentaYaAnulada extends ErrorDominio {
  constructor(mensaje = 'La venta ya fue anulada.') {
    super('VentaYaAnulada', mensaje);
  }
}

export class IdempotenciaConflicto extends ErrorDominio {
  constructor(mensaje = 'La clave de idempotencia ya fue utilizada con otro cuerpo o cajero.') {
    super('IdempotenciaConflicto', mensaje);
  }
}

export class ImporteInvalido extends ErrorDominio {
  constructor(mensaje = 'El importe debe ser un entero seguro en centavos.') {
    super('ImporteInvalido', mensaje);
  }
}

export class DatosInvalidos extends ErrorDominio {
  constructor(mensaje = 'Los datos recibidos no son válidos.') {
    super('DatosInvalidos', mensaje);
  }
}
