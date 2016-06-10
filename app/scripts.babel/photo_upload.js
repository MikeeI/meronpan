var uploaders = new Map();

class PhotoUpload {
  constructor(worker, pageId, convId, uploadId, files) {
    this.worker = worker;
    this.pageId = pageId;
    this.convId = convId;
    this.uploadId = uploadId;
    this.files = files;
    this.reqs = new Map();
  }

  init(type="message") {
    this.type = type;
    var _this = this;
    var url = '';
    if(type == 'message') {
      var url = 'https://m.facebook.com/messages/read/?tid=';
      url += this.convId;
      url += '&pageID=';
      url += this.pageId;
      url += '&ref=bookmarks&__m_async_page__=&m_sess=&__req=g&__ajax__=true&__user=';
      url += ctx.userID;
    } else {
      var post_id = this.convId.split('_')[0];
      var url  = 'https://m.facebook.com/comment/replies/?ctoken=' + this.convId;
          url += '&actor_id=' + this.pageId + '&ft_ent_identifier=' + post_id;
          url += '__m_async_page__=&m_sess=&__ajax__=true&__user=' + ctx.userID;
    }
    countRq++;
    return $.ajax({
      url: url,
      dataType: 'text'
    }).done(function(data) {
      if(!data) return;
      var found = data.match(/waterfallID\\":\\"([^"\\]+)/i);
      if(found) {
        _this.waterfallID = found[1];
        _this.waterfallx('client_flow_begin');
      }
    });
  }

  waterfallx(step, bytes, times) {
    var url = 'https://pixel.facebook.com/ajax/photos/logging/waterfallx.php?data=%7B%22step%22%3A%22client_select_begin%22%2C%22qn%22%3A%22750aad756a28d0b1dd1e371b024a4ace%22%2C%22uploader%22%3A%22web_m_touch%22%2C%22ref%22%3A%22message%22%7D';
    var data = {
      'step': step,
      'qn': this.waterfallID,
      'uploader':'web_m_touch',
      'ref':'message'
    };
    if(bytes) {
      data['bytes'] = bytes
    }
    if(times) {
      data['times'] = times
    }
    // $.get(url, data);
  }

  uploadPhotos() {
    console.log(this);
    var files = this.files || [];
    var _this = this;
    files.forEach(function(file, i) {
      if(file.uploaded || file.uploadedPercent >= 100) {
        _this.worker.port.postMessage({
          uploadId: _this.uploadId,
          event: 'skip',
          id: file._id
        });
        return;
      }
      _this.waterfallx('client_select_begin');
      // var start = process.hrtime();
      _this.upload(file, i).done(function(data) {
        var found = data.match(/"fbid":"(\d+)"/i);
        var found2 = data.match(/"preview_uri":"([^"]+)"/i);
        if(found && found2) {
          _this.worker.port.postMessage({
            uploadId: _this.uploadId,
            event: 'uploaded',
            id: file._id,
            fbid: found[1],
            preview_uri: found2[1].replace(/\\/g, '')
          });
          _this.waterfallx('client_transfer_success', file.blob.size, found[1]);
        } else {
          _this.worker.port.postMessage({uploadId: _this.uploadId, event: 'fail', id: file._id});
        }
      }).fail(function () {
        _this.worker.port.postMessage({uploadId: _this.uploadId, event: 'fail', id: file._id});
      })
    })
  }

  upload(file, i) {
    var _this = this;
    var url = 'https://p-upload.facebook.com/_mupload_/photo/x/saveunpublished/?thumbnail_width=80&thumbnail_height=80&';
    url += 'waterfall_id=' + this.waterfallID;
    url += '&waterfall_app_name=web_m_touch&waterfall_source=' + this.type + '&';
    url += 'target_id=' + this.pageId + '&av=' + this.pageId;
    url += '&fb_dtsg=' + dtsg;
    url += '&m_sess=&__ajax__=true&__user=' + ctx.userID

    var formData = new FormData();
    var blob = new Blob([file.blob], { type: file.info.type});
    formData.append("photo", blob, file.info.name);
    _this.waterfallx('client_select_success');
    _this.waterfallx('client_transfer_begin', file.blob.size);
    countRq++;
    var req = $.ajax({
      url: url,
      type: 'POST',
      data: formData,
      cache: false,
      contentType: false,
      processData: false,
      dataType: 'text',
      xhr: function(){
          var xhr = $.ajaxSettings.xhr() ;
          xhr.upload.onprogress = function(evt){
            _this.worker.port.postMessage({uploadId: _this.uploadId, event: 'progress', id: file._id, percent: evt.loaded/evt.total*100});
          };
          xhr.upload.onload = function(){
            _this.worker.port.postMessage({uploadId: _this.uploadId, event: 'progress', id: file._id,  percent: 100});
          };
          return xhr ;
      }
    });
    this.reqs.set(file._id, req);
    return req;
  }
  abort(id) {
    if(this.reqs.has(id)) {
      this.reqs.get(id).abort();
      this.reqs.delete(id);
    }
  }
  aborts() {
    this.reqs.forEach(function (req) {
      req.abort();
    })
  }
}

