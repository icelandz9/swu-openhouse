import { CROP_DIMENSIONS_4_3 } from '../contracts';

export interface CropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  dWidth: number;
  dHeight: number;
}

/**
 * Calculates center-crop rectangle for 4:3 target from a 16:9 source stream
 * Source: 1920x1080 (16:9) -> Target: 1440x1080 (4:3) with 240px offset on left/right
 */
export function calculate43Crop(
  sourceWidth: number = 1920,
  sourceHeight: number = 1080
): CropRect {
  const targetAspect = 4 / 3;
  let sWidth = sourceHeight * targetAspect;
  let sHeight = sourceHeight;
  let sx = (sourceWidth - sWidth) / 2;
  let sy = 0;

  if (sWidth > sourceWidth) {
    sWidth = sourceWidth;
    sHeight = sourceWidth / targetAspect;
    sx = 0;
    sy = (sourceHeight - sHeight) / 2;
  }

  return {
    sx: Math.round(sx),
    sy: Math.round(sy),
    sWidth: Math.round(sWidth),
    sHeight: Math.round(sHeight),
    dWidth: CROP_DIMENSIONS_4_3.width,
    dHeight: CROP_DIMENSIONS_4_3.height,
  };
}
