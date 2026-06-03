(function () {
  'use strict';

  var BOOKIT_URL = 'https://bookit.monoliet.cloud';
  var iframes = [];

  // Register message listener once at init — not per iframe load.
  // Without this guard, every reload of an embedded iframe would add a duplicate listener.
  window.addEventListener('message', function (event) {
    if (event.origin !== BOOKIT_URL) return;
    if (!event.data || event.data.type !== 'bookit:resize') return;
    for (var i = 0; i < iframes.length; i++) {
      iframes[i].height = event.data.height + 'px';
    }
  });

  function init() {
    var containers = document.querySelectorAll('[data-bookit-slug]');
    for (var i = 0; i < containers.length; i++) {
      var el = containers[i];
      if (el.dataset.bookitLoaded) continue;
      el.dataset.bookitLoaded = '1';

      var slug = el.dataset.bookitSlug;
      if (!slug) continue;

      var height = el.dataset.bookitHeight || '700';

      var iframe = document.createElement('iframe');
      iframe.src = BOOKIT_URL + '/book/' + encodeURIComponent(slug);
      iframe.width = '100%';
      iframe.height = height + 'px';
      iframe.frameBorder = '0';
      iframe.scrolling = 'yes';
      iframe.allow = 'fullscreen';
      iframe.loading = 'lazy';
      iframe.title = 'Book-IT Booking Widget';
      iframe.style.border = 'none';
      iframe.style.display = 'block';
      iframe.style.maxWidth = '100%';

      el.appendChild(iframe);
      iframes.push(iframe);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
