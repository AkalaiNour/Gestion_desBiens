const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const client = require('./routes/client');
const http = require('http');
const socketIo = require('socket.io');

// Models
const Inscription = require('./models/inscription');

const app = express();
const port = 4000;

// Middleware
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
const server = http.createServer(app);
const io = socketIo(server);

app.use(session({
    secret: 'your_secret_key', // Replace with a strong secret key
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/Gestion_desBiens' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Debugging session middleware
app.use((req, res, next) => {
    console.log('Session:', req.session);
    next();
});


// Livereload setup
const livereloadServer = livereload.createServer();
livereloadServer.watch(path.join(__dirname, 'public'));
app.use(connectLivereload());
livereloadServer.server.once("connection", () => {
    setTimeout(() => {
        livereloadServer.refresh("/");
    }, 100);
});



io.on('connection', (socket) => {
    console.log('New client connected');
  
    // Listen for messages being sent
    socket.on('sendMessage', async (data) => {
      const { message, senderId, recipientId } = data;
  
      const newMessage = new Message({
        senderId: mongoose.Types.ObjectId(senderId),
        recipientId: mongoose.Types.ObjectId(recipientId),
        content: message,
      });
  
      await newMessage.save();
  
      // Emit the new message event to the recipient
      io.to(recipientId).emit('newMessage', newMessage);
    });
  
    // Mark message as seen when the recipient views them
    socket.on('markAsSeen', async ({ messageId, recipientId }) => {
      await Message.findByIdAndUpdate(messageId, { seen: true });
      io.to(recipientId).emit('messageSeen', messageId);
    });
    socket.on('newNotification', (notification) => {
      io.to(notification.userId).emit('newNotification', notification);
   });
  
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });



// Routes
app.use(client);

// Connect to MongoDB and start the server
// Connect to MongoDB and start the server
mongoose.connect('mongodb://localhost:27017/Gestion_desBiens', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
  // Start the server only after successful connection
  server.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
  });
})
.catch((err) => {
  console.error('Database connection error:', err);
});
