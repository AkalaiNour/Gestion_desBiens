const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inscription', // Assuming your user model is named 'User'
        required: true
    },
    description: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;
