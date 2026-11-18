import {test} from 'node:test'
import assert from 'node:assert/strict'
import {exigirSupervisor} from '../../src/dominio/permisos.js'
import {SinPermiso} from '../../src/dominio/errores.js'
import {Producto} from '../../src/dominio/producto.js'

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

