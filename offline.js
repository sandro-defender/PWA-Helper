(function () {
  'use strict';

  var hint = document.getElementById('hint');
  var statusText = document.getElementById('statusText');
  var headline = document.getElementById('headline');
  var message = document.getElementById('message');
  var dot = document.getElementById('dot');
  if (!hint || !statusText || !headline || !message || !dot) return;

  var wasOffline = !navigator.onLine;

  function setOnline() {
    statusText.textContent = 'You are online';
    dot.style.background = '#22c55e';
  }

  function setOffline() {
    statusText.textContent = 'You are offline';
    dot.style.background = '#f59e0b';
  }

  function update() {
    if (!navigator.onLine) {
      wasOffline = true;
      setOffline();
      headline.textContent = 'No connection';
      message.textContent =
        'Check your internet connection and try again. Pages you visited recently may still be available.';
      hint.textContent = 'Waiting for the network…';
      return;
    }

    setOnline();

    if (wasOffline) {
      headline.textContent = 'Connection restored';
      message.textContent = 'Reloading the app…';
      hint.textContent = 'Connection restored. Reloading…';
      setTimeout(function () {
        window.location.reload();
      }, 300);
      return;
    }

    headline.textContent = 'Connection looks fine';
    message.textContent = 'The app did not load. Open it again to continue.';
    hint.textContent = 'You are online. If the app did not load, try again.';
  }

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
})();
