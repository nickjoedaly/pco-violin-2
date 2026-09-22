/* Password gate.
 *
 * This is a deterrent, not security. The site is static: anyone who knows or
 * guesses a file path can fetch audio/*.m4a and scores/* directly without ever
 * loading a page, and all of this code is readable in view-source. What it does
 * buy is that the page is not browsable by someone who stumbles on the URL, and
 * the password itself is not sitting in the source in plaintext.
 *
 * If the password needs to actually mean something, the assets have to be
 * encrypted at rest or put behind a real access proxy. See README.
 */
(function () {
  const SALT = '91797cd0b395a7ef7acfb2b2918ca968';
  const HASH = '0922a515e4581a86b8d1bdd86723a05a7be624033b95c717717dddd445b47dc8';
  const ITER = 150000;
  const KEY  = 'pco:unlocked';

  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const unhex = s => new Uint8Array(s.match(/../g).map(h => parseInt(h, 16)));

  async function derive(pw) {
    const base = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: unhex(SALT), iterations: ITER, hash: 'SHA-256' }, base, 256);
    return hex(bits);
  }

  function reveal() {
    document.documentElement.classList.add('unlocked');
    const g = document.getElementById('gate');
    if (g) g.remove();
  }

  function gate() {
    const el = document.createElement('div');
    el.id = 'gate';
    el.innerHTML = `
      <form class="gate-card" autocomplete="on">
        <div class="gate-kicker">Pocono Community Orchestra</div>
        <h1>Violin 2 Practice Room</h1>
        <p>This page is for our section. Enter the password to continue.</p>
        <input type="password" name="password" placeholder="Password" autofocus
               autocomplete="current-password" aria-label="Password">
        <button type="submit">Enter</button>
        <p class="gate-err" hidden>That is not it. Try again.</p>
      </form>`;
    document.body.appendChild(el);

    const form = el.querySelector('form');
    const input = el.querySelector('input');
    const err = el.querySelector('.gate-err');
    const btn = el.querySelector('button');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      btn.disabled = true; btn.textContent = 'Checking…';
      const ok = (await derive(input.value)) === HASH;
      if (ok) {
        try { localStorage.setItem(KEY, HASH); } catch (_) {}
        reveal();
      } else {
        err.hidden = false;
        input.value = ''; input.focus();
        btn.disabled = false; btn.textContent = 'Enter';
      }
    });
  }

  let unlocked = false;
  try { unlocked = localStorage.getItem(KEY) === HASH; } catch (_) {}

  if (unlocked) {
    // documentElement exists before DOMContentLoaded, so this avoids a flash
    document.documentElement.classList.add('unlocked');
  } else {
    document.addEventListener('DOMContentLoaded', gate);
  }
})();
