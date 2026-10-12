# Landing hero picture

Put the rendered studio picture here as `hero-studio.jpg` (a 16:9 image of about 1920 px wide or more works best).
When the file exists, the landing page shows it instead of the built-in 3D studio, and draws the sketch-to-concept
animation on top of the desktop display.

Tell the page where the display's glass sits in the picture by editing `monitor` in
`src/app/views/landing/heroConfig.ts`. The four numbers are fractions of the picture's width and height:

- `x`, `y`: the glass's top-left corner
- `w`, `h`: the glass's width and height

Without a file here the page uses the 3D studio (or a flat version of it when WebGL is unavailable, motion is
reduced or Save-Data is on).
