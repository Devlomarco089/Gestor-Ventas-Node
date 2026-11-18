import {test} from 'node:test'
import assert from 'node:assert/strict'
import {exigirSupervisor} from '../../src/dominio/permisos.js'
import {SinPermiso} from '../../src/dominio/errores.js'

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



