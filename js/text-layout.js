import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext';
import {
  getPolygonIntervalForBand,
  carveTextLineSlots,
} from '@chenglou/pretext/demos/wrap-geometry.ts';

// Prepare text once (expensive ~19ms). Re-call only when text/font changes.
function initText(text, font) {
  return prepareWithSegments(text, font);
}

// Layout text lines around a polygon obstacle. Runs every frame (cheap).
// hullPoints: array of {x, y} objects (convex hull of the solid)
// region: {x, y, width, height} canvas area for text
// lineHeight: pixel height per line
function layoutAroundObstacle(prepared, hullPoints, region, lineHeight) {
  const lines = [];
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let lineTop = region.y;

  while (lineTop + lineHeight <= region.y + region.height) {
    const bandTop = lineTop;
    const bandBottom = lineTop + lineHeight;

    // Find where the solid blocks this line band
    const blocked = [];
    if (hullPoints.length >= 3) {
      const interval = getPolygonIntervalForBand(hullPoints, bandTop, bandBottom, 15, 8);
      if (interval) blocked.push(interval);
    }

    // Carve out available text slots
    const slots = carveTextLineSlots({ left: region.x, right: region.x + region.width }, blocked);

    if (slots.length === 0) {
      lineTop += lineHeight;
      continue;
    }

    // Pick widest slot
    let slot = slots[0];
    for (let i = 1; i < slots.length; i++) {
      if (slots[i].right - slots[i].left > slot.right - slot.left) {
        slot = slots[i];
      }
    }

    const width = slot.right - slot.left;
    const line = layoutNextLine(prepared, cursor, width);
    if (line === null) break;

    lines.push({
      text: line.text,
      x: Math.round(slot.left),
      y: Math.round(lineTop),
      width: line.width,
    });

    cursor = line.end;
    lineTop += lineHeight;
  }

  return lines;
}

// Render positioned lines onto canvas
function renderLines(ctx, lines, font, color) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  for (const line of lines) {
    ctx.fillText(line.text, line.x, line.y);
  }
  ctx.restore();
}

export { initText, layoutAroundObstacle, renderLines };
