/* Browser speech recognition only fills the request. It never sends it to Atlas. */
export function setupDictation({textarea, button, language, status, submit, example,
  onSessionStart = () => {}, onStateChange = () => {},
  writeText = value => { textarea.value = value; textarea.dispatchEvent(new Event('input', {bubbles: true})); },
  Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition}) {
  let recognition = null;
  let disposed = false;
  let base = '';
  let transcript = '';
  let failure = '';
  let activityTimer;
  const quiet = () => { clearTimeout(activityTimer); button.dataset.speaking = 'false'; };
  const speechActivity = () => {
    if (disposed || !recognition) return;
    button.dataset.speaking = 'true';
    clearTimeout(activityTimer); activityTimer = setTimeout(quiet, 650);
  };
  const supported = Boolean(Recognition);
  const announce = (message, error = false) => {
    if (status.textContent !== message) status.textContent = message;
    status.classList.toggle('is-error', error);
  };
  const update = active => {
    if (!active) quiet();
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Stop dictation' : 'Start dictation');
    button.querySelector('[data-dictation-label]').textContent = active ? 'Stop' : 'Dictate';
    textarea.readOnly = active; language.disabled = active || !supported;
    submit.disabled = active; example.disabled = active;
    onStateChange();
  };
  const compose = speech => (base + (base && speech && !/\s$/.test(base) ? ' ' : '') + speech).slice(0, textarea.maxLength);
  const toggle = () => {
    if (recognition) { recognition.stop(); return; }
    if (submit.disabled || disposed || !supported) return;
    base = textarea.value; transcript = ''; failure = '';
    onSessionStart();
    const current = new Recognition(); recognition = current;
    current.lang = language.value; current.continuous = true; current.interimResults = true; current.maxAlternatives = 1;
    update(true); announce('Starting microphone…');
    current.onstart = () => { if (!disposed) announce('Listening… Click Stop when finished.'); };
    current.onspeechstart = speechActivity;
    current.onspeechend = quiet;
    current.onresult = event => {
      if (disposed || recognition !== current) return;
      speechActivity();
      // Rebuild from the result list: interim words can be revised, not just appended.
      transcript = Array.from(event.results).map(result => result[0].transcript.trim()).join(' ');
      writeText(compose(transcript));
      textarea.setSelectionRange?.(textarea.value.length, textarea.value.length);
      textarea.scrollTop = textarea.scrollHeight;
      announce('Listening… Words appear live and may be revised. Click Stop to pause.');
      if (textarea.value.length >= textarea.maxLength) {
        announce('The text field is full. Review it before continuing.'); current.stop();
      }
    };
    current.onerror = event => {
      if (disposed) return;
      quiet();
      failure = ({
        'not-allowed': 'Microphone access was blocked. Allow it in your browser settings, or type your request.',
        'service-not-allowed': 'Your browser cannot use its speech service. You can type your request instead.',
        'audio-capture': 'No microphone is available. Connect one or type your request.',
        'network': 'The browser speech service could not be reached. Check your connection or type your request.',
        'no-speech': 'No speech was detected. Try again or type your request.',
        'language-not-supported': 'This speech service does not support the selected language. Try another language.'
      })[event.error] || 'Dictation could not continue. Your existing text is kept; you can try again.';
      announce(failure, true);
    };
    current.onend = () => {
      if (disposed || recognition !== current) return;
      // Retain the visible words when pausing, including an unfinished phrase.
      writeText(compose(transcript)); recognition = null; update(false);
      if (!failure) announce(transcript ? 'Dictation paused. Review the text, or click Dictate to continue.' : 'No speech was recognised. You can try again or type.');
    };
    try { current.start(); }
    catch (error) { recognition = null; update(false); announce('The microphone could not start. Try again or type your request.', true); }
  };
  button.disabled = !supported; language.disabled = !supported;
  if (!supported) announce('Dictation is unavailable in this browser. Open Atlas in Google Chrome or type your request.');
  button.addEventListener('click', toggle);
  return {
    supported,
    dispose() {
      quiet();
      disposed = true; button.removeEventListener('click', toggle);
      if (recognition) {
        writeText(compose(transcript));
        recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = recognition.onspeechstart = recognition.onspeechend = null;
        recognition.abort(); recognition = null; update(false);
      }
    }
  };
}
