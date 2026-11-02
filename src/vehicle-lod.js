import { Vector3 } from 'three';

const center = new Vector3();
/** Project a bounding sphere into CSS pixels. Resolution scaling must not change
 * detail selection. A sphere crossing the near plane keeps the detailed LOD. */
export function vehicleProjectedDiameter(camera, worldCenter, radius, viewportHeight) {
  if (!(radius > 0) || !(viewportHeight > 0)) return 0;
  center.copy(worldCenter).applyMatrix4(camera.matrixWorldInverse);
  const depth = -center.z;
  if (depth + radius <= 0) return 0;
  if (depth - radius <= camera.near) return Infinity;
  if (camera.isOrthographicCamera) {
    return 2 * radius * camera.zoom * viewportHeight / (camera.top-camera.bottom);
  }
  const focal = Math.abs(camera.projectionMatrix.elements[5]);
  return radius * focal * viewportHeight / Math.sqrt(depth*depth-radius*radius);
}

/** Race/far thresholds are intentionally in pixels, with a dead band. Garage
 * is selected explicitly by its renderer, never requested by race proximity. */
export function selectVehicleLOD(pixels, previous = 'race', { enterRace = 110, leaveRace = 80 } = {}) {
  if (!(enterRace > leaveRace && leaveRace >= 0)) throw new RangeError('Invalid LOD hysteresis');
  if (Number.isNaN(pixels)) return previous;
  if (previous === 'far') return pixels >= enterRace ? 'race' : 'far';
  return pixels < leaveRace ? 'far' : 'race';
}
