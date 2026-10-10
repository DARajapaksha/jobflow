import { describe, expect, it } from 'vitest';
import { rotatedSize } from './cropImage';

describe('rotatedSize', () => {
  it('swaps width and height for quarter turns', () => {
    expect(rotatedSize(800, 400, 0)).toEqual({ width: 800, height: 400 });
    expect(rotatedSize(800, 400, 90)).toEqual({ width: 400, height: 800 });
    expect(rotatedSize(800, 400, 180)).toEqual({ width: 800, height: 400 });
    expect(rotatedSize(800, 400, 270)).toEqual({ width: 400, height: 800 });
  });
});
