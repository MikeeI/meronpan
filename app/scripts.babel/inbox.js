class Inbox {
  constructor(port, taskId, pageId, tids) {
    this.port = port;
    this.taskId = taskId;
    this.pageId = pageId;
    tids = tids.replace('t_mid', 'mid');
    this.tids   = tids;
  }

  buildUrl() {
    return 'https://m.facebook.com/messages/send/?icm=1&pageID='+ this.pageId;
  }

  buildParams() {
    var params = {
      'charset_test': '€,´,€,´,水,Д,Є',
      'tids': this.tids,
      'wwwupp': 'V3',
      'body': this.message,
      'waterfall_source': 'message',
      'fb_dtsg': dtsg,
      '__ajax__': 'true',
      '__user': ctx.userID
    };
    if(this.files && this.files.length > 0) {
      this.files.forEach(function(file) {
        params['photo_ids[' + file + ']'] = file;
      });
    }
    return params;
  }

  send(message, files) {
    this.message = message;
    this.files = files;
    var url    = this.buildUrl();
    var params = this.buildParams();
    this.port.postMessage({action: 'START'});
    var _this = this;
    countRq++;
    $ .ajax({
        method: 'POST',
        url: url,
        data: params,
        dataType: 'text'
      })
      .progress(function(e) {
      })
      .always(function(data) {
        parseDtsg(data.responseText, _this.port);
        _this.port.postMessage({action: 'END'});
        if(countRq > 10) init(_this.port);
      }).done(function(data) {
        var found = data.match(/MTouchChannelPayloadRouter.+\\"mid\\":\\"([^\\"]+)\\"/i);
        console.log(found)
        if(found) {
          var id =found[1].replace('mid', 'm_mid');
          _this.port.postMessage({'taskId': _this.taskId, 'status': 200, message_id: id});
        } else {
          _this.port.postMessage({'taskId': _this.taskId, 'status': 409});
        }
      }).fail(function () {
        _this.port.postMessage({'taskId': _this.taskId, 'status': 409});
      });
  }
}
