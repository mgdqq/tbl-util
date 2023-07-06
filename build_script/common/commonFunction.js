const _ = require('lodash');

function tstFunc(val) {
    return val.split('_');
}

module.exports = {
    tstFunc: tstFunc,
}