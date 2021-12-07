/* eslint-disable no-underscore-dangle */
import dayjs from 'dayjs';
import 'socket.io-client/dist/socket.io';
import Socket from '../services/Socket';
// import FieldTinyMce from './components/fields/FieldTinyMce.vue';

/**
 * You can register global components here and use them as a plugin in your main Vue instance
 */

const GlobalComponents = {
  install(Vue) {
    // Vue.component('fieldTinyMce', FieldTinyMce);
    Vue.filter('formatDate', (date, format = 'DD.MM.YYYY à h:mm') => {
      if (!date) return '';
      return dayjs(date).format(format);
    });

    Vue.use(Socket);
  },
};

export default GlobalComponents;
