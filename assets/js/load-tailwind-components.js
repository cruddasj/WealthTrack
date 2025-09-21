(function loadTailwindComponents() {
  var request = new XMLHttpRequest();
  try {
    request.open('GET', 'assets/css/components.css', false);
    request.send(null);
  } catch (error) {
    console.error('Failed to load Tailwind component styles:', error);
    return;
  }

  var succeeded =
    (request.status >= 200 && request.status < 300) ||
    (request.status === 0 && request.responseText);

  if (succeeded) {
    var styleScript = document.createElement('script');
    styleScript.type = 'text/tailwindcss';
    styleScript.textContent = request.responseText;
    document.head.appendChild(styleScript);
  } else {
    console.error(
      'Failed to load Tailwind component styles: HTTP status',
      request.status
    );
  }
})();
