if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (error) {
      console.warn('App offline support unavailable:', error);
    });
  });
}
