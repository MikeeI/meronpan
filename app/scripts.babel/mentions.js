class Mentions {
  constructor(worker, taskId, pageId, postId) {
    this.taskId = taskId;
    this.worker = worker;
    this.pageId = pageId;
    this.postId = postId;
  }

  mentions(q) {
    var url = 'https://m.facebook.com/ds/fof/query';
    var data = {
      viewer: ctx.userID,
      'filter["0"]': 'user',
      comments_target_id: this.postId,
      max_result: 10,
      context: 'mentions',
      q: q,
      __ajax__: true,
      __user: ctx.userID
    };
    var _this = this;
    $.ajax({url: url, data: data}).always(function(resData) {
      if(resData.status == 200) {
        try {
          resData = parseFbRes(resData.responseText);
          if(resData)
            _this.success(resData.payload)
          else
            _this.fail();
        } catch(e) {
          _this.fail();
        }
      } else {
        _this.fail();
      }
    })
  }

  success(mentions) {
    this.worker.port.postMessage({
      taskId: this.taskId,
      pageId: this.pageId,
      postId: this.postId,
      mentions: mentions,
      success: true
    });
  }

  fail() {
    this.worker.port.postMessage({
      taskId: this.taskId,
      pageId: this.pageId,
      postId: this.postId,
      success: false
    });
  }
}
