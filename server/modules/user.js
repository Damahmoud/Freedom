const mongoose = require('mongoose');
const sch = mongoose.Schema;

const table = new sch({
    username:{
        type: String,
        require: true,
        unique: true
    },
    password:{
        type: String,
        require: true
    }
}) 

module.exports = mongoose.model('user', table);