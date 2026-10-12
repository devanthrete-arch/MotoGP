// The hero studio picture. Drop a rendered image at public/landing/hero-studio.jpg and the page uses it in
// place of the built-in 3D studio. `monitor` says where the glass of the desktop display sits in the picture,
// as fractions of its width and height, so the concept animation can be drawn exactly on it.
export const heroImage = {
  src: "/landing/hero-studio.jpg",
  /** Pixel size of the picture; only the proportions matter. */
  width: 1920,
  height: 1020,
  monitor: { x: 0.414, y: 0.463, w: 0.168, h: 0.179 },
};
