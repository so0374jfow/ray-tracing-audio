// Small top banner shown on every page. The rights-holder name is drawn onto
// a <canvas> rather than emitted as DOM text, so it is visible to a viewer
// but is not a selectable/copyable string and is not present in the page's
// crawlable text content.
const RIGHTS_HOLDER_NAME = 'Andrej Arpad Ambroz Harnist';

function drawNameCanvas(fontSize, color) {
  const dpr = window.devicePixelRatio || 1;
  const font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const width = Math.ceil(measure.measureText(RIGHTS_HOLDER_NAME).width) + 2;
  const height = Math.ceil(fontSize * 1.4);

  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.cssText = `width:${width}px;height:${height}px;display:inline-block;vertical-align:-3px;`;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'rights holder name');

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(RIGHTS_HOLDER_NAME, 1, height / 2);

  return canvas;
}

export function initCopyrightBanner() {
  const bar = document.createElement('div');
  bar.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'height:20px',
    'line-height:20px',
    'background:rgba(0,0,0,0.6)',
    'color:#fff',
    'font-size:10px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif',
    'text-align:right',
    'padding:0 10px',
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'z-index:2147483647',
    'pointer-events:none',
    'user-select:none',
  ].join(';');

  const prefix = document.createElement('span');
  prefix.textContent = 'Confidential preview — © 2026 ';
  bar.appendChild(prefix);

  bar.appendChild(drawNameCanvas(10, '#ffffff'));

  const suffix = document.createElement('span');
  suffix.textContent = '. All rights reserved worldwide. Not for distribution. ';
  bar.appendChild(suffix);

  const link = document.createElement('a');
  link.href = './notice.html';
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Full notice';
  link.style.cssText = 'color:#fff;text-decoration:underline;pointer-events:auto;';
  bar.appendChild(link);

  document.body.appendChild(bar);
}

initCopyrightBanner();
