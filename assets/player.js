// Rehearsal player: chunk navigation, A/B loop, speed, count-in, marker editing.
const fmt = s => (s<0?'-':'') + Math.floor(Math.abs(s)/60) + ':' +
  String(Math.floor(Math.abs(s)%60)).padStart(2,'0');

const LS = k => 'pco:'+k;

class Player {
  constructor(track, root){
    this.tr = track; this.root = root;
    this.a = new Audio(track.file);
    this.a.preload = 'metadata';
    this.loopA = null; this.loopB = null; this.looping = false;
    this.countIn = false; this.ac = null;
    // user-edited chunks win over shipped defaults
    const saved = localStorage.getItem(LS('chunks:'+track.id));
    this.chunks = saved ? JSON.parse(saved) : track.chunks.map(c=>({...c}));
    (window.PCO_PLAYERS = window.PCO_PLAYERS || []).push(this);
    this.build();
    this.a.addEventListener('timeupdate', ()=>this.tick());
    this.a.addEventListener('ended', ()=>this.setPlayBtn(false));
    this.a.addEventListener('loadedmetadata', ()=>{ this.dur = this.a.duration; this.draw(); });
    this.dur = track.dur;
  }

  build(){
    const r = this.root;
    r.innerHTML = `
      <div class="track-label">${this.tr.label} · ${fmt(this.tr.dur)}</div>
      <div class="scrub" data-scrub><div class="loopband" hidden></div><div class="head"></div></div>
      <div class="row">
        <button class="play" data-play>Play</button>
        <button data-back>&minus;5s</button>
        <button data-fwd>+5s</button>
        <button data-a>Set A</button>
        <button data-b>Set B</button>
        <button data-loop>Loop off</button>
        <button data-clear>Clear</button>
        <span class="time" data-time>0:00 / ${fmt(this.tr.dur)}</span>
      </div>
      <div class="row">
        <span class="ctl">Speed <input type="range" data-speed min="50" max="110" step="5" value="100">
          <b data-speedv style="font-family:var(--mono)">100%</b></span>
        <button data-count>Count-in off</button>
        <button data-edit>Edit markers</button>
      </div>
      <div class="chunklist" data-chunks></div>
      <div class="editor" data-editor>
        <div class="row">
          <button data-addmark>Add marker at playhead</button>
          <button data-renamemark>Rename current</button>
          <button data-delmark>Delete current</button>
          <button data-reset>Reset to defaults</button>
        </div>
        <p class="hint">Markers save to this browser automatically. Copy the JSON below into
        <code>assets/data.js</code> to make them permanent for everyone.</p>
        <textarea data-json readonly></textarea>
      </div>
      <p class="hint"><kbd>space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> 5s ·
        <kbd>[</kbd> set A · <kbd>]</kbd> set B · <kbd>l</kbd> loop · <kbd>,</kbd><kbd>.</kbd> prev/next chunk</p>`;

    this.$ = s => r.querySelector(s);
    this.scrub = this.$('[data-scrub]');
    this.band  = this.$('.loopband');
    this.head  = this.$('.head');

    this.$('[data-play]').onclick = ()=>this.toggle();
    this.$('[data-back]').onclick = ()=>this.seek(this.a.currentTime-5);
    this.$('[data-fwd]').onclick  = ()=>this.seek(this.a.currentTime+5);
    this.$('[data-a]').onclick = ()=>{ this.loopA = this.a.currentTime; this.fixLoop(); };
    this.$('[data-b]').onclick = ()=>{ this.loopB = this.a.currentTime; this.fixLoop(); };
    this.$('[data-loop]').onclick  = ()=>this.toggleLoop();
    this.$('[data-clear]').onclick = ()=>{ this.loopA=this.loopB=null; this.looping=false; this.fixLoop(); };
    this.$('[data-count]').onclick = e=>{ this.countIn=!this.countIn;
      e.target.classList.toggle('on',this.countIn);
      e.target.textContent = 'Count-in '+(this.countIn?'on':'off'); };
    this.$('[data-edit]').onclick  = ()=>{ this.$('[data-editor]').classList.toggle('open'); this.dumpJSON(); };
    this.$('[data-speed]').oninput = e=>{
      const v = +e.target.value; this.a.playbackRate = v/100;
      this.a.preservesPitch = true; this.a.mozPreservesPitch = true;
      this.a.webkitPreservesPitch = true;
      this.$('[data-speedv]').textContent = v+'%'; };

    this.$('[data-addmark]').onclick = ()=>{
      const name = prompt('Marker name (e.g. "Letter C", "m. 48", "wolf theme")','');
      if(name===null) return;
      this.chunks.push({t:+this.a.currentTime.toFixed(1), name:name||'Marker'});
      this.chunks.sort((x,y)=>x.t-y.t); this.save(); };
    this.$('[data-renamemark]').onclick = ()=>{
      const i = this.curChunk(); if(i<0) return;
      const name = prompt('Rename marker', this.chunks[i].name);
      if(name===null) return;
      this.chunks[i].name = name || this.chunks[i].name; this.save(); };
    this.$('[data-delmark]').onclick = ()=>{
      const i = this.curChunk(); if(i<0) return;
      if(confirm('Delete marker "'+this.chunks[i].name+'"?')){ this.chunks.splice(i,1); this.save(); } };
    this.$('[data-reset]').onclick = ()=>{
      if(!confirm('Reset markers to the shipped defaults?')) return;
      this.chunks = this.tr.chunks.map(c=>({...c}));
      localStorage.removeItem(LS('chunks:'+this.tr.id)); this.save(); };

    this.scrub.onclick = e=>{
      const rect = this.scrub.getBoundingClientRect();
      this.seek((e.clientX-rect.left)/rect.width*this.dur);
    };
    this.draw();
  }

  save(){ localStorage.setItem(LS('chunks:'+this.tr.id), JSON.stringify(this.chunks));
          this.draw(); this.dumpJSON(); }
  dumpJSON(){
    const ta = this.$('[data-json]'); if(!ta) return;
    ta.value = '"chunks": ' + JSON.stringify(this.chunks.map(c=>({t:c.t,name:c.name})));
  }

  draw(){
    // chunk bands on the scrubber
    this.scrub.querySelectorAll('.chunk').forEach(n=>n.remove());
    this.chunks.forEach((c,i)=>{
      const end = i+1 < this.chunks.length ? this.chunks[i+1].t : this.dur;
      const d = document.createElement('div');
      d.className='chunk';
      d.style.left  = (c.t/this.dur*100)+'%';
      d.style.width = ((end-c.t)/this.dur*100)+'%';
      d.title = c.name+' · '+fmt(c.t);
      if((end-c.t)/this.dur > 0.07) d.innerHTML = '<span>'+c.name+'</span>';
      d.onclick = e=>{ e.stopPropagation();
        this.loopA=c.t; this.loopB=end; this.looping=true; this.fixLoop(); this.seek(c.t); };
      this.scrub.insertBefore(d, this.band);
    });
    // chunk buttons
    const cl = this.$('[data-chunks]'); cl.innerHTML='';
    this.chunks.forEach((c,i)=>{
      const end = i+1 < this.chunks.length ? this.chunks[i+1].t : this.dur;
      const b = document.createElement('button');
      b.textContent = c.name+' · '+fmt(c.t);
      b.onclick = ()=>{ this.loopA=c.t; this.loopB=end; this.looping=true;
                        this.fixLoop(); this.seek(c.t); if(this.a.paused) this.toggle(); };
      cl.appendChild(b);
    });
  }

  curChunk(){
    const t = this.a.currentTime; let idx=-1;
    this.chunks.forEach((c,i)=>{ if(c.t<=t+0.15) idx=i; });
    return idx;
  }

  fixLoop(){
    if(this.loopA!=null && this.loopB!=null && this.loopA>this.loopB)
      [this.loopA,this.loopB]=[this.loopB,this.loopA];
    const on = this.looping && this.loopA!=null && this.loopB!=null;
    this.band.hidden = !(this.loopA!=null && this.loopB!=null);
    if(!this.band.hidden){
      this.band.style.left  = (this.loopA/this.dur*100)+'%';
      this.band.style.width = ((this.loopB-this.loopA)/this.dur*100)+'%';
    }
    const lb = this.$('[data-loop]');
    lb.classList.toggle('on', on);
    lb.textContent = 'Loop '+(on?'on':'off');
  }
  toggleLoop(){
    if(this.loopA==null || this.loopB==null){ alert('Set A and B first, or click a chunk.'); return; }
    this.looping = !this.looping; this.fixLoop();
  }

  click(when, freq, gain){
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(this.ac.destination);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when+0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when+0.09);
    o.start(when); o.stop(when+0.1);
  }
  async doCountIn(bpm=100){
    this.ac = this.ac || new (window.AudioContext||window.webkitAudioContext)();
    if(this.ac.state==='suspended') await this.ac.resume();
    const beat = 60/bpm, t0 = this.ac.currentTime+0.06;
    for(let i=0;i<4;i++) this.click(t0+i*beat, i===0?1320:880, .28);
    return new Promise(r=>setTimeout(r, 4*beat*1000));
  }

  async toggle(){
    if(this.a.paused){
      (window.PCO_PLAYERS||[]).forEach(p=>{
        if(p!==this && !p.a.paused){ p.a.pause(); p.setPlayBtn(false); }
      });
      if(this.countIn){ this.setPlayBtn(null); await this.doCountIn(); }
      this.a.play(); this.setPlayBtn(true);
    } else { this.a.pause(); this.setPlayBtn(false); }
  }
  setPlayBtn(on){
    const b=this.$('[data-play]');
    b.textContent = on===null ? 'Count…' : on ? 'Pause' : 'Play';
    b.classList.toggle('on', !!on);
  }
  seek(t){ this.a.currentTime = Math.max(0, Math.min(this.dur-0.05, t)); this.tick(); }

  tick(){
    const t = this.a.currentTime;
    if(this.looping && this.loopA!=null && this.loopB!=null){
      if(t >= this.loopB - 0.03 || t < this.loopA - 0.5){
        this.a.currentTime = this.loopA;
        if(this.countIn && !this.a.paused){
          this.a.pause();
          this.doCountIn().then(()=>{ this.a.play(); });
        }
        return;
      }
    }
    this.head.style.left = (t/this.dur*100)+'%';
    this.$('[data-time]').textContent = fmt(t)+' / '+fmt(this.dur);
    const i = this.curChunk();
    this.$('[data-chunks]').querySelectorAll('button')
      .forEach((b,k)=>b.classList.toggle('cur', k===i));
  }
}

window.PCOPlayer = Player;
window.PCOfmt = fmt;
