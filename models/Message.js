const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inscription',
        required: true
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inscription',
        required: true
    },
    subject: {
        type: String, // Changed from ObjectId to String
    },
    content: {
        type: String,
        required: true
    },
    annonceId: { // Add annonceId here
        type: mongoose.Schema.Types.ObjectId,
        ref: 'annonce', // Reference to the Annonce model
        required: false // Optional, depends on your use case
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    seen: { type: Boolean, default: false },
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
