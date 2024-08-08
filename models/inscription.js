const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const inscriptionSchema = new Schema({
    Nom: String,
    Prénom: String,
    Email: String,
    Password: String,
    salt: String,
    Téléphone: String,
    rôle: String,
    profilePicture: {type: String},
    dateDeCréation: { type: Date, default: Date.now },
    favorites: [{ type: Schema.Types.ObjectId, ref: 'annonce' }], // Reference to Annonce
    annonces: [{ type: mongoose.Schema.Types.ObjectId, ref: 'annonce' }]

});

const Inscription = mongoose.model("Inscription", inscriptionSchema);
module.exports = Inscription;
