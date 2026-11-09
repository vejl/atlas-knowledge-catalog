import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDictation} from '../static/dictation.mjs';

class Control extends EventTarget {
  value = ''; disabled = false; readOnly = false; maxLength = 12000;
  textContent = ''; attributes = {}; dataset = {}; classList = {toggle() {}};
  label = {textContent: ''};
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelector() { return this.label; }
  click() { this.dispatchEvent(new Event('click')); }
}
class Speech {
  static latest;
  constructor() { Speech.latest = this; }
  start() { this.onstart?.(); }
  stop() { this.onend?.(); }
  abort() { this.aborted = true; }
  result(parts) {
    this.onresult({results: parts.map(([text, isFinal]) => Object.assign([{transcript: text}], {isFinal}))});
  }
}
function fixture(Recognition = Speech) {
  const controls = Object.fromEntries(['textarea','button','language','status','submit','example'].map(key => [key, new Control()]));
  controls.language.value = 'sk-SK';
  return {...controls, api: setupDictation({...controls, Recognition})};
}

test('words appear on each interim result without duplication and survive pause/resume', () => {
  const f = fixture(); f.textarea.value = 'Existing request.'; f.button.click();
  assert.equal(Speech.latest.lang, 'sk-SK'); assert.equal(f.submit.disabled, true);
  assert.equal(Speech.latest.interimResults, true); assert.equal(Speech.latest.continuous, true);
  Speech.latest.result([['Add a guide', false]]);
  assert.equal(f.textarea.value, 'Existing request. Add a guide');
  Speech.latest.result([['Add a useful guide', false]]);
  assert.equal(f.textarea.value, 'Existing request. Add a useful guide');
  Speech.latest.result([['Add a guide', true], ['unfinished', false]]);
  assert.equal(f.textarea.value, 'Existing request. Add a guide unfinished');
  f.button.click();
  assert.equal(f.textarea.value, 'Existing request. Add a guide unfinished');
  assert.equal(f.submit.disabled, false); assert.equal(f.textarea.readOnly, false);
  f.button.click(); Speech.latest.result([['Continue here', true]]); f.button.click();
  assert.equal(f.textarea.value, 'Existing request. Add a guide unfinished Continue here');
});
test('microphone refusal keeps existing text and shows recovery guidance', () => {
  const f = fixture(); f.textarea.value = 'Keep this'; f.button.click();
  Speech.latest.onerror({error: 'not-allowed'}); Speech.latest.onend();
  assert.equal(f.textarea.value, 'Keep this'); assert.match(f.status.textContent, /blocked/);
  assert.equal(f.submit.disabled, false);
});
test('unsupported browsers keep typing available and never request access', () => {
  const f = fixture(null); assert.equal(f.button.disabled, true);
  assert.equal(f.submit.disabled, false); assert.equal(f.textarea.readOnly, false);
  assert.match(f.status.textContent, /unavailable/);
});
test('navigation aborts recognition and prevents late results from editing the field', () => {
  const f = fixture(); f.textarea.value = 'Original'; f.button.click();
  const speech = Speech.latest; const late = speech.onresult; f.api.dispose();
  late({results: [Object.assign([{transcript: 'Late data'}], {isFinal: true})]});
  assert.equal(speech.aborted, true); assert.equal(f.textarea.value, 'Original');
  assert.equal(f.textarea.readOnly, false);
});
test('dictation respects the request length limit', () => {
  const f = fixture(); f.textarea.maxLength = 10; f.textarea.value = 'Hello'; f.button.click();
  Speech.latest.result([['world and more', true]]);
  assert.equal(f.textarea.value, 'Hello worl'); assert.equal(f.submit.disabled, false);
});
test('a busy AI request cannot start the microphone', () => {
  const f = fixture(); f.submit.disabled = true; const previous = Speech.latest;
  f.button.click(); assert.equal(Speech.latest, previous);
});

test('wave activity follows speech and becomes quiet on pause or cleanup', () => {
  const f = fixture(); f.button.click();
  assert.notEqual(f.button.dataset.speaking, 'true');
  Speech.latest.onspeechstart(); assert.equal(f.button.dataset.speaking, 'true');
  Speech.latest.onspeechend(); assert.equal(f.button.dataset.speaking, 'false');
  Speech.latest.result([['Speaking again', false]]); assert.equal(f.button.dataset.speaking, 'true');
  f.button.click(); assert.equal(f.button.dataset.speaking, 'false');
  f.button.click(); Speech.latest.onspeechstart(); f.api.dispose();
  assert.equal(f.button.dataset.speaking, 'false');
});
