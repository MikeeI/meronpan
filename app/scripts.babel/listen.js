class Listen {
  constructor(worker) {
    this.worker = worker;
  }
  reset() {
    this.shouldStop = false;
    this.currentlyRunning = null;
    this.prev = Date.now() / 1000;
    this.tmpPrev = Date.now();
    this.lastSync = Date.now();
    this.req = null;

    this.form = {
      'channel' : 'p_' + ctx.userID,
      'seq' : '0',
      'partition' : '-2',
      'clientid' : ctx.clientID,
      'viewer_uid' : ctx.userID,
      'uid' : ctx.userID,
      'state' : 'active',
      'idle' : 0,
      'cap' : '8',
      'msgs_recv':0
    };
  }
  stop() {
    this.shouldStop = true;
    if(this.currentlyRunning) {
      if(this.req) this.req.abort();
      clearTimeout(this.currentlyRunning);
      this.currentlyRunning = null;
    }
  }
  start() {
    if(this.currentlyRunning) return;
    this.reset();
    this.listen();
  }
  listen() {
    if(this.shouldStop || !ctx.loggedIn) {
      return;
    }
    this.form.idle = ~~((Date.now() / 1000) - this.prev);
    this.prev = ~~((Date.now() / 1000));
    var _this = this;
    this.req = $.ajax({
      url: "https://0-edge-chat.facebook.com/pull",
      data: _this.form,
    })
       .always(function(resData) {
        if(resData.status != '200' || resData.statusText == 'error') {
          _this.currentlyRunning = setTimeout(_this.listen.bind(_this), Math.random() * 200 + 50);
          return;
        }
        resData = parseFbRes(resData.responseText);
        if(resData) {
          switch(resData.t) {
            case 'lb':
              _this.lb(resData);
              break;
            case 'fullReload':
              _this.fullReload(resData);
              _this.currentlyRunning = setTimeout(_this.listen.bind(_this), 1000);
              return;
              break;
          }
          if(resData.ms) {
            resData.ms.forEach(function (m) {
              console.log(m.type);
              switch(m.type) {
                case 'page_message':
                  _this.page_message(m);
                  break;
                case 'page_messaging':
                  console.log(m);
                  // _this.pages_messaging(m);
                  break;
                case 'pages_messaging':
                  _this.pages_messaging(m);
                  break;
                case 'page_typing':
                  _this.page_typing(m);
                  break;
                case 'notification_json':
                  _this.notification_json(m);
                  break;
                case 'notification':
                  _this.get_noti_legary();
              }
            })
          }

          if(resData.seq) {
            _this.form.seq = resData.seq;
          }
          if(resData.tr) {
            _this.form.traceid = resData.tr;
          }

          _this.currentlyRunning = setTimeout(_this.listen.bind(_this), Math.random() * 200 + 50);
        }
      })
  }

  get_noti_legary() {
    let url = 'https://business.facebook.com/ajax/notifications/client/get.php?dpr=2';
    let data = {
      length: 10,
      user: ctx.userID,
      fb_dtsg: dtsg
    }
    $.post(url, data);
  }

  // First
  lb(data) {
    this.form.sticky_token = data.lb_info.sticky;
    this.form.sticky_pool = data.lb_info.pool;
  }

  // FullReload
  fullReload(data) {
    this.form.seq = data.seq;
    delete this.form.sticky_pool;
    delete this.form.sticky_token;
  }

  page_message(data) {
    if (!worker) return;
    var nodes = m.nodes;
    var _this = this;
    nodes.forEach(function (node) {
      _this.page_message_node(node);
    });
  }

  page_message_node(node) {
    if(ctx.userID == node.biz_asset_id) return;
    let tid = '';
    let time = node.creation_time;
    this.worker.port.postMessage({
      listen: true,
      event: 'new_inbox',
      page_id: node.biz_asset_id,
      thread_id: tid,
      created_time: time
    });
  }

  // pages_messaging
  pages_messaging(data) {
    if (!worker) return;
    if (data.event !== "deliver") return;

    let pageId = data.realtime_viewer_fbid;

    if (!data.message) return;
    let tid = `t_${data.message.tid}`;
    let mid = data.message.mid;
    let timestamp = data.message.timestamp;
    let sender_fbid = data.message.sender_fbid;
    let other_user_fbid = data.message.other_user_fbid;
    let customer_id = sender_fbid == pageId ? other_user_fbid : sender_fbid;
    let body = data.message.body;
    let attachments = data.message.attachments;
    let admin_snippet = data.message.admin_snippet;

    this.worker.port.postMessage({
      listen: true,
      event: 'new_inbox',
      page_id: data.realtime_viewer_fbid,
      thread_id: tid,
      created_time: Math.round(timestamp/1000)
    });
  }
  // page_typing
  page_typing(m) {
    if(!worker) return;
    this.worker.port.postMessage({
      listen: true,
      event: 'page_typing',
      page_id: m.realtime_viewer_fbid,
      st: m.st,
      from: m.from
    });
  }
  // notification_json
  notification_json(m) {
    if (!worker) return;
    var nodes = m.nodes;
    var _this = this;
    nodes.forEach(function (node) {
      if(node.biz_asset_id == ctx.userID) return; //Notification of user
      console.log(' > ' + node.notif_type);
      let pageID = node.biz_asset_id;
      let postId = '';
      let postIdMatchs;
      switch (node.notif_type) {
        case 'page_message':
          _this.page_message_node(node);
          break;
        case 'feed_comment':
          postIdMatchs = node.url.match(/facebook.com\/([^/]+)\/posts\/(\d+)/i);
          if (postIdMatchs)
            postId = postIdMatchs[2];
          break;
        case 'photo_comment':
          postIdMatchs = node.url.match(/facebook.com\/([^/]+)\/photos\/([^/]+)\/(\d+)/i);
          if (postIdMatchs)
            postId = postIdMatchs[3];
          break;
        case 'photo_album_comment':
          console.log(node)
        // postIdMatchs = node.url.match(/facebook.com\/([^/]+)\/photos\/([^/]+)\/(\d+)/i);
        // if (postIdMatchs)
        //   postId = postIdMatchs[3];
          break;
      }
      if (postId == '') return; // Không tìm thấy postId

      let commentId;
      let commentIdMatchs = node.url.match(/comment_id=(\d+)/i);
      if (commentIdMatchs)
        commentId = commentIdMatchs[1];
      else
        return; // Không tìm thấy commentId

      let replyCommentId;
      let replyCommentIdMatchs = node.url.match(/reply_comment_id=(\d+)/i);
      if (replyCommentIdMatchs)
        replyCommentId = replyCommentIdMatchs[1];

      let id;
      let parent_id;
      if (replyCommentId) {
        parent_id = `${postId}_${commentId}`;
        id = `${commentId}_${replyCommentId}`;
      } else {
        id = `${postId}_${commentId}`;
        parent_id = `${pageID}_${postId}`;
      }
      console.log({
        listen: true,
        event: 'new_comment',
        page_id: pageID,
        post_id: postId,
        parent_id: parent_id,
        created_time: node.creation_time,
        id: id
      })
      if(!_this.worker || !_this.worker.port || !_this.worker.port.postMessage) return;
      _this.worker.port.postMessage({
        listen: true,
        event: 'new_comment',
        page_id: pageID,
        post_id: postId,
        id: id
      });
    })
  }
}
