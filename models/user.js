const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    profilePicture: { type: String }, // URL to the profile picture
    // Other fields...
});

const User = mongoose.model('User', userSchema);

module.exports = User;
