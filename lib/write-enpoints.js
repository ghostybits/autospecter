var _ = require('lodash');

/* You can use this to set a basic template for remote methods
   you want included on all models */

module.exports = {
  run: function (modelName) {
    return (
`'use strict';
module.exports = function (${_.capitalize(modelName)}) {

};
`
    );
  },
};
