import { describe, expect, it } from 'vitest'
import { calibrateStation } from '../src/core/calibration'
import { identity, isOrthonormal } from '../src/core/vec'
import {
  defaultState,
  exportJson,
  importJson,
  migrate,
  type AppState,
} from '../src/store/persist'
import { createStation, uniqueName } from '../src/store/stations'
import { DEFAULT_VEHICLE, sanitizeVehicle } from '../src/store/vehicle'

const withStation = (): AppState => {
  const state = defaultState()
  const station = createStation('Cruscotto', calibrateStation([0, 0, 1], 'top'))
  state.stations = [station]
  state.activeStationId = station.id
  return state
}

describe('migrazione dello stato salvato', () => {
  it('un contenuto assente dà lo stato di default', () => {
    expect(migrate(undefined)).toEqual(defaultState())
    expect(migrate('non un oggetto')).toEqual(defaultState())
    expect(migrate(null)).toEqual(defaultState())
  })

  it('conserva uno stato valido', () => {
    const state = withStation()
    expect(migrate(state)).toEqual(state)
  })

  it('scarta le postazioni con matrice non valida', () => {
    const broken = {
      stations: [
        { id: 'a', name: 'Rotta', matrix: [1, 2, 3], createdAt: 1, derivedFrom: null, quality: 'measured' },
        { id: 'b', name: 'Zeri', matrix: new Array(9).fill(0), createdAt: 1, derivedFrom: null, quality: 'measured' },
        { id: 'c', name: 'Nan', matrix: new Array(9).fill(Number.NaN), createdAt: 1, derivedFrom: null, quality: 'measured' },
        { id: 'd', name: 'Scalata', matrix: [2, 0, 0, 0, 2, 0, 0, 0, 2], createdAt: 1, derivedFrom: null, quality: 'measured' },
      ],
    }
    expect(migrate(broken).stations).toEqual([])
  })

  it('raddrizza una matrice sporcata dall’arrotondamento del JSON', () => {
    const almost = [1.0000004, 0, 0, 0, 0.9999995, 0, 0, 0, 1.0000002]
    const state = migrate({
      stations: [
        { id: 'a', name: 'Tavolo', matrix: almost, createdAt: 1, derivedFrom: null, quality: 'measured' },
      ],
    })
    expect(state.stations).toHaveLength(1)
    expect(isOrthonormal(state.stations[0].matrix as never, 1e-12)).toBe(true)
  })

  it('una postazione attiva inesistente ricade sulla prima disponibile', () => {
    const state = withStation()
    const migrated = migrate({ ...state, activeStationId: 'sparita' })
    expect(migrated.activeStationId).toBe(state.stations[0].id)
  })

  it('senza postazioni non c’è postazione attiva', () => {
    expect(migrate({ activeStationId: 'x' }).activeStationId).toBeNull()
  })

  it('completa i campi aggiunti dopo, senza perdere il resto', () => {
    // Uno stato scritto da una versione che non conosceva tolleranza e tema.
    const old = {
      schemaVersion: 1,
      vehicle: { trackWidth: 2.1, wheelbase: 3.9, rearAxles: 2, name: 'Ducato' },
      stations: [],
      activeStationId: null,
      units: 'mm',
    }
    const migrated = migrate(old)
    expect(migrated.vehicle).toEqual({ trackWidth: 2.1, wheelbase: 3.9, rearAxles: 2, name: 'Ducato' })
    expect(migrated.units).toBe('mm')
    expect(migrated.toleranceDeg).toBe(1)
    expect(migrated.theme).toBe('day')
    expect(migrated.beep).toBe(false)
  })

  it('riporta la tolleranza dentro limiti sensati', () => {
    expect(migrate({ toleranceDeg: 0 }).toleranceDeg).toBe(0.1)
    expect(migrate({ toleranceDeg: 90 }).toleranceDeg).toBe(5)
    expect(migrate({ toleranceDeg: 'due' }).toleranceDeg).toBe(1)
  })

  it('la soglia del tono continuo ha limiti suoi', () => {
    expect(migrate({ beepToleranceDeg: 0 }).beepToleranceDeg).toBe(0.1)
    expect(migrate({ beepToleranceDeg: 90 }).beepToleranceDeg).toBe(5)
  })

  it('senza soglia del beep si eredita quella della bolla, com’era prima', () => {
    expect(migrate({ toleranceDeg: 2.5 }).beepToleranceDeg).toBe(2.5)
    expect(migrate({}).beepToleranceDeg).toBe(1)
  })

  it('le due soglie restano indipendenti quando ci sono entrambe', () => {
    const state = migrate({ toleranceDeg: 1, beepToleranceDeg: 2.4 })
    expect(state.toleranceDeg).toBe(1)
    expect(state.beepToleranceDeg).toBe(2.4)
  })

  it('conserva la qualità dichiarata della postazione', () => {
    const state = withStation()
    state.stations[0].quality = 'transferred'
    state.stations[0].derivedFrom = 'origine'
    const migrated = migrate(state)
    expect(migrated.stations[0].quality).toBe('transferred')
    expect(migrated.stations[0].derivedFrom).toBe('origine')
  })
})

describe('temi', () => {
  it('un salvataggio senza tema parte da quello chiaro', () => {
    expect(migrate({}).theme).toBe('day')
  })

  it('il vecchio interruttore notte diventa il tema rosso', () => {
    expect(migrate({ nightMode: true }).theme).toBe('red')
    expect(migrate({ nightMode: false }).theme).toBe('day')
  })

  it('un tema sconosciuto non manda la app in un aspetto senza colori', () => {
    expect(migrate({ theme: 'fucsia' }).theme).toBe('day')
  })

  it('un tema noto sopravvive al giro di salvataggio', () => {
    for (const theme of ['day', 'sand', 'dusk', 'night', 'amber', 'red'] as const) {
      expect(migrate({ theme }).theme).toBe(theme)
    }
  })

  it('il tema esplicito vince sul vecchio interruttore', () => {
    expect(migrate({ theme: 'day', nightMode: true }).theme).toBe('day')
  })
})

describe('export e import', () => {
  it('round-trip senza perdite', () => {
    const state = withStation()
    expect(importJson(exportJson(state))).toEqual(state)
  })

  it('un JSON non valido è un errore, non uno stato vuoto silenzioso', () => {
    expect(() => importJson('{ non json')).toThrow()
  })

  it('un JSON valido ma estraneo ricade sui default', () => {
    expect(importJson('{"altro":true}')).toEqual(defaultState())
  })
})

describe('veicolo', () => {
  it('rifiuta dimensioni assurde e valori non numerici', () => {
    expect(sanitizeVehicle({ trackWidth: 0, wheelbase: 900 })).toMatchObject({
      trackWidth: 0.5,
      wheelbase: 12,
    })
    expect(sanitizeVehicle({ trackWidth: 'largo' })).toMatchObject({
      trackWidth: DEFAULT_VEHICLE.trackWidth,
    })
  })

  it('accetta solo uno o due assi posteriori', () => {
    expect(sanitizeVehicle({ rearAxles: 2 }).rearAxles).toBe(2)
    expect(sanitizeVehicle({ rearAxles: 7 }).rearAxles).toBe(1)
  })

  it('un nome vuoto ricade sul default', () => {
    expect(sanitizeVehicle({ name: '   ' }).name).toBe(DEFAULT_VEHICLE.name)
  })
})

describe('nomi delle postazioni', () => {
  it('evita i duplicati, che nel selettore sono indistinguibili', () => {
    const stations = [
      createStation('Cruscotto', identity()),
      createStation('Cruscotto 2', identity()),
    ]
    expect(uniqueName(stations, 'Cruscotto')).toBe('Cruscotto 3')
    expect(uniqueName(stations, 'Tavolo')).toBe('Tavolo')
  })

  it('un nome vuoto diventa un nome utilizzabile', () => {
    expect(uniqueName([], '  ')).toBe('Postazione')
    expect(createStation('', identity()).name).toBe('Postazione')
  })
})
