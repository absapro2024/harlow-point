// Fictional "Unit-Balance Trainer". It is an abstract balancing task with no real plant behavior.
// Skills practiced: steady attention, announcing alarms, consulting a card, and stopping when unsure.
import { bus } from '../core/events.js';
export function openSim(G) {
  const el = G.ui.open('Unit-Balance Trainer (FICTIONAL)', `<div class="sim">
    <div class="dim">Keep the needle in the center band. Fatigue and stress make the needle harder to hold.</div>
    <div class="gauge"><div class="needle" id="nd"></div></div>
    <div class="row"><span id="tm"></span><span id="inb"></span></div>
    <div class="row"><button id="dn" style="font-size:22px">− Demand</button><button id="up" style="font-size:22px">+ Demand</button></div>
    <div id="card"></div>
    <button id="stop">STOP & announce (always acceptable)</button></div>`);
  const $ = id => el.querySelector('#' + id);
  let v = 0.5, demand = 0, t = 0, inBand = 0, alarm = null, seq = [], handled = null, over = false;
  const DUR = 45, focus = G.player.needs.focus / 100;
  $('dn').onclick = () => demand -= 0.04; $('up').onclick = () => demand += 0.04;
  $('stop').onclick = () => end('stopped');
  const step = () => {
    if (over || !G.ui.modal) return;
    const dt = 1 / 30; t += dt;
    const drift = Math.sin(t * 0.7) * 0.05 + Math.sin(t * 1.9) * 0.03 + (alarm ? -0.06 : 0);
    v += (drift + demand) * dt * (1.4 - focus * 0.4); demand *= 0.97; v = Math.max(0, Math.min(1, v));
    if (v > 0.42 && v < 0.58) inBand += dt;
    $('nd').style.left = `calc(${v * 100}% - 2px)`; $('tm').textContent = `Time ${Math.ceil(DUR - t)}s`; $('inb').textContent = `In band ${Math.round(inBand / t * 100)}%`;
    if (t > 18 && !alarm && handled === null) { alarm = true; G.audio.deny();
      $('card').innerHTML = `<div class="wo"><b>ALARM CARD A-7 (fictional): Mixer Loop 2 low flow</b><p class="dim">Respond in the correct order.</p><div class="row">${['Consult card A-7', 'Announce the alarm to the crew', 'Reduce demand one step'].map((s, i) => `<button data-a="${i}">${s}</button>`).join('')}</div><div id="sq" class="dim"></div></div>`;
      el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { seq.push(+b.dataset.a); b.disabled = true; $('sq').textContent = 'Sequence: ' + seq.map(i => ['Consult', 'Announce', 'Reduce'][i]).join(' → ');
        if (seq.length === 3) { handled = seq.join() === '1,0,2'; alarm = null; demand -= 0.05; $('card').innerHTML = `<p>${handled ? '✅ Correct: announce, consult, act.' : '❌ The expected order is announce → consult → act. Priya will debrief you.'}</p>`; } }); }
    if (t >= DUR) return end('done');
    requestAnimationFrame(step);
  };
  const end = (how) => {
    over = true; const ratio = inBand / Math.max(1, t), pass = how === 'stopped' || (ratio > 0.55 && handled !== false);
    el.querySelector('.body').innerHTML = `<h2>${how === 'stopped' ? 'Session stopped and announced' : pass ? 'Session complete' : 'Session complete: debrief needed'}</h2>
      <p>Time in band: ${Math.round(ratio * 100)}% • Alarm response: ${handled === null ? 'not reached' : handled ? 'correct' : 'out of order'}</p>
      <p class="dim">${how === 'stopped' ? 'Stopping when unsure is always an acceptable outcome in training.' : 'Fatigue, hydration, and stress affect your focus here.'}</p><button class="primary" id="cl">Close</button>`;
    el.querySelector('#cl').onclick = () => G.ui.close();
    if (pass) { bus.emit('sim_done', { ratio }); G.player.performance.quality = (G.player.performance.quality + ratio) / 2; }
  };
  requestAnimationFrame(step);
}
