var uploaders = new Map();

class PhotoUploadBusiness {
  constructor(worker, pageId, convId, uploadId, files) {
    this.worker = worker;
    this.pageId = pageId;
    this.convId = convId;
    this.uploadId = uploadId;
    this.files = files;
    this.reqs = new Map();
  }

  init() {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 0);
    })
  }

  uploadPhotos() {
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
      _this.upload(file, i).done(function(data) {
        var found = data.match(/"fbid":(\d+)/i);
        var found2 = data.match(/"src":"([^"]+)"/i);
        if(found && found2) {
          _this.worker.port.postMessage({
            uploadId: _this.uploadId,
            event: 'uploaded',
            id: file._id,
            fbid: found[1],
            preview_uri: found2[1].replace(/\\/g, '')
          });
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
    var url = 'https://upload.facebook.com/ajax/mercury/upload.php?request_user_id=';
        url += this.pageId;
        url += '&dpr=2';
        url += '&__a=1&__pc=EXP1%3ADEFAULT&__user=';
        url += ctx.userID;
        url += '&fb_dtsg=';
        url += dtsg;

    var formData = new FormData();
    var blob = new Blob([file.blob], { type: file.info.type});
    formData.append("photo", blob, file.info.name);
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
