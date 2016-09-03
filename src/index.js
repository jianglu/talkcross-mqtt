//
// Copyright (C) 2016 Changzhou TwistSnake Co.,Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

const debug = require('debug')('mqtt');

import mosca from 'mosca';
import request from 'request-promise';

import { compact, split, chunk, fromPairs } from 'lodash';
import { inspect } from 'util';

var ascoltatore = {
  // using ascoltatore
  type: 'mongo',
  url: 'mongodb://localhost:27017/mqtt',
  pubsubCollection: 'ascoltatori',
  mongo: {}
};

var settings = {
  port: 1883,
  backend: ascoltatore
};

var server = new mosca.Server(settings);

//如果需要用户登录验证权限，需要改写此方法
//这里以简单判断了用户名和密码为例，真实环境可以连接实际业务系统的鉴权服务
function authenticate(client, username, password, callback) {
  debug(`[authenticate] client: ${client}, username: ${username}, password: ${password}`)
  request('https://api.leancloud.cn/1.1/users/me', {
    method: 'GET',
    json: true,
    headers: {
      'X-LC-Id': '0x08VitFksfeN3orC1v9Eiif-gzGzoHsz',
      'X-LC-Key': 'TLb63GxWqtXNMWagJpD9QBKS',
      'X-LC-Session': password
    },
  }).then(user => {
    if (user && user.objectId && user.objectId === username) {
      client.uid = user.objectId
      client.token = password;
      callback(null, true);
    } else {
      callback(`Invalid Credentials`, false);
    }
  }, error => {
    callback(error, false);
  })
}

function authorizePublish(client, topic, payload, callback) {
  debug(`[authorizePublish] client: ${client}, topic: ${topic}, payload: ${payload}`)
  callback(null, payload);
}

// curl -X GET \
// -H "X-LC-Id: 0x08VitFksfeN3orC1v9Eiif-gzGzoHsz" \
// -H "X-LC-Key: TLb63GxWqtXNMWagJpD9QBKS" \
// -H "X-LC-Session: qmdj8pdidnmyzp0c7yqil91oc" \
// https://api.leancloud.cn/1.1/users/me
// /domain/talkcross.com/uid/57c91c100a2b58006b239e99/client/android
function authorizeSubscribe(client, topic, callback) {
  var params = fromPairs(chunk(compact(split(topic, '/')), 2));
  debug(`[authorizeSubscribe] ${inspect(params)}`)
  if (params['uid'] === client.uid) {
    callback(null, topic)
  } else {
    callback('User mismatch', false)
  }
}

server.on('clientConnected', (client) => {
  console.log('client connected', client.id);
});

// fired when a message is received
server.on('published', (packet, client) => {
  console.log('Published', packet.payload);
});

server.on('ready', setup);

// fired when the mqtt server is ready
function setup() {
  server.authenticate = authenticate;
  server.authorizePublish = authorizePublish;
  server.authorizeSubscribe = authorizeSubscribe;
  console.log('Mosca server is up and running');
}
