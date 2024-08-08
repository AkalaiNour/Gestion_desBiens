const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
    annonceId: { type: mongoose.Schema.Types.ObjectId },
    date: { type: Date, default: Date.now }
});

const Visit = mongoose.model('Visit', visitSchema);

module.exports = Visit;
