/* eslint-disable no-underscore-dangle */
import * as io from 'socket.io-client/dist/socket.io';
import config from '../config';

export default {

  install(Vue) {
    console.log('socket connecting...');
    const socket = io(config.apiUrl !== '/' ? config.apiUrl.replace('http', 'ws') : null,
      {
        path: '/realtime',
        transports: ['websocket', 'polling'],
        transportOptions: {
          polling: {
            extraHeaders: {
              Authorization: 'Bearer abc',
            },
          },
        },
        extraHeaders: {
          Authorization: `Bearer ${localStorage.getItem(`${config.appKey}_token`)}`,
        }
      });

    window.socket = socket;
    Vue.prototype.$socket = socket;

    socket._call = function apiCall(method, event, options) {
      return new Promise((resolve, reject) => {
        socket.emit(event, { ...options, method }, (err, data) => {
          console.log('[socket callback]', err, data);
          if (err) {
            console.error(err);
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    };

    socket.get = socket._call.bind(undefined, 'GET');
    socket.post = socket._call.bind(undefined, 'POST');
    socket.put = socket._call.bind(undefined, 'PUT');
    socket.delete = socket._call.bind(undefined, 'DELETE');

    socket.onopen((a) => {
      console.log('[SOCKET] connected');
    });
    socket.on('connect', () => {
      console.log('[SOCKET] connecting');
      socket.emit('Authorization', localStorage.getItem(`${config.appKey}_token`));
    });

    socket.on('disconnect', (a) => {
      console.log('socket reconnecting...', a);
      socket.connect();
    });

    socket.on('ping', (second) => {
      console.log('ping', second);
    });
    socket.on('message', (second) => {
      console.log('message', second);
    });

    setTimeout(() => {
      socket.connect();
    }, 3000);
  }
};