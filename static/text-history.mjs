/* Local history for the AI request only. No text leaves the browser. */
export class TextHistory {
  constructor(initial, limit = 100) {
    this.entries = [initial]; this.index = 0; this.group = null; this.limit = limit;
  }
  get current() { return this.entries[this.index]; }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.entries.length - 1; }
  remember(value, group = null) {
    if (value.text === this.current.text) { this.entries[this.index] = value; return; }
    const merge = group && group === this.group && !this.canRedo && this.index > 0;
    this.entries = this.entries.slice(0, this.index + 1);
    if (merge) this.entries[this.index] = value;
    else { this.entries.push(value); this.index++; }
    if (this.entries.length > this.limit) { this.entries.shift(); this.index--; }
    this.group = group;
  }
  undo() { this.group = null; if (this.canUndo) this.index--; return this.current; }
  redo() { this.group = null; if (this.canRedo) this.index++; return this.current; }
}

export function setupTextEditor({textarea, clear, undo}) {
  const snapshot = () => ({text: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd});
  const history = new TextHistory(snapshot());
  let internal = false, typingGroup = null, lastTyped = 0, typingType = '';
  const boundary = () => { typingGroup = null; };
  const refresh = () => {
    clear.disabled = textarea.readOnly || !textarea.value;
    undo.disabled = textarea.readOnly || !history.canUndo;
  };
  const notify = () => {
    internal = true;
    try { textarea.dispatchEvent(new Event('input', {bubbles: true})); }
    finally { internal = false; }
    refresh();
  };
  const apply = value => {
    textarea.value = value.text;
    textarea.setSelectionRange(value.start, value.end); notify();
  };
  const replace = (value, {group = null} = {}) => {
    history.remember(snapshot(), history.group);
    textarea.value = value.slice(0, textarea.maxLength);
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    history.remember(snapshot(), group); boundary(); notify();
  };
  const travel = redo => {
    if (textarea.readOnly) return;
    boundary(); apply(redo ? history.redo() : history.undo());
  };
  const input = event => {
    if (internal || event.isComposing) return;
    const now = Date.now();
    const plain = !event.inputType || ['insertText', 'deleteContentBackward', 'deleteContentForward'].includes(event.inputType);
    if (!plain || !typingGroup || now - lastTyped > 750 || typingType !== event.inputType) typingGroup = Symbol('typing');
    typingType = event.inputType;
    history.remember(snapshot(), typingGroup); lastTyped = now;
    if (!plain || /\s|[.,!?]/.test(event.data || '')) boundary();
    refresh();
  };
  const keydown = event => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); travel(event.key.toLowerCase() === 'y' || event.shiftKey); return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) boundary();
  };
  const beforeinput = event => {
    if (['historyUndo', 'historyRedo'].includes(event.inputType)) {
      event.preventDefault(); travel(event.inputType === 'historyRedo');
    } else {
      if (textarea.selectionStart !== textarea.selectionEnd) boundary();
      history.remember(snapshot(), history.group);
    }
  };
  const clearClick = () => { if (!textarea.readOnly) { replace(''); textarea.focus(); } };
  const undoClick = () => { travel(false); textarea.focus(); };
  const compositionEnd = () => input({isComposing: false, inputType: 'insertCompositionText'});
  textarea.addEventListener('beforeinput', beforeinput);
  textarea.addEventListener('input', input);
  textarea.addEventListener('keydown', keydown);
  textarea.addEventListener('pointerdown', boundary);
  textarea.addEventListener('blur', boundary);
  textarea.addEventListener('compositionend', compositionEnd);
  clear.addEventListener('click', clearClick); undo.addEventListener('click', undoClick);
  refresh();
  return {replace, refresh, dispose() {
    textarea.removeEventListener('beforeinput', beforeinput);
    textarea.removeEventListener('input', input);
    textarea.removeEventListener('keydown', keydown);
    textarea.removeEventListener('pointerdown', boundary);
    textarea.removeEventListener('blur', boundary);
    textarea.removeEventListener('compositionend', compositionEnd);
    clear.removeEventListener('click', clearClick); undo.removeEventListener('click', undoClick);
  }};
}
