import test from 'node:test';
import assert from 'node:assert/strict';
import {TextHistory, setupTextEditor} from '../static/text-history.mjs';

const value = text => ({text, start: text.length, end: text.length});
test('Clear is one reversible step and redo restores it', () => {
  const history = new TextHistory(value('Original request'));
  history.remember(value(''));
  assert.equal(history.undo().text, 'Original request');
  assert.equal(history.redo().text, '');
});
test('interim revisions form one undo step per dictation session', () => {
  const history = new TextHistory(value('Typed base'));
  const first = Symbol('speech');
  history.remember(value('Typed base hello'), first);
  history.remember(value('Typed base hello world'), first);
  history.remember(value('Typed base hello world more'), Symbol('speech'));
  history.remember(value(''));
  assert.equal(history.undo().text, 'Typed base hello world more');
  assert.equal(history.undo().text, 'Typed base hello world');
  assert.equal(history.undo().text, 'Typed base');
});
test('a new edit after undo discards only the redo branch', () => {
  const history = new TextHistory(value('One')); history.remember(value('Two')); history.undo();
  history.remember(value('Three'));
  assert.equal(history.canRedo, false); assert.equal(history.undo().text, 'One');
});
test('history has a fixed memory bound', () => {
  const history = new TextHistory(value('0'), 3);
  for (let i = 1; i < 20; i++) history.remember(value(String(i)));
  assert.equal(history.entries.length, 3);
  assert.equal(history.undo().text, '18'); assert.equal(history.undo().text, '17');
});
class Control extends EventTarget {
  value = ''; selectionStart = 0; selectionEnd = 0; readOnly = false; maxLength = 12000;
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  focus() {}
  click() { this.dispatchEvent(new Event('click')); }
}
test('the editor connects Clear, Ctrl+Z, Ctrl+Shift+Z and typing without touching other fields', () => {
  const textarea = new Control(), clear = new Control(), undo = new Control();
  const editor = setupTextEditor({textarea, clear, undo});
  editor.replace('Example request'); clear.click(); assert.equal(textarea.value, '');
  const shortcut = (key, shiftKey = false) => {
    const event = new Event('keydown', {cancelable: true});
    Object.assign(event, {key, ctrlKey: true, shiftKey}); textarea.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  };
  shortcut('z'); assert.equal(textarea.value, 'Example request');
  shortcut('z', true); assert.equal(textarea.value, '');
  undo.click(); assert.equal(textarea.value, 'Example request');
  textarea.readOnly = true; editor.refresh(); assert.equal(clear.disabled, true);
  shortcut('z'); assert.equal(textarea.value, 'Example request');
  editor.dispose();
});
