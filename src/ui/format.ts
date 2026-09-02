/**
 * Confine con la UI: qui e solo qui i metri e i radianti diventano centimetri
 * e gradi, con la virgola decimale italiana.
 */

import { metersToCm, roundToStep } from '../core/leveling'
import { radToDeg } from '../core/vec'
import type { Units } from '../store/persist'

/** Con i cunei sotto le ruote mezzo centimetro è già il limite dell'utile. */
export const STEP_CM = 0.5
export const STEP_MM = 5

export function liftValue(meters: number, units: Units): number {
  const cm = metersToCm(meters)
  return units === 'mm' ? roundToStep(cm * 10, STEP_MM) : roundToStep(cm, STEP_CM)
}

export const unitLabel = (units: Units): string => (units === 'mm' ? 'mm' : 'cm')

export const formatNumber = (value: number): string =>
  value.toLocaleString('it-IT', { maximumFractionDigits: 1 })

export const formatLift = (meters: number, units: Units): string =>
  `${formatNumber(liftValue(meters, units))} ${unitLabel(units)}`

export const formatDegrees = (radians: number): string =>
  `${radToDeg(radians).toLocaleString('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}°`
