import {test} from 'node:test'
import assert from 'node:assert/strict'
import {exigirSupervisor} from '../../src/dominio/permisos.js'
import {
  CajaNoAbierta,
  DatosInvalidos,
  IdempotenciaConflicto,
  SinPermiso,
  VentaNoEncontrada,
} from '../../src/dominio/errores.js'
import {Producto} from '../../src/dominio/producto.js'
import {cajero, crearContexto, obtenerStocks, ventaBase} from './ayudas.js'

const supervisor = {id: 'sup-1', rol: 'supervisor'}

test('un supervisor puede anular', () => {
    const usuario = {id: 'sup-1', rol:'supervisor'}
    assert.equal(exigirSupervisor(usuario), usuario)
})

test('un cajero no puede anular',() =>{
    assert.throws(()=> exigirSupervisor({id:'caj-1', rol:'cajero'}), SinPermiso)
})

test('sin usuario no puede anular',() =>{
    assert.throws(()=> exigirSupervisor(null), SinPermiso)
})

test('restituir stock suma la cantidad sin tocar el producto original',() =>{
    const producto = new Producto ({id:'p-1', nombre: 'Yerba', precioCentavos: 1500, stock:3})
    const restituido = producto.conStockRestituido(2)
    assert.equal(restituido.stock, 5)
    assert.equal(producto.stock, 3)
})

async function venderConfirmada(contexto) {
  await contexto.abrirCaja({usuario: cajero, montoInicialCentavos: 0})
  const {venta} = await contexto.registrarVenta({
    usuario: cajero,
    claveIdempotencia: 'venta-anulable',
    ...ventaBase,
  })
  return venta
}

test('el supervisor anula una venta: restituye stock y descuenta el efectivo de la caja', async () => {
  const contexto = crearContexto()
  const stockInicial = await obtenerStocks(contexto)
  const venta = await venderConfirmada(contexto)

  const {anulacion, replay} = await contexto.anularVenta({
    usuario: supervisor,
    claveIdempotencia: 'anular-1',
    ventaId: venta.id,
    motivo: 'Error de carga',
  })

  assert.equal(replay, false)
  assert.equal(anulacion.ventaId, venta.id)
  assert.equal(anulacion.supervisorId, supervisor.id)
  assert.equal(anulacion.motivo, 'Error de carga')
  assert.deepEqual(await obtenerStocks(contexto), stockInicial)

  const caja = await contexto.obtenerCajaActual({usuario: cajero})
  assert.equal(caja.calcularMontoEsperadoCentavos(), 0)
})

test('rechaza una anulación sin motivo y no cambia stock ni caja', async () => {
  const contexto = crearContexto()
  const venta = await venderConfirmada(contexto)
  const stockAntes = await obtenerStocks(contexto)

  await assert.rejects(
    () => contexto.anularVenta({
      usuario: supervisor,
      claveIdempotencia: 'anular-2',
      ventaId: venta.id,
      motivo: '   ',
    }),
    DatosInvalidos,
  )

  assert.deepEqual(await obtenerStocks(contexto), stockAntes)
  const caja = await contexto.obtenerCajaActual({usuario: cajero})
  assert.equal(caja.calcularMontoEsperadoCentavos(), 1500)
})

test('un cajero no puede anular una venta', async () => {
  const contexto = crearContexto()
  const venta = await venderConfirmada(contexto)
  const stockAntes = await obtenerStocks(contexto)

  await assert.rejects(
    () => contexto.anularVenta({
      usuario: cajero,
      claveIdempotencia: 'anular-3',
      ventaId: venta.id,
      motivo: 'Intento',
    }),
    SinPermiso,
  )

  assert.deepEqual(await obtenerStocks(contexto), stockAntes)
})

test('no anula una venta que no existe', async () => {
  const contexto = crearContexto()

  await assert.rejects(
    () => contexto.anularVenta({
      usuario: supervisor,
      claveIdempotencia: 'anular-4',
      ventaId: 'venta-inexistente',
      motivo: 'Prueba',
    }),
    VentaNoEncontrada,
  )
})

test('no anula dos veces la misma venta aunque cambie la clave de idempotencia', async () => {
  const contexto = crearContexto()
  const stockInicial = await obtenerStocks(contexto)
  const venta = await venderConfirmada(contexto)

  await contexto.anularVenta({
    usuario: supervisor,
    claveIdempotencia: 'anular-5a',
    ventaId: venta.id,
    motivo: 'Primera',
  })

  await assert.rejects(
    () => contexto.anularVenta({
      usuario: supervisor,
      claveIdempotencia: 'anular-5b',
      ventaId: venta.id,
      motivo: 'Segunda',
    }),
    (error) => error.codigo === 'VentaYaAnulada',
  )

  const stockTrasUnaAnulacion = await obtenerStocks(contexto)
  assert.deepEqual(stockTrasUnaAnulacion, stockInicial)
})

test('reintentar con la misma clave devuelve la anulación guardada sin restituir stock otra vez', async () => {
  const contexto = crearContexto()
  const stockInicial = await obtenerStocks(contexto)
  const venta = await venderConfirmada(contexto)

  const primera = await contexto.anularVenta({
    usuario: supervisor,
    claveIdempotencia: 'anular-6',
    ventaId: venta.id,
    motivo: 'Duplicado',
  })
  const reintento = await contexto.anularVenta({
    usuario: supervisor,
    claveIdempotencia: 'anular-6',
    ventaId: venta.id,
    motivo: 'Duplicado',
  })

  assert.equal(reintento.replay, true)
  assert.equal(reintento.anulacion.id, primera.anulacion.id)
  assert.deepEqual(await obtenerStocks(contexto), stockInicial)
})

test('misma clave con otro motivo se rechaza sin efectos', async () => {
  const contexto = crearContexto()
  const venta = await venderConfirmada(contexto)

  await contexto.anularVenta({
    usuario: supervisor,
    claveIdempotencia: 'anular-7',
    ventaId: venta.id,
    motivo: 'Uno',
  })

  await assert.rejects(
    () => contexto.anularVenta({
      usuario: supervisor,
      claveIdempotencia: 'anular-7',
      ventaId: venta.id,
      motivo: 'Otro',
    }),
    IdempotenciaConflicto,
  )
})

test('no anula una venta cuya caja ya está cerrada', async () => {
  const contexto = crearContexto()
  const venta = await venderConfirmada(contexto)
  await contexto.cerrarCaja({usuario: cajero, montoContadoCentavos: 1500})

  await assert.rejects(
    () => contexto.anularVenta({
      usuario: supervisor,
      claveIdempotencia: 'anular-8',
      ventaId: venta.id,
      motivo: 'Tarde',
    }),
    CajaNoAbierta,
  )
})
