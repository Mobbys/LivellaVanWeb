/** Stato dell'applicazione: veicolo, postazioni, preferenze. Persistito a ogni modifica. */

import type { Mat3 } from '../core/vec'
import {
  defaultState,
  load,
  save,
  type AppState,
  type Station,
  type StationQuality,
  type Units,
} from './persist'
import { createStation, findStation, stationMatrix, uniqueName } from './stations'
import type { Vehicle } from './vehicle'

class AppStore {
  private data = $state<AppState>(defaultState())
  /** Falso se localStorage non accetta scritture: la UI deve poterlo dire. */
  persisted = $state(true)

  constructor() {
    this.data = load()
  }

  get state(): AppState {
    return this.data
  }

  get vehicle(): Vehicle {
    return this.data.vehicle
  }

  get stations(): Station[] {
    return this.data.stations
  }

  get activeStation(): Station | null {
    return findStation(this.data.stations, this.data.activeStationId)
  }

  get activeMatrix(): Mat3 | null {
    const station = this.activeStation
    return station === null ? null : stationMatrix(station)
  }

  get units(): Units {
    return this.data.units
  }

  get toleranceDeg(): number {
    return this.data.toleranceDeg
  }

  get nightMode(): boolean {
    return this.data.nightMode
  }

  get beep(): boolean {
    return this.data.beep
  }

  setVehicle(vehicle: Vehicle): void {
    this.data.vehicle = vehicle
    this.persist()
  }

  addStation(name: string, matrix: Mat3, quality: StationQuality, derivedFrom: string | null): Station {
    const station = createStation(uniqueName(this.data.stations, name), matrix, quality, derivedFrom)
    this.data.stations = [...this.data.stations, station]
    // Una postazione appena creata è quella che si sta usando.
    this.data.activeStationId = station.id
    this.persist()
    return station
  }

  renameStation(id: string, name: string): void {
    const others = this.data.stations.filter((station) => station.id !== id)
    this.data.stations = this.data.stations.map((station) =>
      station.id === id ? { ...station, name: uniqueName(others, name) } : station,
    )
    this.persist()
  }

  removeStation(id: string): void {
    this.data.stations = this.data.stations.filter((station) => station.id !== id)
    if (this.data.activeStationId === id) {
      this.data.activeStationId = this.data.stations[0]?.id ?? null
    }
    this.persist()
  }

  setActiveStation(id: string | null): void {
    this.data.activeStationId = id
    this.persist()
  }

  setUnits(units: Units): void {
    this.data.units = units
    this.persist()
  }

  setTolerance(deg: number): void {
    this.data.toleranceDeg = Math.min(5, Math.max(0.1, deg))
    this.persist()
  }

  setNightMode(on: boolean): void {
    this.data.nightMode = on
    this.persist()
  }

  setBeep(on: boolean): void {
    this.data.beep = on
    this.persist()
  }

  /** Import da JSON: sostituisce tutto, è un ripristino di backup. */
  replaceAll(state: AppState): void {
    this.data = state
    this.persist()
  }

  private persist(): void {
    this.persisted = save($state.snapshot(this.data) as AppState)
  }
}

export const app = new AppStore()
