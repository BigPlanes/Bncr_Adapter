/**
 * This file is part of the App project.
 * @author Aming
 * @name qq
 * @origin Bncr团队
 * @version 1.0.0
 * @description 外置qq机器人适配器
 * @adapter true
 * @public false
 * @disable false
 * @priority 100
 * @Copyright ©2023 Aming and Anmours. All rights reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 */

const path = require('path');

module.exports = async () => {
    if (!sysMethod.config.qqBot_Outside.enable) return sysMethod.startOutLogs('未启用外置qq 退出.');
    let qq = new Adapter('qq');
    if (sysMethod.config.qqBot_Outside.mode === 'ws') await ws(qq);
    else if (sysMethod.config.qqBot_Outside.mode === 'http') await http(qq);

    return qq;
};

async function ws(qq) {
    const events = require('events');
    const eventS = new events.EventEmitter();
    const { randomUUID } = require('crypto');
    const listArr = [];
    /* ws监听地址  ws://192.168.31.192:9090/api/qq/ws */
    router.ws('/api/bot/qqws', ws => {
        ws.on('message', msg => {
            const body = JSON.parse(msg);
            /* 拒绝心跳链接消息 */
            if (body.post_type === 'meta_event') return;
            // console.log('收到ws请求', body);
            if (body.echo) {
                for (const e of listArr) {
                    if (body.echo !== e.uuid) continue;
                    if (body.status && body.status === 'ok')
                        return e.eventS.emit(e.uuid, body.data.message_id.toString());
                    else return e.eventS.emit(e.uuid, '');
                }
            }
            /* 不是消息退出 */
            if (!body.post_type || body.post_type !== 'message') return;
            let msgInfo = {
                userId: body.sender.user_id + '' || '',
                userName: body.sender.nickname || '',
                groupId: body.group_id ? body.group_id + '' : '0',
                groupName: body.group_name || '',
                msg: body.raw_message || '',
                msgId: body.message_id + '' || '',
            };
            // console.log('最终消息：', msgInfo);
            qq.receive(msgInfo);
        });

        /* 发送消息方法 */
        qq.reply = async function (replyInfo) {
            try {
                let uuid = randomUUID();
                let body = {
                    action: 'send_msg',
                    params: {},
                    echo: uuid,
                };
                +replyInfo.groupId
                    ? (body.params.group_id = replyInfo.groupId)
                    : (body.params.user_id = replyInfo.userId);
                if (replyInfo.type === 'text') {
                    body.params.message = replyInfo.msg;
                } else if (replyInfo.type === 'image') {    // 图片
                    body.params.message = {
                        "type": "image",
                        "data": {
                            "file": replyInfo.path,     // 图片文件名
                            "type": replyInfo.show,     // 图片类型, flash 表示闪照, show 表示秀图, 默认普通图片
                            "id": replyInfo.id          // 发送秀图时的特效id, 默认为40000
                        }
                    }
                } else if (replyInfo.type === 'cardimage') {   // xml的图片消息（装逼大图），失效
                    body.params.message = {
                        "type": "cardimage",
                        "data": {
                            "file:": replyInfo.path,    //和image的file字段对齐, 支持也是一样的
                            "minwidth": "",	            //默认不填为400, 最小width
                            "minheight": "",	        //默认不填为400, 最小height
                            "maxwidth": "",             //默认不填为500, 最大width
                            "maxheight": "",	        //默认不填为1000, 最大height
                            "source": "",	            //分享来源的名称, 可以留空
                            "icon": ""	                //分享来源的icon图标url, 可以留空
                        }
                    }
                } else if (replyInfo.type === 'video') {    // 视频
                    body.params.message = {
                        "type": "video",
                        "data": {
                            "file": replyInfo.path,
                            "cover": "",        // 视频封面, 支持http, file和base64发送, 格式必须为jpg
                            "c": ""             // 通过网络下载视频时的线程数, 默认单线程. (在资源不支持并发时会自动处理)
                        }
                    }
                } else if (replyInfo.type === 'record') {   // 语音
                    body.params.message = {
                        "type": "record",
                        "data": {
                            "file": replyInfo.path,         // 语音文件名
                            // "magic": "",	                // 发送时可选, 默认 0, 设置为 1 表示变声
                            // "cache": "",		            // 只在通过网络 URL 发送时有效, 表示是否使用已缓存的文件, 默认 1
                            // "proxy": "",	                // 只在通过网络 URL 发送时有效, 表示是否通过代理下载文件(需通过环境变量或配置文件配置代理) , 默认 1
                            // "timeout": ""	                // 只在通过网络 URL 发送时有效, 单位秒, 表示下载网络文件的超时时间, 默认不超时
                        }
                    }
                } else if (replyInfo.type === 'tts') {      // 文本转语音
                    body.params.message = {
                        "type": "tts",
                        "data": {
                            "text": replyInfo.msg
                        }
                    }
                } else if (replyInfo.type === 'share') {    // 链接分享
                    body.params.message = {
                        "type": "share",
                        "data": {
                            "url": replyInfo.path,
                            "title": replyInfo.msg,
                            "content": "",      // 发送时可选, 内容描述
                            "image": ""         // 发送时可选, 图片 URL
                        }
                    }
                } else if (replyInfo.type === 'music') {    // 音乐分享
                    // musictype    qq          163             xm          custom
                    // 分别表示使用 QQ音乐    网易云音乐       虾米音乐    自定义音乐分享
                    if (replyInfo.musictype === 'custom') {     // 自定义音乐分享失效
                        body.params.message = {
                            "type": "music",
                            "data": {
                                "type": "custom",
                                "url": replyInfo.url,
                                "audio": replyInfo.path,
                                "title": replyInfo.msg
                            }
                        }
                    } else {
                        body.params.message = {
                            "type": "music",
                            "data": {
                                "type": replyInfo.musictype,
                                "id": replyInfo.id,
                            }
                        }
                    }
                } else if (replyInfo.type === 'xml') {      // xml消息
                    body.params.message = {
                        "type": "xml",
                        "data": {
                            "data": replyInfo.msg,
                            "resid": ""	        // 可能为空, 或空字符串
                        }
                    }
                } else if (replyInfo.type === 'json') {     // json消息，失效
                    //json中的字符串需要进行转义 :
                    // ","=> &#44;
                    // "&"=> &amp;
                    // "["=> &#91;
                    // "]"=> &#93;
                    body.params.message = {
                        "type": "json",
                        "data": {
                            "data": replyInfo.msg,
                            "resid": ""	        // 默认不填为0, 走小程序通道, 填了走富文本通道发送
                        }
                    }
                }
                // console.log(body);
                ws.send(JSON.stringify(body));
                return new Promise((resolve, reject) => {
                    listArr.push({ uuid, eventS });
                    let timeoutID = setTimeout(() => {
                        delListens(uuid);
                        eventS.emit(uuid, '');
                    }, 60 * 1000);
                    eventS.once(uuid, res => {
                        try {
                            delListens(uuid);
                            clearTimeout(timeoutID);
                            resolve(res || '');
                        } catch (e) {
                            console.error(e);
                        }
                    });
                });
            } catch (e) {
                console.error('qq:发送消息失败', e);
            }
        };

        /* 推送消息 */
        qq.push = async function (replyInfo) {
            // console.log(replyInfo);
            return await this.reply(replyInfo);
        };

        /* 注入删除消息方法 */
        qq.delMsg = async function (argsArr) {
            try {
                argsArr.forEach(e => {
                    if (typeof e !== 'string' && typeof e !== 'number') return false;
                    ws.send(
                        JSON.stringify({
                            action: 'delete_msg',
                            params: { message_id: e },
                        })
                    );
                });
                return true;
            } catch (e) {
                console.log('qq撤回消息异常', e);
                return false;
            }
        };
    });

    /**向/api/系统路由中添加路由 */
    router.get('api/bot/qqws', (req, res) =>
        res.send({ msg: '这是Bncr 外置qq Api接口，你的get请求测试正常~，请用ws交互数据' })
    );
    router.post('/api/bot/qqws', async (req, res) =>
        res.send({ msg: '这是Bncr 外置qq Api接口，你的post请求测试正常~，请用ws交互数据' })
    );

    function delListens(id) {
        listArr.forEach((e, i) => e.uuid === id && listArr.splice(i, 1));
    }
}

async function http(qq) {
    const request = require('util').promisify(require('request'));
    /* 上报地址（gocq监听地址） */
    let senderUrl = sysMethod.config.qqBot_Outside.sendUrl;
    if (!senderUrl) {
        console.log('qq:配置文件未设置sendUrl');
        qq = null;
        return;
    }

    /* 接受消息地址为： http://bncrip:9090/api/bot/qqHttp */
    router.post('/api/bot/qqHttp', async (req, res) => {
        res.send('ok');
        const body = req.body;
        // console.log('req', req.body);
        /* 心跳消息退出 */
        if (body.post_type === 'meta_event') return;
        // console.log('收到qqHttp请求', body);
        /* 不是消息退出 */
        if (!body.post_type || body.post_type !== 'message') return;
        let msgInfo = {
            userId: body.sender['user_id'] + '' || '',
            userName: body.sender['nickname'] || '',
            groupId: body.group_id ? body.group_id + '' : '0',
            groupName: body.group_name || '',
            msg: body['raw_message'] || '',
            msgId: body.message_id + '' || '',
        };
        qq.receive(msgInfo);
    });

    /**向/api/系统路由中添加路由 */
    router.get('/api/bot/qqHttp', (req, res) =>
        res.send({ msg: '这是Bncr 外置qq Api接口，你的get请求测试正常~，请用ws交互数据' })
    );
    router.post('/api/bot/qqHttp', async (req, res) =>
        res.send({ msg: '这是Bncr 外置qq Api接口，你的post请求测试正常~，请用ws交互数据' })
    );

    /* 回复 */
    qq.reply = async function (replyInfo) {
        try {
            let action = '/send_msg',
                body = {};
            +replyInfo.groupId ? (body['group_id'] = replyInfo.groupId) : (body['user_id'] = replyInfo.userId);
            if (replyInfo.type === 'text') {
                body.message = replyInfo.msg;
            } else if (replyInfo.type === 'image') {
                body.message = `[CQ:image,file=${replyInfo.msg}]`;
            } else if (replyInfo.type === 'video') {
                body.message = `[CQ:video,file=${replyInfo.msg}]`;
            }
            let sendRes = await requestPost(action, body);
            return sendRes ? sendRes.message_id : '0';
        } catch (e) {
            console.error('qq:发送消息失败', e);
        }
    };
    /* 推送消息 */
    qq.push = async function (replyInfo) {
        return await this.reply(replyInfo);
    };

    /* 注入删除消息方法 */
    qq.delMsg = async function (argsArr) {
        try {
            argsArr.forEach(e => {
                if (typeof e === 'string' || typeof e === 'number') {
                    requestPost('/delete_msg', { message_id: e });
                }
            });
            return true;
        } catch (e) {
            console.log('qq撤回消息异常', e);
            return false;
        }
    };

    /* 请求 */
    async function requestPost(action, body) {
        return (
            await request({
                url: senderUrl + action,
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: body,
                json: true,
            })
        ).body;
    }
};
