const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const router = express.Router();
const multer = require('multer');
const Inscription = require('../models/inscription');
const Annonce = require('../models/annonce');
const User = require('../models/user'); // Assume you have a User model
const auth = require('../models/auth'); // Adjust path if necessary
const Categories = require('../models/Category');
const fs = require('fs');
const Admin = require('../models/Admin'); // Adjust the path if necessary
const { ObjectId } = mongoose.Types;
const moment = require('moment');
const Message = require('../models/Message'); // Import your message model
const Activity = require('../models/activity'); // Adjust path if necessary
const Visit = require('../models/Visite'); // Import the Visit model

// Ensure this path is correct

router.use('/profilePictures', express.static(path.join(__dirname, 'public', 'profilePictures')));
router.use('/photos', express.static(path.join(__dirname, 'public', 'photos')));
async function sendMessage(senderId, recipientId, content) {
    try {
        const message = new Message({
            senderId,
            recipientId,
            content
        });
        await message.save();
        console.log('Message sent successfully!');
    } catch (error) {
        console.error('Error sending message:', error);
    }
}


const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/profilePictures')); // Profile pictures path
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Filename with timestamp
    }
});

// Middleware for uploading profile pictures
const uploadProfilePic = multer({ storage: profileStorage });

// Storage configuration for photos and videos
// Storage configuration for photos and videos
const annonceStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/photos')); // Set the destination for uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Set the filename with a timestamp
    }
});

// File upload middleware
const uploadPhotosVideos = multer({
    storage: annonceStorage,
    limits: { fileSize: 60 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb);
    }
}).array('photosVideos', 10); // Accept multiple files (up to 10)

// Function to check file type
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif|mp4|avi/; // Allowed extensions
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Images and Videos Only!'));
    }
}


// Middleware for authentication
function authMiddleware(req, res, next) {
    if (req.session && req.session.userId) {
        console.log('User is authenticated:', req.session.userId);
        return next();
    } else {
        console.log('User is not authenticated');
        return res.status(401).json({ message: 'Unauthorized' });
    }
}


router.post('/sendMessage', async (req, res) => {
    const { message, senderId, recipientId, annonceId } = req.body;

    console.log('Request Body:', req.body);

    try {
        if (!mongoose.Types.ObjectId.isValid(senderId)) {
            console.error('Invalid Sender ID:', senderId);
            return res.status(400).send('Invalid Sender ID');
        }
        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
            console.error('Invalid Recipient ID:', recipientId);
            return res.status(400).send('Invalid Recipient ID');
        }
        if (!mongoose.Types.ObjectId.isValid(annonceId)) {
            console.error('Invalid Annonce ID:', annonceId);
            return res.status(400).send('Invalid Annonce ID');
        }

        const senderObjectId = new mongoose.Types.ObjectId(senderId);
        const recipientObjectId = new mongoose.Types.ObjectId(recipientId);
        const annonceObjectId = new mongoose.Types.ObjectId(annonceId);

        const sender = await Inscription.findById(senderObjectId);
        const recipient = await Inscription.findById(recipientObjectId);
        const annonce = await Annonce.findById(annonceObjectId);

        if (!sender || !recipient || !annonce) {
            return res.status(404).send('Sender, recipient, or annonce not found');
        }

        const newMessage = new Message({
            senderId: senderObjectId,
            recipientId: recipientObjectId,
            subject: annonce.titre, // Assuming 'titre' is the field in your Annonce schema
            content: message,
            annonceId: annonceObjectId, // Include annonceId here
        });

        await newMessage.save();

        const activityDescription = `User ${sender.Nom} ${sender.Prénom} sent a message to User ${recipient.Nom} ${recipient.Prénom}`;
        const activity = new Activity({
            userId: senderObjectId,
            description: activityDescription,
        });
        await activity.save();

        res.redirect(`/message/${recipientId}/${annonceId}`);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).send('Error sending message');
    }
});

// Route to display messages between two users

router.get('/message/:userId/:annonceId', async (req, res) => {
    const { userId, annonceId } = req.params;
    const currentUserId = req.session.userId;

    try {
        if (!currentUserId) {
            return res.status(401).send('User not logged in');
        }

        if (
            !mongoose.Types.ObjectId.isValid(currentUserId) ||
            !mongoose.Types.ObjectId.isValid(userId) ||
            !mongoose.Types.ObjectId.isValid(annonceId)
        ) {
            console.error('Invalid ID(s):', { currentUserId, userId, annonceId });
            return res.status(400).send('Invalid ObjectId');
        }

        const senderObjectId = new mongoose.Types.ObjectId(currentUserId);
        const recipientObjectId = new mongoose.Types.ObjectId(userId);

        const messages = await Message.find({
            $or: [
                { senderId: senderObjectId, recipientId: recipientObjectId, annonceId: annonceId },
                { senderId: recipientObjectId, recipientId: senderObjectId, annonceId: annonceId },
            ],
        })
            .populate('senderId', 'Nom Prénom Email') // Ensure these fields are populated
            .populate('annonceId') // Ensure annonceId is populated if used
            .sort('timestamp');

        console.log('Messages:', messages); // Log to verify the structure

        await Message.updateMany(
            { recipientId: senderObjectId, senderId: recipientObjectId, seen: false },
            { $set: { seen: true } }
        );

        const sender = await Inscription.findById(senderObjectId);
        const recipient = await Inscription.findById(recipientObjectId);
        const annonce = await Annonce.findById(annonceId);

        if (!sender || !recipient || !annonce) {
            return res.status(404).send('Resource not found');
        }

        res.render('Contact', { // Ensure the template name matches
            senderId: sender._id,
            senders: sender,
            recipientId: recipient._id,
            recipients: recipient,
            currentUserId: currentUserId,
            userId: userId,
            annonce: annonce,
            messages,
        });
    } catch (err) {
        console.error('Error retrieving messages:', err);
        res.status(500).send('Error retrieving messages');
    }
});

// Routes
router.get('/', async (req, res) => {
    try {
        const userLoggedIn = req.session.user ? true : false;
        const userId = req.session.userId || null; // Assuming the user ID is stored in the session

        // Fetch all annonces
        let annonces = await Annonce.find();

        if (userLoggedIn) {
            // Filter out annonces published by the logged-in user
            annonces = annonces.filter(annonce => annonce.userId.toString() !== userId.toString());
        }

        // Fetch all categories with their offerings
        const categories = await Categories.find();

        res.render('annonce', { annonces, categories, userLoggedIn, userId });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
router.get('/Connexion.html', (req, res) => {
    res.render('Connexion', { error: null });
});
router.get('/Profile', async (req, res) => {
    const userId = req.session.userId; // Assume user ID is stored in session
    const categories = await Categories.find();
    const userLoggedIn = req.session.user ? true : false;
    const annonces = await Annonce.find(); // Fetch all annonces

    // Fetch all categories with their offerings

    Inscription.findById(userId)
        .then((info) => {
            if (!info) {
                return res.status(404).send('User not found');
            }
            res.render('profile', { array: info, annonces, categories, userLoggedIn });
        })
        .catch((err) => {
            console.log(err);
            res.status(500).send('Server error');
        });
});

router.get('/dashboard', authMiddleware, (req, res) => {
    const userId = req.session.userId;

    Annonce.find({ userId: userId })
        .then((result) => {
            res.render('dashboard', { array: result });
        })
        .catch((err) => {
            console.log(err);
            res.status(500).send('Server error');
        });
});


router.get('/annonce.html', async (req, res) => {
    try {
        const userLoggedIn = req.session.user ? true : false;
        const userId = req.session.userId || null; // Assuming the user ID is stored in the session

        // Fetch all annonces
        let annonces = await Annonce.find();

        if (userLoggedIn) {
            // Filter out annonces published by the logged-in user
            annonces = annonces.filter(annonce => annonce.userId.toString() !== userId.toString());
        }

        // Fetch all categories with their offerings
        const categories = await Categories.find();

        res.render('annonce', { annonces, categories, userLoggedIn, userId });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get('/annonceDetails.html/:id', async (req, res) => {
    try {
        const annonce = await Annonce.findById(req.params.id).populate('userId');
        const userId = req.session.userId || null;
        const categories = await Categories.find();

        if (!annonce) {
            return res.status(404).send('Annonce not found');
        }

        // Fetch other annonces excluding those from the same user
        const otherAnnonces = await Annonce.find({
            _id: { $ne: annonce._id },
            userId: { $ne: userId }
        }).limit(5); // Limit the number of other annonces to show

        res.render('AnnonceDetails', {
            annonce,
            otherAnnonces,
            userLoggedIn: !!userId,
            userId: userId,
            categories
        });
    } catch (error) {
        console.error('Error fetching annonce details:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Assuming you are using express-session
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Failed to destroy session:', err);
            return res.status(500).send('Server error');
        }
        // Redirect to homepage or login page after successful logout
        res.redirect('/');
    });
});

router.get('/Inscription.html', (req, res) => {
    res.render('Inscription', { error: null });
});

router.get('/Favourite.html', authMiddleware, async (req, res) => {
    try {
        const userId = req.session.userId; // or req.user._id depending on your setup
        const user = await Inscription.findById(userId).populate('favorites');
        const userLoggedIn = req.session.user ? true : false;
        const categories = await Categories.find(); // Fetch all categories with their offerings

        if (!user) {
            return res.status(404).render('favorites', { favorites: [] }); // Pass an empty array if user not found
        }

        res.render('Favourite', { favorites: user.favorites, categories, userLoggedIn, userId }); // Pass the favorites data to the template
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).render('favorites', { favorites: [] }); // Handle error and pass an empty array
    }
});

router.post('/favorites/add', authMiddleware, async (req, res) => {
    try {
        const { annonceId } = req.body;
        console.log('Request body:', req.body);
        console.log('Annonce ID:', annonceId);

        if (!annonceId) {
            console.log('No Annonce ID provided');
            return res.status(400).json({ message: 'Annonce ID is required' });
        }

        const userId = req.session.userId;
        console.log('User ID:', userId);

        const user = await Inscription.findById(userId);
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.favorites.includes(annonceId)) {
            console.log('Annonce already in favorites');
            return res.status(400).json({ message: 'Annonce already in favorites' });
        }

        user.favorites.push(annonceId);
        await user.save();

        // Log the activity here
        await logAddToFavorites(userId, annonceId);

        console.log('Annonce added to favorites');
        res.json({ success: true, message: 'Annonce added to favorites' });
    } catch (error) {
        console.error('Error adding annonce to favorites:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/api/favorites/remove', authMiddleware, async (req, res) => {
    try {
        const { annonceId } = req.body;
        console.log('Request body:', req.body);

        if (!annonceId) {
            return res.status(400).json({ message: 'Annonce ID is required' });
        }

        const userId = req.session.userId;
        const user = await Inscription.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove annonceId from favorites
        user.favorites = user.favorites.filter(id => id.toString() !== annonceId);
        await user.save();

        // Log the removal activity
        const activity = new Activity({
            userId: new mongoose.Types.ObjectId(userId),
            description: `Removed annonce with ID ${annonceId} from favorites`
        });
        await activity.save();

        res.json({ success: true, message: 'Annonce removed from favorites and activity logged' });
    } catch (error) {
        console.error('Error removing annonce from favorites:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/inscription.html', async (req, res) => {
    const { Nom, Prénom, Email, Password, Téléphone, rôle } = req.body;

    try {
        const existingUser = await Inscription.findOne({ Email });
        if (existingUser) {
            return res.render('Inscription', { error: 'Email already exists. Please use a different email.' });
        }

        const newUser = new Inscription({ Nom, Prénom, Email, Password, Téléphone, rôle });
        await newUser.save();
        res.redirect('Connexion.html');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/Connexion.html', async (req, res) => {
    const { Email, Password } = req.body;

    try {
        // Find user by email
        const user = await Inscription.findOne({ Email });
        if (!user || Password !== user.Password) {
            return res.render('Connexion', { error: 'Email or password are invalid' });
        }

        // Set user session
        req.session.userId = user._id;
        req.session.user = {
            Email: user.Email,
            rôle: user.rôle.trim()
        };

        // Log the login activity
        const activityDescription = `User with email ${Email} logged in`;
        const activity = new Activity({
            userId: user._id,
            description: activityDescription
        });
        await activity.save();

        // Redirect based on user role
        res.redirect('annonce.html');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Additional routes from the second code
router.get('/ListeMessage.html', authMiddleware, (req, res) => {
    const userId = req.session.userId;
    Message.find({ recipientId: userId })
        .populate('senderId', 'Nom Prénom Email')
        .populate('annonceId')
        .then((messages) => {
            console.log('Messages:', JSON.stringify(messages, null, 2)); // Detailed logging
            res.render('listemessage', { messages });
        })
        .catch((err) => {
            console.log(err);
            res.status(500).send('Server error');
        });
});

router.get('/detaille/:id', async (req, res) => {
    const annonceId = req.params.id;
    console.log('Received ID:', annonceId); // Debugging line

    // Check if the ID is valid
    if (!mongoose.Types.ObjectId.isValid(annonceId)) {
        return res.status(400).send('Invalid ID format');
    }

    try {
        // Attempt to find the annonce by ID
        const annonce = await Annonce.findById(annonceId);
        if (!annonce) return res.status(404).send('Annonce not found');
        res.render('detaille', { arr: annonce });
    } catch (err) {
        console.error('Error fetching annonce:', err.message); // Log error message
        res.status(500).send('Server error');
    }
});

router.get('/forms.html', async (req, res) => {
    try {
        // Fetch all categories from the database
        const categories = await Categories.find();
        // Render the form and pass the categories
        res.render('forms', { categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get('/stats.html', async (req, res) => {
    const userId = req.session.userId;
    const senderId = req.session.userId;

    if (!userId) {
        return res.status(401).send('User not authenticated');
    }

    try {
        const totalAnnonces = await Annonce.countDocuments({ userId });
        const userAnnonces = await Annonce.find({ userId }).distinct('_id');
        const totalmessages = await Message.countDocuments({ senderId });


        const totalViews = await Visit.countDocuments({ annonceId: { $in: userAnnonces } });

        // Fetch view counts for each annonce
        const annonceViews = await Visit.aggregate([
            { $match: { annonceId: { $in: userAnnonces.map(id => new mongoose.Types.ObjectId(id)) } } },
            { $group: { _id: '$annonceId', count: { $sum: 1 } } }
        ]);

        // Fetch annonce details to map IDs to titles
        const annonceDetails = await Annonce.find({ _id: { $in: annonceViews.map(view => view._id) } }).select('_id titre');

        const annonceDetailsMap = annonceDetails.reduce((map, annonce) => {
            map[annonce._id] = annonce.titre;
            return map;
        }, {});

        // Update annonceViews to include titles instead of IDs
        const truncateTitle = (title, maxLength = 20) => {
            return title.length > maxLength ? title.slice(0, maxLength) + '...' : title;
        };

        const annonceViewsWithTitles = annonceViews.map(view => ({
            titre: truncateTitle(annonceDetailsMap[view._id]),
            count: view.count
        }));


        // Fetch monthly views for all annonces
        const monthlyViews = await Visit.aggregate([
            { $match: { annonceId: { $in: userAnnonces.map(id => new mongoose.Types.ObjectId(id)) } } },
            { $group: { _id: { month: { $month: '$date' }, year: { $year: '$date' } }, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Fetch the number of annonces published per month
        const annoncesPerMonth = await Annonce.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: { month: { $month: '$dateDePublication' }, year: { $year: '$dateDePublication' } }, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.render('stats', {
            totalAnnonces,
            totalViews,
            annonceViews: annonceViewsWithTitles, // Updated data here
            monthlyViews,
            annoncesPerMonth,
            totalmessages
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/Edit/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Fetch the annonce by ID
        const annonce = await Annonce.findById(id).exec();

        if (!annonce) {
            return res.status(404).send('Annonce not found');
        }

        // Fetch all categories
        const categories = await Categories.find().exec();

        // Render the edit page with both annonce and categories data
        res.render('Edit', {
            obj: annonce,
            categories: categories
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});
router.get('/Editprofile/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.session.userId || null; // Assuming the user ID is stored in the session
        // Fetch the annonce by ID
        const user = await Inscription.findById(id).exec();
        const userLoggedIn = req.session.user ? true : false;
        const categories = await Categories.find(); // Fetch all categories with their offerings

        if (!user) {
            return res.status(404).send('user not found');
        }

        // Fetch all categories

        // Render the edit page with both user and categories data
        res.render('Editprofile', {
            obj: user,
            categories,
            userLoggedIn,
            userId
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});
router.get('/changepassword/:id', async (req, res) => {
    const userId = req.params.id;
    const categories = await Categories.find(); // Fetch all categories with their offerings
    const userLoggedIn = req.session.user ? true : false;

    res.render('changepassword', { userId, categories, userLoggedIn });
});

router.post('/forms.html', authMiddleware, uploadPhotosVideos, async (req, res) => {
    try {
        // Handle photosVideos field
        let photosVideos = [];

        if (req.files) {
            req.files.forEach((file) => {
                photosVideos.push(`/photos/${file.filename}`);
            });
        }

        // Create a new annonce
        const newAnnonce = new Annonce({
            titre: req.body.titre,
            Prix: req.body.Prix,
            description: req.body.description,
            surface: req.body.surface,
            nombreDePieces: req.body.nombreDePieces,
            typeDeBien: req.body.typeDeBien,
            adresse: req.body.adresse,
            photosVideos: photosVideos,
            diagnostics: req.body.diagnostics,
            equipements: req.body.equipements,
            userId: req.session.userId, // Associate the annonce with the user
        });

        // Save the new annonce
        const savedAnnonce = await newAnnonce.save();

        // Update the user's annonces array
        const user = await Inscription.findById(req.session.userId);

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Add the annonce ID to the user's annonces array
        user.annonces.push(savedAnnonce._id);

        // Save the updated user
        await user.save();

        // Log the creation activity (Optional)
        const activity = new Activity({
            userId: req.session.userId,
            description: `Added a new annonce with ID ${newAnnonce._id}`,
        });
        await activity.save();

        // Redirect to the dashboard after successful addition
        res.redirect('/dashboard');
    } catch (err) {
        console.error('Error saving new Annonce:', err);
        res.status(500).send('Error saving new Annonce');
    }
});

router.put('/Edit/:id', uploadPhotosVideos, async (req, res) => {
    try {
        // Find the existing annonce
        const existingAnnonce = await Annonce.findById(req.params.id);
        if (!existingAnnonce) {
            return res.status(404).send('Annonce not found');
        }

        // Initialize the photos/videos array with existing ones
        let photosVideos = existingAnnonce.photosVideos || [];

        // Add new photos/videos if any are uploaded
        if (req.files) {
            req.files.forEach((file) => {
                photosVideos.push(`/photos/${file.filename}`);
            });
        }

        // Prepare update data
        const updateData = {
            titre: req.body.titre,
            Prix: req.body.Prix,
            description: req.body.description,
            surface: req.body.surface,
            nombreDePieces: req.body.nombreDePieces,
            typeDeBien: req.body.typeDeBien,
            adresse: req.body.adresse,
            photosVideos: photosVideos, // Include merged photos/videos
            diagnostics: req.body.diagnostics,
            equipements: req.body.equipements
        };

        // Update the annonce
        const result = await Annonce.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!result) {
            return res.status(404).send('Annonce not found');
        }

        // Log the activity
        const activityDescription = `Updated annonce with ID ${req.params.id}`;
        const activity = new Activity({
            userId: req.session.userId, // Assuming you have user session info
            description: activityDescription
        });
        await activity.save();

        // Redirect to dashboard
        res.redirect('/dashboard');
    } catch (err) {
        console.error('Error updating annonce:', err);
        res.status(500).send('Error updating Annonce');
    }
});

router.post('/Editprofile/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const updateData = {
            Nom: req.body.Nom,
            Prénom: req.body.Prénom,
            Email: req.body.Email,
            Téléphone: req.body.Téléphone,
        };

        // Update user profile
        const result = await Inscription.findByIdAndUpdate(userId, updateData, { new: true });
        if (!result) {
            return res.status(404).send('User not found');
        }

        // Log activity
        const activityDescription = 'Updated profile information';
        const activity = new Activity({
            userId: result._id,
            description: activityDescription
        });
        await activity.save();

        res.redirect('/Profile');
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).send('Error updating profile');
    }
});

/*************************CHANGE PASSWORD******************************/
router.post('/changepassword/:id', async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        const userId = req.params.id;

        if (newPassword !== confirmPassword) {
            return res.status(400).send('New passwords do not match.');
        }

        const user = await Inscription.findById(userId);
        if (!user) {
            return res.status(404).send('User not found.');
        }

        if (user.Password !== oldPassword) {
            return res.status(400).send('Old password is incorrect.');
        }

        // Update password (without hashing)
        user.Password = newPassword;
        await user.save();

        // Fetch categories and other necessary data
        const categories = await Categories.find();
        const userLoggedIn = req.session.user ? true : false;
        const annonces = await Annonce.find(); // Assuming you want to pass this as well

        // Fetch the updated user information
        const updatedUser = await Inscription.findById(userId);
        const activity = new Activity({
            userId: user._id,
            description: 'Changed password'
        });
        await activity.save();
        // Render the Profile view with the required data
        res.render('Profile', { array: updatedUser, categories, userLoggedIn, annonces });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).send('Server error.');
    }
});

router.delete('/Delete/:id', async (req, res) => {
    try {
        const annonceId = req.params.id;
        const userId = req.session.userId; // Ensure that the user is authenticated and their ID is available in the session

        // Find and delete the annonce
        const result = await Annonce.findByIdAndDelete(annonceId);

        if (!result) {
            return res.status(404).send('Annonce not found');
        }

        // Log activity for deletion
        const activity = new Activity({
            userId: new mongoose.Types.ObjectId(userId), // Correct usage of ObjectId
            description: `Deleted annonce with ID ${annonceId}`
        });
        await activity.save();

        res.redirect('/dashboard');
    } catch (err) {
        console.error('Error deleting annonce:', err);
        res.status(500).send('Error deleting Annonce');
    }
});

router.post('/upload-profile-picture', uploadProfilePic.single('profilePicture'), async (req, res) => {
    try {
        const userId = req.session.userId; // Get user ID from session
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await Inscription.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user with the new profile picture URL
        user.profilePicture = '/profilePictures/' + req.file.filename; // Correct path to access in browser
        await user.save();

        // Log activity
        const activityDescription = `Uploaded a new profile picture`;
        const activity = new Activity({
            userId: user._id,
            description: activityDescription
        });
        await activity.save();

        // Send back the new profile picture URL
        res.json({ success: true, profilePictureUrl: user.profilePicture });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


router.delete('/delete-profile-picture', async (req, res) => {
    try {
        const userId = req.session.userId; // Get user ID from session
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await Inscription.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove the profile picture file if it exists
        const filePath = path.join(__dirname, '..', 'public', user.profilePicture);
        fs.unlink(filePath, err => {
            if (err) console.error('Error deleting file:', err);
        });

        // Update user profile picture field
        user.profilePicture = null;
        await user.save();

        // Log activity
        const activityDescription = 'Deleted profile picture';
        const activity = new Activity({
            userId: user._id,
            description: activityDescription
        });
        await activity.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting profile picture:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/********************************ADMIN*****************************/

function formatDate(dateString) {
    // Parse and format the date using Moment.js
    const date = moment(dateString);
    const formattedDate = date.format('ddd MMM DD YYYY'); // e.g., Mon Jul 22 2024
    const formattedTime = date.format('HH:mm'); // e.g., 02:30

    return { formattedDate, formattedTime };
}

router.get('/AdminLogin', (req, res) => {
    res.render('AdminLogin')
})
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Direct password comparison (no hashing)
        if (admin.password !== password) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Fetch data needed for the dashboard
        const totalUsers = await Inscription.countDocuments();
        const totalAnnonces = await Annonce.countDocuments();
        const totalMessages = await Message.countDocuments();
        const totalVisits = await Visit.countDocuments();

        // Fetch statistics for charts
        const visitStats = await getVisitStatistics(); // Ensure this function is defined
        const annonceStats = await getAnnonceStatistics(); // Ensure this function is defined

        const data = await Inscription.find(); // Use your actual query here
        const formattedArray = data.map(item => {
            return {
                _id: item._id,
                Nom: item.Nom,
                Prénom: item.Prénom,
                Email: item.Email,
                Téléphone: item.Téléphone,
                rôle: item.rôle,
                dateDeCréation: item.dateDeCréation
            };
        });

        // Login successful, render dashboardAdmin with data
        res.render('statistics', {
            totalUsers,
            totalAnnonces,
            totalMessages,
            totalVisits,
            visitStats,
            annonceStats,
            array: formattedArray
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/deconnexion', (req, res) => {
    // Destroy the session
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Failed to log out' });
        }
        // Redirect to login page after logout
        res.redirect('/AdminLogin'); // Adjust the path as needed
    });
});

router.get('/dashboardAdmin', async (req, res) => {
    try {
        // Fetch your data here. For example, using a database query.
        const data = await Inscription.find(); // Use your actual query here
        const formattedArray = data.map(item => {
            return {
                _id: item._id,
                Nom: item.Nom,
                Prénom: item.Prénom,
                Email: item.Email,
                Téléphone: item.Téléphone,
                rôle: item.rôle,
                dateDeCréation: item.dateDeCréation
            };
        });

        // Pass the data to the EJS template
        res.render('dashboardAdmin', { array: formattedArray });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});
router.get('/gestionAnnonces', async (req, res) => {
    try {
        // Fetch your data here. For example, using a database query.
        const data = await Annonce.find().populate('userId', 'Nom Prénom');; // Use your actual query here
        const formattedArray = data.map(item => {
            return {
                _id: item._id,
                titre: item.titre,
                Prix: item.Prix,
                surface: item.surface,
                typeDeBien: item.typeDeBien,
                nombreDePieces: item.nombreDePieces,
                UserId: item.userId,
                dateDePublication: item.dateDePublication
            };
        });

        // Pass the data to the EJS template
        res.render('gestionAnnonces', { array: formattedArray });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});


router.get('/detailleUser/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send('Invalid user ID');
        }
        const user = await Inscription.findById(userId);
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.render('detailleUser', { user });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).send('Server error');
    }
});
router.get('/detailleAnnonce/:id', async (req, res) => {
    try {
        const annonceId = req.params.id;
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(annonceId)) {
            return res.status(400).send('Invalid annonce ID');
        }
        const annonce = await Annonce.findById(annonceId).populate('userId', 'Nom Prénom');
        if (!annonce) {
            return res.status(404).send('Annonce not found');
        }

        // Log the annonce object to verify its content
        console.log('Annonce:', annonce);

        res.render('detailleAnnonce', { annonce });
    } catch (err) {
        console.error('Error fetching annonce:', err);
        res.status(500).send('Server error');
    }
});


// GET user details by ID

router.get('/annonces-publiees/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Validate userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send('Invalid User ID');
        }

        // Query annonces based on userId
        const annonces = await Annonce.find({ userId: new mongoose.Types.ObjectId(userId) });

        // Render the view with the fetched annonces
        res.render('annonces-publiees', { annonces });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


// Render form to edit an annonce by ID
router.get('/EditUser/:id', (req, res) => {
    Inscription.findById(req.params.id)
        .then((result) => {
            if (!result) {
                console.log(`Annonce with ID ${req.params.id} not found`);
                return res.status(404).send('Annonce not found');
            }
            res.render('EditUser', { obj: result });
        })
        .catch((err) => {
            console.error('Error fetching annonce for editing:', err);
            res.status(500).send('Server error');
        });
});
router.get('/EditAnnonce/:id', async (req, res) => {
    try {
        // Fetch the announcement to edit
        const annonce = await Annonce.findById(req.params.id);
        if (!annonce) {
            console.log(`Annonce with ID ${req.params.id} not found`);
            return res.status(404).send('Annonce not found');
        }

        // Define or fetch your categories data
        // For example, categories might be fetched from a database or defined statically
        const categories = await Categories.find(); // Fetch all categories with their offerings


        // Render the EJS template with both `annonce` and `categories`
        res.render('EditAnnonce', { obj: annonce, categories: categories });
    } catch (err) {
        console.error('Error fetching annonce for editing:', err);
        res.status(500).send('Server error');
    }
});



// PUT route to update an existing annonce by ID

router.put('/EditUser/:id', async (req, res) => {
    console.log('Request Body:', req.body); // Log the request body
    try {
        const updatedData = {
            Nom: req.body.Nom,
            Prénom: req.body.Prénom,
            Email: req.body.Email,
            Téléphone: req.body.Téléphone,
            rôle: req.body.rôle
        };
        const updatedItem = await Inscription.findByIdAndUpdate(req.params.id, updatedData, { new: true });
        if (updatedItem) {
            console.log('Updated Item:', updatedItem); // Log the updated item
            res.redirect('/dashboardAdmin');
        } else {
            res.status(404).send('Item not found');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});
router.put('/EditAnnonce/:id', async (req, res) => {
    console.log('Request Body:', req.body); // Log the request body
    try {
        const updatedData = {
            titre: req.body.titre,
            Prix: req.body.Prix,
            surface: req.body.surface,
            typeDeBien: req.body.typeDeBien,
            nombreDePieces: req.body.nombreDePieces,
            UserId: req.body.UserId
        };
        const updatedItem = await Annonce.findByIdAndUpdate(req.params.id, updatedData, { new: true });
        if (updatedItem) {
            console.log('Updated Item:', updatedItem); // Log the updated item
            res.redirect('/gestionAnnonces');
        } else {
            res.status(404).send('Item not found');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});
// DELETE route to delete an annonce by ID
router.delete('/deleteUser/:id', (req, res) => {
    Inscription.findByIdAndDelete(req.params.id)
        .then(() => {
            res.redirect('/dashboardAdmin');
        })
        .catch((err) => {
            console.log(err);
            res.status(500).send('Error deleting account');
        });
});
router.delete('/deleteAnnonce/:id', (req, res) => {
    Annonce.findByIdAndDelete(req.params.id)
        .then(() => {
            res.redirect('/gestionAnnonces');
        })
        .catch((err) => {
            console.log(err);
            res.status(500).send('Error deleting account');
        });
});

router.get('/messages-envoyes/:userId', async (req, res) => {
    const userId = req.params.userId;

    console.log('Fetching messages for user:', userId);

    try {
        // Find all messages where the sender is the specified user
        const messages = await Message.find({ senderId: userId }).populate('recipientId', 'Nom Prénom Email');

        console.log('Messages found:', messages);

        // Render the messages in a view (e.g., messagesEnvoyes.ejs)
        res.render('messagesEnvoyes', { messages, userId });
    } catch (err) {
        console.error('Error fetching sent messages:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Function to log viewing an annonce
function logViewAnnonce(userId, annonceId) {
    const description = `Viewed annonce with ID ${annonceId}`;
    const activity = new Activity({ userId, description });
    activity.save(err => {
        if (err) console.error('Error logging activity:', err);
    });
}

async function logAddToFavorites(userId, annonceId) {
    try {
        console.log('Logging activity for user:', userId, 'annonce:', annonceId);
        const activity = new Activity({
            userId: new mongoose.Types.ObjectId(userId), // Use 'new' keyword here
            description: `Added annonce with ID ${annonceId} to favorites`
        });
        await activity.save();
        console.log('Activity logged successfully');
    } catch (err) {
        console.error('Error logging activity:', err);
    }
}



function logUserLogin(userId) {
    const description = 'User logged in';
    const activity = new Activity({ userId, description });
    activity.save(err => {
        if (err) console.error('Error logging activity:', err);
    });
}

function logSendMessage(userId, messageId) {
    const description = `Sent a message with ID ${messageId}`;
    const activity = new Activity({ userId, description });
    activity.save(err => {
        if (err) console.error('Error logging activity:', err);
    });
}

function logVisitProfile(userId, visitedUserId) {
    const description = `Visited profile of user with ID ${visitedUserId}`;
    const activity = new Activity({ userId, description });
    activity.save(err => {
        if (err) console.error('Error logging activity:', err);
    });
}

router.get('/historique/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        console.log('Fetching activities for user:', userId);

        // Convert userId to ObjectId correctly
        const userIdObjectId = new mongoose.Types.ObjectId(userId);

        const activities = await Activity.find({ userId: userIdObjectId }).sort({ timestamp: -1 }).exec();
        console.log('Fetched activities:', activities);

        res.render('activityHistory', { activities });
    } catch (err) {
        console.error('Error fetching activities:', err);
        res.status(500).send('Internal Server Error');
    }
});


/*****************************PROFILE**********************************/
router.get('/profile/:userId', async (req, res) => {
    try {
        // Fetch the user
        const user = await Inscription.findById(req.params.userId);
        const userId = req.session.userId || null;
        const categories = await Categories.find();
        const userLoggedIn = req.session.user ? true : false;

        console.log('user', user)
        // Check if the user exists
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Fetch the annonces of the user
        const annonces = await Annonce.find({ _id: { $in: user.annonces } });

        // Render the profile page with user and annonces data
        res.render('profilee', { user, annonces, categories, userLoggedIn });
    } catch (error) {
        console.error('Error fetching user or annonces:', error);
        res.status(500).send('Server error');
    }
});


// Search Route
router.post('/search', async (req, res) => {
    try {
        // Fetch input data
        const searchTerm = req.body.search || '';
        const filters = {
            typeDeBien: req.body.propertyType || '',
            adresse: req.body.location || '',
            minPrix: req.body.minPrice ? parseFloat(req.body.minPrice) : null,
            maxPrix: req.body.maxPrice ? parseFloat(req.body.maxPrice) : null,
            minSurface: req.body.minSurface ? parseFloat(req.body.minSurface) : null,
            maxSurface: req.body.maxSurface ? parseFloat(req.body.maxSurface) : null,
            nombreDePieces: req.body.rooms ? parseInt(req.body.rooms) : null,
            transactionType: req.body.transactionType || '' // Assuming transactionType is used but not part of schema
        };

        console.log('Search Term:', searchTerm);
        console.log('Filters:', filters);

        // Build MongoDB query
        let query = {};

        // Add search term conditions
        if (searchTerm) {
            query.$or = [
                { titre: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { typeDeBien: { $regex: searchTerm, $options: 'i' } },
            ];
        }

        // Add filters
        if (filters.typeDeBien) {
            query.typeDeBien = { $regex: filters.typeDeBien, $options: 'i' };
        }
        if (filters.adresse) {
            query.adresse = { $regex: filters.adresse, $options: 'i' };
        }
        if (filters.minPrix !== null || filters.maxPrix !== null) {
            query.Prix = {};
            if (filters.minPrix !== null) query.Prix.$gte = filters.minPrix;
            if (filters.maxPrix !== null) query.Prix.$lte = filters.maxPrix;
        }
        if (filters.minSurface !== null || filters.maxSurface !== null) {
            query.surface = {};
            if (filters.minSurface !== null) query.surface.$gte = filters.minSurface;
            if (filters.maxSurface !== null) query.surface.$lte = filters.maxSurface;
        }
        if (filters.nombreDePieces !== null) {
            query.nombreDePieces = { $gte: filters.nombreDePieces };
        }
        if (filters.transactionType) {
            // If transactionType is used in the model, add it here
            query.transactionType = { $regex: filters.transactionType, $options: 'i' };
        }

        console.log('MongoDB Query:', JSON.stringify(query, null, 2));

        // Execute query
        const filteredAnnonces = await Annonce.find(query).exec();
        console.log('Filtered Annonces:', filteredAnnonces);

        // Fetch categories
        const categories = await Categories.find();
        const userLoggedIn = req.session.user ? true : false;
        const userId = req.session.userId || null;

        // Render search results
        res.render('searchResults', {
            annonces: filteredAnnonces,
            categories,
            userLoggedIn,
            userId,
            searchTerm,
            filters, // Pass filters to maintain state in the form
        });
        } catch (error) {
        console.error('Error during search:', error);
        res.status(500).send('Server Error');
    }
});


router.get('/offerings/:offering', async (req, res) => {
    try {
        const offering = req.params.offering;
        console.log('Offering:', offering);

        // Fetch all annonces for debugging
        const allAnnonces = await Annonce.find({}).exec();
        console.log('All annonces:', allAnnonces);

        // Find annonces with typeDeBien matching the offering
        let annonces = await Annonce.find({ typeDeBien: offering }).exec();
        console.log('Query result:', annonces);

        // Exclude user's own annonces if logged in
        const userLoggedIn = req.session.user ? true : false;
        const userId = req.session.userId || null;

        if (userLoggedIn) {
            annonces = annonces.filter(annonce => annonce.userId.toString() !== userId.toString());
        }

        // Fetch all categories
        const categories = await Categories.find();
        console.log('Categories:', categories);

        // Render the offerings page
        res.render('offerings', { annonces, categories, userLoggedIn, userId });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/log-visit', async (req, res) => {
    const { annonceId } = req.body; // Extract annonceId from the request body
    console.log('Received request to log visit with annonceId:', annonceId); // Log the received annonceId

    if (!annonceId) {
        console.error('Annonce ID is missing in the request');
        return res.status(400).json({ message: 'Annonce ID is required' }); // Return error if annonceId is missing
    }

    try {
        // Correctly instantiate ObjectId using 'new'
        const newVisit = new Visit({
            annonceId: new mongoose.Types.ObjectId(annonceId), // Use 'new' to create ObjectId
            date: new Date()
        });

        await newVisit.save(); // Save the new visit to the database
        console.log('Visit logged successfully in the database');

        res.status(201).json({ success: true, message: 'Visit logged successfully' }); // Return success response
    } catch (error) {
        console.error('Error saving visit to database:', error); // Log any errors during saving
        res.status(500).json({ message: 'Internal server error' }); // Return server error response
    }
});
async function getVisitStatistics() {
    // Replace this with your actual data fetching logic
    // Example: fetching visit statistics from a database
    const visits = await Visit.aggregate([
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]);

    // Prepare data for the chart
    const labels = visits.map(v => v._id);
    const data = visits.map(v => v.count);

    return { labels, data };
}
async function getAnnonceStatistics() {
    const annonces = await Annonce.aggregate([
        {
            $group: {
                _id: {
                    year: { $year: "$dateDePublication" },
                    month: { $month: "$dateDePublication" }
                },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1 }
        }
    ]);

    // Map numerical month values to month names
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Prepare data for the chart
    const labels = annonces.map(a => {
        const year = a._id.year;
        const month = a._id.month - 1; // Convert to 0-based index
        const monthName = monthNames[month] || 'Unknown Month';
        return `${monthName} ${year}`;
    });
    const data = annonces.map(a => a.count);

    console.log('Processed Annonce Data:', { labels, data });

    return { labels, data };
}


const getActiveUsersCount = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log('Date 30 Days Ago:', thirtyDaysAgo);

    try {
        const activeUsers = await Inscription.find({
            lastLogin: { $gte: thirtyDaysAgo }
        });

        console.log('Active Users List:', activeUsers);
        console.log('Active Users Count:', activeUsers.length);

        return activeUsers.length;
    } catch (err) {
        console.error('Error fetching active users:', err);
        throw err;
    }
};

// Example function to get visit statistics (Replace with actual implementation)



// Route to get statistics
router.get('/statistics', async (req, res) => {
    try {
        // Fetch global statistics
        const totalUsers = await Inscription.countDocuments();
        const totalAnnonces = await Annonce.countDocuments();
        const totalMessages = await Message.countDocuments();
        const totalVisits = await Visit.countDocuments();

        // Fetch active users count
        const activeUsersCount = await getActiveUsersCount();

        // Fetch statistics for charts
        const visitStats = await getVisitStatistics();
        const annonceStats = await getAnnonceStatistics();

        // Debug log
        console.log('Total Users:', totalUsers);
        console.log('Total Annonces:', totalAnnonces);
        console.log('Total Messages:', totalMessages);
        console.log('Active Users Count:', activeUsersCount);

        // Render the statistics page with data
        res.render('statistics', {
            totalUsers,
            totalAnnonces,
            totalMessages,
            activeUsersCount,
            visitStats,
            annonceStats,
            totalVisits
        });
    } catch (err) {
        console.error("Error fetching statistics:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/search_Users', async (req, res) => {
    try {
        const query = req.query.query; // Get the search query from the URL
        let users = [];

        if (query) {
            // Search by title, first name, or last name
            users = await Inscription.find({
                $or: [
                    { Nom: { $regex: query, $options: 'i' } },   // Search by first name
                    { Prénom: { $regex: query, $options: 'i' } } // Search by last name
                ]
            });
        } else {
            // If no query, return all users
            users = await Inscription.find();
        }

        // Render the page with search results
        res.render('dashboardAdminResult', { array: users });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});
router.get('/searchAnnonce', async (req, res) => {
    try {
        const query = req.query.query; // Get the search query from the URL
        let Annonces = [];

        if (query) {
            // Search by title, first name, or last name
            Annonces = await Annonce.find({
                $or: [
                    { titre: { $regex: query, $options: 'i' } },   // Search by first name
                    { typeDeBien: { $regex: query, $options: 'i' } } // Search by last name
                ]
            });
        } else {
            // If no query, return all users
            Annonces = await Annonce.find();
        }

        // Render the page with search results
        res.render('dashboardAnnonceResult', { array: Annonces });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});
router.get('/search_Annonce', async (req, res) => {
    try {
        const query = req.query.query; // Get the search query from the URL
        const userId = req.session.userId;   // Get the logged-in user's ID
        let Annonces = [];
        console.log('hhhhhhh:',userId)

        if (query) {
            // Search by title or type of property for the logged-in user's annonces
            Annonces = await Annonce.find({
                userId: userId, // Filter by the logged-in user's ID
                $or: [
                    { titre: { $regex: query, $options: 'i' } },   // Search by title
                    { typeDeBien: { $regex: query, $options: 'i' } } // Search by type of property
                ]
            });
        } else {
            // If no query, return all annonces for the logged-in user
            Annonces = await Annonce.find({ userId: userId });
        }

        // Render the page with search results
        res.render('resultannonces', { array: Annonces });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});
module.exports = router;
