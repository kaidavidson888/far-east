/**
 * DEV ONLY: the site as a desktop browser draws it, shrunk to fit the preview.
 *
 *   /dev/desktop                      the landing page
 *   /dev/desktop?path=/about          any page of the site
 *   /dev/desktop?w=1440&h=820         any window size
 *
 * The owner's 2026-09-19 ask: "make the dev accurate to the appearance of the
 * website on desktop". The Claude app's preview pane is about half a screen
 * wide, and this site lays everything out against the window's real edges —
 * the row's zoom, the margins, where the menu's words land — so the pane shows
 * the narrow-window version of every page. Emulating a desktop size in the
 * pane does not stick (the app clears it), so this page does it instead: the
 * site is loaded in a frame that is laid out at a true desktop viewport and
 * then scaled down, as a whole, to fit whatever room there is. Everything in
 * the frame is the real page — clickable, scrollable, signed in or not.
 *
 * THE SIZE IS THE SCREEN'S, not a guess: the width is `screen.width` and the
 * height is the screen's available height (the taskbar already taken off)
 * less 85px for Chrome's tab strip and toolbar, which is what a maximised
 * Chrome window leaves for the page on Windows without the bookmarks bar.
 * On the owner's 1920x1080 screen that is 1920x947. `w` and `h` override it.
 *
 * A route handler rather than a page, so the root layout — the nav, the
 * footer and the age gate — is not wrapped round the frame as well as drawn
 * inside it. Not served in production.
 */
const CHROME_UI = 85;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Desktop view (dev) · Far East</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #3a3a3a; }
  #frame { position: absolute; top: 0; left: 0; border: 0; background: #ffffff; transform-origin: 0 0; }
  #size { position: fixed; right: 8px; bottom: 6px; font: 11px/1 system-ui, sans-serif; color: #b8b8b8; }
</style>
</head>
<body>
<iframe id="frame" title="The site at desktop size"></iframe>
<div id="size"></div>
<script>
(() => {
  const q = new URLSearchParams(location.search);
  const W = Math.round(Number(q.get('w')) || screen.width);
  const H = Math.round(Number(q.get('h')) || Math.max(400, screen.availHeight - ${CHROME_UI}));
  // a path on this site only — never another origin
  let path = q.get('path') || '/landing';
  if (!/^\\/(?!\\/)/.test(path)) path = '/landing';
  const frame = document.getElementById('frame');
  const size = document.getElementById('size');
  frame.style.width = W + 'px';
  frame.style.height = H + 'px';
  frame.src = path;
  const fit = () => {
    const s = Math.min(1, innerWidth / W, innerHeight / H);
    const left = Math.round((innerWidth - W * s) / 2);
    frame.style.transform = 'translate(' + left + 'px, 0) scale(' + s + ')';
    size.textContent = W + ' × ' + H + ' desktop window, shown at ' + Math.round(s * 100) + '%';
    size.style.display = innerHeight - H * s >= 18 ? '' : 'none';
  };
  addEventListener('resize', fit);
  fit();
  // keep the address in step with the page inside, so a reload stays put
  frame.addEventListener('load', () => {
    try {
      const inner = frame.contentWindow.location;
      q.set('path', inner.pathname + inner.search);
      history.replaceState(null, '', location.pathname + '?' + q.toString());
      document.title = frame.contentDocument.title + ' (desktop view)';
    } catch (e) { /* not same-origin: leave the address alone */ }
  });
})();
</script>
</body>
</html>`;

export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
