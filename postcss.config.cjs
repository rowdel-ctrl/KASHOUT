// Write CSS in px; it is converted to rem so the "Text size" setting scales everything.
module.exports = {
  plugins: [
    require('postcss-pxtorem')({
      rootValue: 16,
      propList: ['*'],
      minPixelValue: 1.5,
    }),
  ],
};
