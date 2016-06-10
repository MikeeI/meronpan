var commenters = new Map();

class Comment {
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
    var url = 'https://m.facebook.com/a/comment.php?';
    if(this.parentId) {
      url += 'parent_comment_id=' + this.shortParentId;
      url += '&parent_redirect_comment_token=';
      url += this.parentId + '&';
    }
    url += 'fs=0&redirectosoftpermalink&comment_logging&ft_ent_identifier=';
    url += this.postId;
    url += '&av=' + this.pageId;
    this.url = url;
  }

  buildData() {
    var data = {
      charset_test: '€,´,€,´,水,Д,Є',
      waterfall_source: '',
      client_id: '1451271569047:201722804',
      submit: 'Reply',
      fb_dtsg: dtsg,
      __ajax__: true,
      __user: ctx.userID,
      waterfall_source:'photo_comment'
    }
    this.data = data;
  }

  comment_text(comment_text, photo_id) {
    this.worker.port.postMessage({action: 'START'});
    var _this = this;
    this.data['comment_text'] = comment_text;
    if(photo_id) {
      this.data['photo_ids[' + photo_id + ']'] = photo_id;
    }
    $.post(this.url, this.data).always(function(data) {
      if(data.status === 500) {
        dtsg = undefined;
      } else {
        parseDtsg(data.responseText, _this.worker.port);
      }
      if(data.status == 200) {
        var match = data.responseText.match(/(insertBefore|insertAfter)[^,]+,[^,]+,"html":".*editCommentURI[^\\]+[\\\/]+comment[\\\/]+edit[\\\/]+\?ctoken=([\d_]+)/i);
        if(match) {
          _this.success(match[2]);
        } else {
          _this.fail();
        }
      } else {
        _this.fail();
      }
    });
  }

  noti() {
    this.worker.port.postMessage({
      taskId: this.taskId,
      ping: 'pong'
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
