var worker = new SharedWorker(chrome.runtime.getURL('scripts/worker.js'));
worker.port.start();
worker.port.onmessage = function(event) {
  parent.postMessage({ type: 'FROM_MERONPAN', data: event.data }, '*');
};


window.addEventListener('message', function(event) {
  if (event.source !== parent) {
    return;
  }
  if (event.data.type && (event.data.type === 'TO_MERONPAN')) {
    // console.log(event.data.data);
    worker.port.postMessage(event.data.data);
  }
}, false);
