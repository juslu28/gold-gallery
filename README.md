# Gold Gallery

A walk-through 3D exhibition of six works on the theme of gold from the Harvard Art Museums collection, hung clockwise in date order.

| # | Work | Date | Theme |
|---|------|------|-------|
| 1 | Horus Falcon Wearing Crown of Upper and Lower Egypt with Uraeus | c. 664–525 BCE | Gold as sight |
| 2 | Gold Tetradrachm of Akragas | 406 BCE | Gold as money |
| 3 | Water-moon Avalokiteshvara (Suwŏl Kwanŭm) | 14th century | Gold as light |
| 4 | America, Your Gold and Silver Fill My People | c. 1590 | Gold as plunder |
| 5 | Fans on a Stream in a Landscape (Ogi nagashi byōbu) | 18th century | Gold as ground |
| 6 | Nocturne in Grey and Gold: Chelsea Snow (Whistler) | 1876 | Gold as atmosphere |

## View it

Turn on GitHub Pages (Settings → Pages → Deploy from a branch → `main` / root) and open the published link, or download the repo and double-click `index.html`. three.js loads from the jsDelivr CDN, so you need an internet connection.

## Controls

- **Desktop:** `W A S D` or arrow keys to walk, mouse to look (click the view first), `Shift` to walk faster. Aim at a work and press `E` or click to open its wall label. `1`–`6` walk you straight to a work. `Esc` frees the mouse.
- **Phone / tablet:** joystick at bottom left to walk, drag to look, tap a work to read its label, tap a number to walk to it.

## Files

```
index.html        the page, with the exhibition title and checklist of works
css/style.css     entrance screen, wall-label panel, on-screen controls
js/artworks.js    exhibition text: titles, dates, wall labels, credit lines
js/museum.js      the 3D room, lighting, hanging, movement and interaction
js/textures.js    the six artwork images, embedded as WebP data URIs
```

## Credits

Images and object data: Harvard Art Museums. Photo © President and Fellows of Harvard College, shown at reduced size for educational, noncommercial use. Each wall label links to the museum's record for the work. The wall-label texts were written for this exhibition and are not the museum's own.

3D engine: [three.js](https://threejs.org) r149 (MIT). Fonts: Bodoni Moda, Public Sans and IBM Plex Mono via Google Fonts.

The MIT license in this repository covers the code and exhibition text, not the artwork photographs.
