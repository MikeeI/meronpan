'use strict';

var f = document.createElement('iframe');
f.src = chrome.runtime.getURL('meronpan.html');
f.hidden = true;
(document.body || document.documentElement).appendChild(f);

console.log('Im Meronpan!!! ((*´３｀)');

chrome.runtime.onMessage.addListener(function(msg) {
  if(msg.type == 'IM_MERONPAN') {
    window.postMessage(msg, "*");
  }
});

var meronpan;
var connectToMeronpan = function() {
  meronpan = chrome.runtime.connect({name: "pancake"});
  meronpan.onMessage.addListener(function(msg) {
    if(msg.type == 'IM_MERONPAN') {
      window.postMessage(msg, "*");
    } else {
      window.postMessage({ type: "FROM_MERONPAN", data: msg }, "*");
    }
  });
};
connectToMeronpan();
window.addEventListener("message", function(event) {
  if (event.source != window && event.source != f.contentWindow)
    return;
  if (event.data.type && (event.data.type == "TO_MERONPAN")) {
    if(event.data.data.type == 'UPLOAD_PHOTO_TO_INBOX' ||
       event.data.data.type == 'UPLOAD_PHOTO_TO_COMMENT' ||
       event.data.data.type == 'LISTEN' ||
       event.data.data.type == 'CMT' ||
       event.data.data.type == 'MENTIONS')
      f.contentWindow.postMessage(event.data, "*");
    else
      meronpan.postMessage(event.data.data);
  }
  else if (event.data.type && (event.data.type == "PING_MERONPAN")) {
    try {
      meronpan.postMessage('PING');
      window.postMessage('PONG_MERONPAN', "*");
    }
    catch(e) {
      window.postMessage({type: 'IM_MERONPAN', on: false}, "*");
      window.postMessage({type: 'MERONPAN_STOPED'}, "*");
      // console.log('Meronpan: ｡ﾟヽ(ﾟ´Д｀)ﾉﾟ｡βyё βyё☆彡')
      // connectToMeronpan();
    }
  }
}, false);
