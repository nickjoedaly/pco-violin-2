# Violin 2 Practice Room

A small practice site for the Pocono Community Orchestra Violin 2 section, built around
Chris Souza's rehearsal recordings of 22 September 2026.

## What it does

Each piece gets a player with:

- **Chunk navigation** — click a chunk on the strip or in the list to loop it
- **A/B loop** — set your own loop points when a chunk boundary is wrong
- **Speed control** — 50–110%, pitch preserved, so slow practice stays in tune
- **Count-in** — four clicks before each loop restart
- **Marker editing** — rename chunks to real rehearsal letters or bar numbers

Plus a score slot and performance notes per piece.

## Structure

```
index.html          hub
piece.html          per-piece view (piece.html?p=<id>)
assets/data.js      all content: pieces, tracks, chunks, notes
assets/player.js    player
assets/style.css    styles
audio/              rehearsal audio (m4a)
scores/             scanned parts go here
```

Everything is static — no build step. Open `index.html` directly or serve the folder.

## Chunk markers

Chunk boundaries were detected automatically from changes in the recording's spectral
texture, then named `Chunk 1`, `Chunk 2`… They are a scaffold, not rehearsal letters.

Rename them in the browser via **Edit markers**; changes save to `localStorage` immediately.
To make them permanent for everyone, copy the JSON the editor prints into the matching
track in `assets/data.js` and commit.

## Audio

Source files were 8 kHz mono AMR voice memos from a phone. They were loudness-normalised
and transcoded to AAC for the web — browsers cannot play AMR. Untouched originals live in
Google Drive under *Groups + Activities → Pocono Community Orchestra*.

## Password

The site is gated by a password (`assets/auth.js`). The password is not stored in the
source — only a PBKDF2-SHA256 hash of it, with a salt and 150,000 iterations. Once entered
it is remembered in `localStorage`, so the section enters it once per browser.

To change it, derive a new hash and replace `SALT`/`HASH` in `assets/auth.js`:

```bash
python3 -c "import hashlib,os,binascii; s=os.urandom(16); \
print('SALT',binascii.hexlify(s).decode()); \
print('HASH',binascii.hexlify(hashlib.pbkdf2_hmac('sha256',b'NEWPASSWORD',s,150000,32)).decode())"
```

### What the gate does and does not do

It stops someone who lands on the URL from browsing the site, and it keeps the password
out of the source. It is **not** security:

- The site is static, so `audio/peter-1.m4a` and everything under `scores/` can be fetched
  directly by URL without the gate ever loading.
- All of the gate's code is readable in view-source.

If the password needs to actually mean something, the options are to encrypt the audio and
scores at rest and decrypt them in-browser with a key derived from the password, or to put
the whole site behind a real access proxy (Cloudflare Access's free tier does this with
email one-time codes).

## Not for distribution

These are rehearsal recordings of works still under copyright, kept for our own section's
practice.
