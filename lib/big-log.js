module.exports = {
  log: function (msg, marker) {
    marker = Array(4).join(marker);
    console.log('');
    console.log(marker + ' ' + msg + ' ' + marker);
    console.log('');
  },
};
