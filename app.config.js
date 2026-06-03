// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseConfig = require('./app.json');

const expo = baseConfig.expo;

module.exports = {
  ...expo,
  updates: {
    url: 'https://u.expo.dev/bb44e700-07ec-451a-9bb0-544e2c600bc2',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  android: {
    ...expo.android,
    ...(process.env.APP_VARIANT === 'development' && { applicationIdSuffix: '.dev' }),
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? '',
      },
    },
  },
};
