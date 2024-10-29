const mongoose = require('mongoose');
const Sch = mongoose.Schema;

const table = new Sch({
    title:{
        type: String,
        require: true,
    },
    body:{
        type: String,
        require: true,
    },
    createdAt:{
        type: Date,
        default: Date.now
    },
    update:{
        type: Date,
        default: Date.now
    },
    author: { 
        type: String,
        require: true
    }
});

module.exports = mongoose.model('data', table);



