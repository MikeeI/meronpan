class InboxBusiness {
  constructor(port, taskId, pageId, userID, tids) {
    this.port = port;
    this.taskId = taskId;
    this.pageId = pageId;
    this.userID = userID;
    tids = tids.replace('t_mid', 'mid');
    this.tids   = tids;
  }

  buildUrl() {
    return 'https://business.facebook.com/ajax/mercury/send_messages.php?dpr=2';
  }

  buildParams() {
    var params = {
      'message_batch[0][action_type]': 'ma-type:user-generated-message',
      'message_batch[0][author]': 'fbid:' + this.pageId,
      'message_batch[0][timestamp]': Date.now(),
      'message_batch[0][source]': 'source:titan:web',
      'message_batch[0][body]': this.message,
      'message_batch[0][specific_to_list][0]': 'fbid:' + this.userID,
      'message_batch[0][specific_to_list][1]': 'fbid:' + this.pageId,
      'client': 'mercury',
      'request_user_id': this.pageId,
      'fb_dtsg': dtsg,
      '__a': 1,
      '__user': ctx.userID,
      'message_batch[0][has_attachment]': false
    };
    if(this.files && this.files.length > 0) {
      params['message_batch[0][has_attachment]'] = true;
      this.files.forEach(function(file, index) {
        params['message_batch[0][image_ids][' + index + ']'] = file;
      });
    }
    return params;
  }

  serialize(obj) {
    var str = [];
    for(var p in obj)
      if (obj.hasOwnProperty(p)) {
        str.push(p + "=" + encodeURIComponent(obj[p]));
      }
    return str.join("&");
  }

  send(message, files) {
    this.message = message;
    this.files = files;
    var url    = this.buildUrl();
    var params = this.serialize(this.buildParams());
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
        if(!data) {
          return _this.port.postMessage({'taskId': _this.taskId, 'status': 409});
        }
        var parsedData = parseFbRes(data);
        // var found = data.match(/message_id:.+\\"mid\\":\\"([^\\"]+)\\"/i);
        var m_mid = parsedData.payload.actions[0].message_id;
        if(m_mid) {
          var id =m_mid.replace('mid', 'm_mid');
          _this.port.postMessage({'taskId': _this.taskId, 'status': 200, message_id: id});
        } else {
          _this.port.postMessage({'taskId': _this.taskId, 'status': 409});
        }
      }).fail(function () {
        _this.port.postMessage({'taskId': _this.taskId, 'status': 409});
      });
  }
}
