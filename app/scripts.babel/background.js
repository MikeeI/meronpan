'use strict';

var dtsg, exp, timer, waterfallID;
var countRq = 0;
var defaultData = {
  'charset_test': '€,´,€,´,水,Д,Є',
  '__ajax__': true
};
var ctx = {
  userID: '',
  clientID: (Math.random() * 2147483648 | 0).toString(16),
  globalOptions: '',
  loggedIn: false
};
var tabid;
var connectedStatus = {
  'm.facebook.com': false,
  'p-upload.facebook.com': false
};

var worker = new SharedWorker(chrome.runtime.getURL('scripts/worker.js'));
var listen = new Listen(worker);

worker.port.onmessage = function(event) {
  switch(event.data.type) {
    case 'UPLOAD_PHOTO_TO_INBOX':
      event.data.convId = event.data.convId.replace('t_mid', 'mid');
      if(!event.data.isBusiness) {
        var uploader = new PhotoUpload(worker, event.data.pageId, event.data.convId, event.data.uploadId, event.data.files);
        uploaders.set(event.data.uploadId, uploader);
        uploader.init().done(function() {
          uploader.uploadPhotos();
        }).fail(function() {
          worker.port.postMessage({uploadId: event.data.uploadId, event: 'fail', index: -1});
        });
      }
      else {
        var uploader = new PhotoUploadBusiness(worker, event.data.pageId, event.data.convId, event.data.uploadId, event.data.files);
        uploaders.set(event.data.uploadId, uploader);
        uploader.uploadPhotos();
      }
      break;
    case 'UPLOAD_PHOTO_TO_COMMENT':
      var uploader = new PhotoUpload(worker, event.data.pageId, event.data.convId, event.data.uploadId, event.data.files);
      uploaders.set(event.data.uploadId, uploader);
      uploader.init('photo_comment').done(function() {
        uploader.uploadPhotos();
      }).fail(function() {
        worker.port.postMessage({uploadId: event.data.uploadId, event: 'fail', index: -1});
      });
      break;
    case 'LISTEN':
      if(event.data.action === 'start') {
        listen.start();
      } else if (event.data.action === 'stop') {
        listen.stop();
      }
      break;
    case 'CMT':
      if(!event.data.isBusiness)
        var comment = new Comment(worker, event.data.taskId, event.data.pageId, event.data.postId, event.data.parentId);
      else
        var comment = new CommentBusiness(worker, event.data.taskId, event.data.pageId, event.data.postId, event.data.parentId);
      // commenters.set(event.data.taskId, comment);
      // comment.noti();
      comment.comment_text(event.data.comment_text, event.data.photo_id);
      break;
    case 'MENTIONS':
      var mentions = new Mentions(worker, event.data.taskId, event.data.pageId, event.data.postId);
      mentions.mentions(event.data.q);
      break;
  }
  window.lastMessage = event.data;
};

var convs = [];
var staruped;
var parseDtsg = function(data, port) {
  if(!data) return;
  var found = data.match(/\\?"USER_ID\\?":\\?"(\d+)\\?"/i);
  if(found && found[1] !== 0){
    ctx.userID = found[1];
    ctx.loggedIn = true;
    listen.start();
  }
  var found = data.match(/dtsg\\?":{\\?"token\\?":\\?"([^"\\]+)\\?",\\?"valid_for\\?":(\d+),\\?"expire\\?":(\d+)/i);
  if(found && found[1] !== 0){
    dtsg = found[1];
    exp = parseInt(found[3]);
    if(timer) {
      clearTimeout(timer);
      timer = null;
    }
    timer = setTimeout(function () {
      init(port);
    }, parseInt(found[2])*1000);
    if(port) {
      port.postMessage({ type: 'IM_MERONPAN', on: dtsg !== undefined && exp > ((new Date).getTime()/1000), connectedStatus: connectedStatus});
    }
  }
}
var init = function(port) {
  countRq = 0;
  checkConnect();
  $.ajax({url: "https://m.facebook.com",
    type: "GET",
    timeout:5000,
    cache: false,
    dataType: 'html',
    statusCode: {
      400: function (response) {
      },
      0: function (response) {
      }
    },
    success: function(data) {
      parseDtsg(data, port);
    }
  });
};

var checkConnect = function() {
  var check = function(host) {
    $.ajax({url: "https://" + host,
      type: "GET",
      timeout:5000,
      cache: false,
      dataType: 'html',
      statusCode: {
        400: function (response) {
          connectedStatus[host] = false;
        },
        0: function (response) {
          connectedStatus[host] = false;
        }
      },
      success: function(data) {
        connectedStatus[host] = true;
      }
    });
  }
  for(var host in connectedStatus) {
    // check(host);
  }
};

var startup = function() {
  if(staruped) {
    return;
  }
  staruped = true;
  chrome.runtime.onConnect.addListener(function(port) {
    console.assert(port.name === 'pancake');
    port.onMessage.addListener(function(msg) {
      if(msg === 'PING') {
        var on = (dtsg !== undefined && exp > ((new Date).getTime()/1000));
        port.postMessage({ type: 'IM_MERONPAN', on: on, connectedStatus: connectedStatus});
        if(!on) {
          dtsg = undefined;
          init(port);
        }
      }
      else if(msg.type === 'CMT-TAG' || msg.type === 'INBOX-FROM-CMT') {
        if(msg.url, msg.data) {
          msg.data = $.extend(defaultData, msg.data, {'fb_dtsg': dtsg, '__user': ctx.userID});
          port.postMessage({action: 'START'});
          countRq++;
          $.post(msg.url, msg.data)
            .progress(function(e) {
            })
            .always(function(data) {
              if(data.status === 500) {
                dtsg = undefined;
              } else {
                parseDtsg(data.responseText, port);
              }
              port.postMessage({action: 'END'});
              port.postMessage({msg: msg, data: data});
              if(countRq > 10) init(port);
            }).done(function(data) {
            });
        }
      } else if(msg.type === 'INBOX') {
        var inbox;
        if(!msg.isBusiness)
          inbox = new Inbox(port, msg.taskId, msg.pageId, msg.convId);
        else
          inbox = new InboxBusiness(port, msg.taskId, msg.pageId, msg.userId, msg.convId);
        inbox.send(msg.message, msg.files);
      } else if(msg.type == 'ABORT-UPLOAD') {
        if(uploaders.has(msg.uploadId)) {
          var uploader = uploaders.get(msg.uploadId);
          if(msg.id) {
            uploader.abort(msg.id);
          } else {
            uploader.aborts();
            uploaders.delete(msg.uploadId);
          }
        }
      }
    });
  });
}

function extractDomain(url) {
    var domain;
    //find & remove protocol (http, ftp, etc.) and get domain
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    }
    else {
        domain = url.split('/')[0];
    }

    //find & remove port number
    domain = domain.split(':')[0];

    return domain;
}

var requestListener = function (details) {
  if(details.tabId === -1) {
    details.requestHeaders.forEach(function (header) {
      if (header.name === 'Origin') {
        var parser = document.createElement('a');
        parser.href = details.url;
        if(parser.hostname == 'business.facebook.com')
          header.value = 'https://business.facebook.com';
        else
          header.value = 'https://m.facebook.com';
      }
    });
  }
  return {
    requestHeaders: details.requestHeaders
  };
};

var reloadListener = function() {
  chrome.webRequest.onBeforeSendHeaders.addListener(requestListener, {
    urls: ['*://m.facebook.com/*',
           '*://p-upload.facebook.com/*',
           '*://0-edge-chat.facebook.com/*',
           '*://business.facebook.com/*',
           '*://upload.facebook.com/*'],
    types: ['xmlhttprequest']}, ['blocking', 'requestHeaders']);
}

chrome.runtime.onInstalled.addListener(function (details) {
  init();
  reloadListener();
  startup();
});

chrome.runtime.onStartup.addListener(function () {
  init();
  reloadListener();
  startup();
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if((tab.url.indexOf('http://pancake.vn') == 0||
      tab.url.indexOf('http://localhost') == 0)||
      tab.url.indexOf('http://shack.hemlock.vn') == 0) {
    chrome.pageAction.show(tabId);
    tabid = tabId;
  }
});


// chrome.runtime.onEnabled.addListener(function (info) {
//   console.log(info);
//   init();
//   reloadListener();
//   startup();
// })
