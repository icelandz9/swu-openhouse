import { CROP_DIMENSIONS_3_4, CROP_DIMENSIONS_4_3 } from '../contracts';

export interface CropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  dWidth: number;
  dHeight: number;
}

/**
 * Calculates center-crop rectangle for target aspect ratio from camera stream
 * - '3:4' Portrait: 1920x1080 -> 810x1080 crop, rendered to 1080x1440 (fits portrait frames; narrower view)
 * - '4:3' Landscape (default): 1920x1080 -> 1440x1080 crop (wide view for groups)
 */
export function calculateCrop(
  sourceWidth: number = 1920,
  sourceHeight: number = 1080,
  ratio: '3:4' | '4:3' = '4:3'
): CropRect {
  const targetAspect = ratio === '3:4' ? 3 / 4 : 4 / 3;
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

  const dims = ratio === '3:4' ? CROP_DIMENSIONS_3_4 : CROP_DIMENSIONS_4_3;

  return {
    sx: Math.round(sx),
    sy: Math.round(sy),
    sWidth: Math.round(sWidth),
    sHeight: Math.round(sHeight),
    dWidth: dims.width,
    dHeight: dims.height,
  };
}

export function calculate34Crop(
  sourceWidth: number = 1920,
  sourceHeight: number = 1080
): CropRect {
  return calculateCrop(sourceWidth, sourceHeight, '3:4');
}

export function calculate43Crop(
  sourceWidth: number = 1920,
  sourceHeight: number = 1080
): CropRect {
  return calculateCrop(sourceWidth, sourceHeight, '4:3');
}
