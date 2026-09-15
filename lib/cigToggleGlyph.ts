/**
 * THE TAG MENU'S PLUS AND MINUS, as the owner drew them.
 *
 * Supplied as two SVGs, kept in `scripts/assets/tag-plus.svg` and
 * `tag-minus.svg`: a pinwheel of four rounded bars about a centre dot, and a
 * bar with an eye in the middle of it. They replace the two plain bars the
 * button used to draw, which were only ever there because the owner's face
 * carries no + or - to set.
 *
 * DRAWN INLINE AND FILLED WITH currentColor, not loaded as an image. The
 * button inverts under the pointer — black ground, white mark — and an
 * <img> cannot inherit that. The owner's files paint the glyph a warm brown
 * on cream; both of those go and the mark takes the button's own ink
 * colour, which is what "black instead" means here and is what keeps the
 * inversion working.
 *
 * SIZED TO SIT INSIDE THE OUTLINE. The button is 30px square with a 2px
 * rule, so 26 of it is free; the plus is given 16 of that, which leaves 5
 * clear on every side. The minus takes THE SAME SCALE rather than the same
 * width, so the two keep the relationship they were drawn with — the owner's
 * minus is a little wider than their plus and a little over a third as tall.
 *
 * Each viewBox is that glyph's own ink box, measured off a render of the
 * file at 4x rather than read off the artwork's frame, which is mostly empty
 * around the mark. The transform is the one the file carries, so the path
 * below is the owner's character for character.
 */
export type CigGlyph = {
  viewBox: string;
  transform: string;
  d: string;
  fillRule: 'nonzero' | 'evenodd';
  width: number;
  height: number;
};

export const CIG_TOGGLE_GLYPH: { plus: CigGlyph; minus: CigGlyph } = {
  plus: {
    viewBox: "119.9 146.25 300 300",
    transform: "translate(90.0,90.0) scale(0.600)",
    fillRule: "nonzero",
    width: 16,
    height: 16,
    d: "M488.0 224.0 C520.7 224.3 548.0 251.1 548.0 284.0 C548.0 316.9 520.7 343.7 488.0 344.0 C456.7 344.3 425.3 344.3 394.0 344.0 C372.7 343.8 352.7 332.5 342.0 314.0 C336.8 304.9 334.0 294.5 334.0 284.0 C334.0 273.5 336.8 263.1 342.0 254.0 C352.7 235.5 372.7 224.2 394.0 224.0 C425.3 223.7 456.7 223.7 488.0 224.0 Z M420.0 532.0 C419.7 564.7 392.9 592.0 360.0 592.0 C327.1 592.0 300.3 564.7 300.0 532.0 C299.7 500.7 299.7 469.3 300.0 438.0 C300.2 416.7 311.5 396.7 330.0 386.0 C339.1 380.8 349.5 378.0 360.0 378.0 C370.5 378.0 380.9 380.8 390.0 386.0 C408.5 396.7 419.8 416.7 420.0 438.0 C420.3 469.3 420.3 500.7 420.0 532.0 Z M112.0 464.0 C79.3 463.7 52.0 436.9 52.0 404.0 C52.0 371.1 79.3 344.3 112.0 344.0 C143.3 343.7 174.7 343.7 206.0 344.0 C227.3 344.2 247.3 355.5 258.0 374.0 C263.2 383.1 266.0 393.5 266.0 404.0 C266.0 414.5 263.2 424.9 258.0 434.0 C247.3 452.5 227.3 463.8 206.0 464.0 C174.7 464.3 143.3 464.3 112.0 464.0 Z M180.0 156.0 C180.3 123.3 207.1 96.0 240.0 96.0 C250.5 96.0 260.9 98.8 270.0 104.0 C288.5 114.7 299.8 134.7 300.0 156.0 C300.3 187.3 300.3 218.7 300.0 250.0 C299.7 282.7 272.9 310.0 240.0 310.0 C229.5 310.0 219.1 307.2 210.0 302.0 C191.5 291.3 180.2 271.3 180.0 250.0 C179.7 218.7 179.7 187.3 180.0 156.0 Z M333.0 344.0 C333.0 362.0 318.0 377.0 300.0 377.0 C282.0 377.0 267.0 362.0 267.0 344.0 C267.0 326.0 282.0 311.0 300.0 311.0 C318.0 311.0 333.0 326.0 333.0 344.0 Z",
  },
  minus: {
    viewBox: "77 231.8 337.8 129",
    transform: "translate(90.0,90.0) scale(0.600)",
    fillRule: "nonzero",
    width: 18.02,
    height: 6.88,
    d: "M40.0 283.8 C78.2 283.5 116.8 282.7 153.7 271.4 C188.8 260.7 222.3 238.0 260.0 238.0 C297.7 238.0 331.2 260.7 366.3 271.4 C403.2 282.7 441.8 283.5 480.0 283.8 L480.0 404.0 C559.8 398.8 559.8 289.2 480.0 284.0 L480.0 404.2 C441.8 404.5 403.2 405.3 366.3 416.6 C331.2 427.3 297.7 450.0 260.0 450.0 C222.3 450.0 188.8 427.3 153.7 416.6 C116.8 405.3 78.2 404.5 40.0 404.2 L40.0 284.0 C-39.8 289.2 -39.8 398.8 40.0 404.0 L40.0 283.8 Z M260.0 286.0 C228.4 286.0 202.0 312.4 202.0 344.0 C202.0 375.6 228.4 402.0 260.0 402.0 C291.6 402.0 318.0 375.6 318.0 344.0 C318.0 312.4 291.6 286.0 260.0 286.0 Z M286.7 344.0 C286.7 358.5 274.5 370.7 260.0 370.7 C245.5 370.7 233.3 358.5 233.3 344.0 C233.3 329.5 245.5 317.3 260.0 317.3 C274.5 317.3 286.7 329.5 286.7 344.0 Z",
  },
};
