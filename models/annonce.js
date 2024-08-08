const mongoose = require('mongoose');
const Schema = mongoose.Schema

const annonceSchema = new Schema({
    titre: String,
    Prix: String,
    surface: Number,
    nombreDePieces: Number,
    typeDeBien: String,
    adresse: String,
    photosVideos: [String],
    diagnostics: String,
    equipements: String,
    dateDePublication: { type: Date, default: Date.now },
    userId: { type: Schema.Types.ObjectId, ref: 'Inscription' },
    description: String
});

const annonce = mongoose.model("annonce",annonceSchema);
module.exports=annonce;