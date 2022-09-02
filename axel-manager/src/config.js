export default {
  appName: 'Axel admin dashboard',
  zappKey: 'axel_admin_panel',
  appLogo: '',
  display: {
    primaryColor: '#0077b6',
    backgroundColor: 'primary',
    backgroundImage: 'https://source.unsplash.com/random/1920x1080',
    appLogo: '',
  },
  titleLogo: '',
  env: process.env.VUE_APP_ENV || 'development', // production / test
  defaultLocale: 'fr',
  /* eslint-disable */
  apiUrl: process.env.VUE_APP_API_URL || '/',
  googleAuthClient: process.env.VUE_APP_GOOGLE_AUTH_CLIENT,
  buildDate: process.env.BUILDDATE || 'now',
  version: '',
  defaultTitle: 'Axel admin dashboard',

  primaryKey: 'id', // || '_id'
  features: {
    googleAuth: true,
    facebookAuth: false,
    register: true,
    passwordReset: true,
    autoWireAllModels: true,
  },
};
