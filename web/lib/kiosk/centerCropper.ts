import { CROP_DIMENSIONS_FRAME, CROP_DIMENSIONS_4_3, FRAME_PHOTO_ASPECT, PhotoRatio } from '../contracts';

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
 * - 'frame' (default): 1920x1080 -> 986x1080 crop, the CPE frames' photo-window shape (934:1023)
 * - '4:3' Landscape: 1920x1080 -> 1440x1080 crop (wide view for groups)
 */
export function calculateCrop(
  sourceWidth: number = 1920,
  sourceHeight: number = 1080,
  ratio: PhotoRatio = 'frame'
): CropRect {
  const targetAspect = ratio === 'frame' ? FRAME_PHOTO_ASPECT : 4 / 3;
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

  const dims = ratio === 'frame' ? CROP_DIMENSIONS_FRAME : CROP_DIMENSIONS_4_3;

  return {
    sx: Math.round(sx),
    sy: Math.round(sy),
    sWidth: Math.round(sWidth),
    sHeight: Math.round(sHeight),
    dWidth: dims.width,
    dHeight: dims.height,
  };
}


export function calculate43Crop(
  sourceWidth: number = 1920,
  sourceHeight: number = 1080
): CropRect {
  return calculateCrop(sourceWidth, sourceHeight, '4:3');
}
