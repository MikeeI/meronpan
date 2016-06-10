class CommentBusiness {
  constructor(worker, taskId, pageId, postId, parentId) {
    this.taskId = taskId;
    this.worker = worker;
    this.pageId = pageId;
    this.postId = postId;
    if(parentId) {
      this.parentId = parentId;
      this.shortParentId = parentId.split('_')[1];
    }
    this.buildUrl();
    this.buildData();
  }

  buildUrl() {
    var url = 'https://business.facebook.com/ufi/add/comment/?dpr=2';
    this.url = url;
  }
  serialize(obj) {
    var str = [];
    for(var p in obj)
      if (obj.hasOwnProperty(p)) {
        str.push(p + "=" + encodeURIComponent(obj[p]));
      }
    return str.join("&");
  }
  buildData() {
    var data = {
      ft_ent_identifier: this.postId,
      rootid: 'u_0_2e',
      client_id: '1459485031108:1205313957',
      'ft[top_level_post_id]': this.postId,
      'ft[tl_objid]': this.postId,
      av: this.pageId,
      source: 22,
      fb_dtsg: dtsg,
      __a: 1,
      __user: ctx.userID,
      __pc:'EXP1:DEFAULT'
    }
    if(this.parentId) {
      data['parent_comment_id'] = this.parentId;
      data['reply_fbid'] = this.shortParentId;
    }
    this.data = data;
  }

  comment_text(comment_text, photo_id) {
    this.worker.port.postMessage({action: 'START'});
    var _this = this;
    this.data['comment_text'] = comment_text;
    if(photo_id) {
      this.data['attached_photo_fbid'] = photo_id;
    }
    $.post(this.url, this.serialize(this.data)).always(function(data) {
      if(data.status === 500) {
        dtsg = undefined;
      } else {
        parseDtsg(data.responseText, _this.worker.port);
      }
      if(data.status == 200) {
        var parsedData = parseFbRes(data.responseText);
        if(parsedData.jsmods && parsedData.jsmods.require) {
          var node = _.find(parsedData.jsmods.require, function(n) {
            return n[1] == 'handleUpdate';
          });
          if(!node) return _this.fail();
          try {
            var id = node[3][1]['comments'][0].id;
            if(!id) throw new Error("oops");
            _this.success(id);
          } catch (e) {
            _this.fail();
          }
        } else {
          _this.fail();
        }
      } else {
        _this.fail();
      }
    });
  }

  success(commentId) {
    this.worker.port.postMessage({action: 'END'});
    this.worker.port.postMessage({
      taskId: this.taskId,
      pageId: this.pageId,
      postId: this.postId,
      parentId: this.parentId,
      _id: commentId,
      success: true
    });
  }

  fail() {
    this.worker.port.postMessage({action: 'END'});
    this.worker.port.postMessage({
      taskId: this.taskId,
      pageId: this.pageId,
      postId: this.postId,
      parentId: this.parentId,
      success: false
    });
  }
}
