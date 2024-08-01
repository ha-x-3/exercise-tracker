const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// Import models
const User = require('./models/user');
const Exercise = require('./models/exercise');

// Connect to MongoDB
mongoose.set('useUnifiedTopology', true);
mongoose.set('useCreateIndex', true);
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true })
  .then(() => console.log("MongoDB is connected..."))
  .catch((err) => console.log(err));

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.static('public'));

// Routes
// Home
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// POST /api/users
app.post('/api/users', async (req, res, next) => {
  try {
    const user = new User({ username: req.body.username });
    const savedUser = await user.save();
    res.json({
      username: savedUser.username,
      _id: savedUser._id
    });
  } catch (err) {
    if (err.code === 11000) {
      return next({
        status: 400,
        message: 'Username already taken'
      });
    }
    next(err);
  }
});

// POST /api/users/:_id/exercises
app.post('/api/users/:_id/exercises', async (req, res, next) => {
  try {
    const user = await User.findById(req.params._id);
    if (!user) {
      return next({
        status: 400,
        message: 'Unknown userId'
      });
    }
    
    const exercise = new Exercise({
      userId: user._id,
      username: user.username,
      description: req.body.description,
      duration: Number(req.body.duration),
      date: req.body.date ? new Date(req.body.date) : new Date()
    });
    
    const savedExercise = await exercise.save();
    
    res.json({
      username: user.username,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString(),
      _id: user._id
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:_id/logs
app.get('/api/users/:_id/logs', async (req, res, next) => {
  try {
    const user = await User.findById(req.params._id);
    if (!user) {
      return next({
        status: 400,
        message: 'Unknown userId'
      });
    }
    
    let dateFilter = {};
    if (req.query.from) {
      dateFilter.$gte = new Date(req.query.from);
    }
    if (req.query.to) {
      dateFilter.$lte = new Date(req.query.to);
    }
    
    let limit = req.query.limit ? Number(req.query.limit) : undefined;
    
    let exercises = await Exercise.find({
      userId: user._id,
      ...(Object.keys(dateFilter).length && { date: dateFilter })
    }).limit(limit).select('-_id description duration date');
    
    exercises = exercises.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString()
    }));
    
    res.json({
      username: user.username,
      count: exercises.length,
      _id: user._id,
      log: exercises
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users
app.get('/api/users', async (req, res, next) => {
  try {
    const users = await User.find({}).select('username _id');
    
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'});
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode = err.status || 500;
  let errMessage = err.message || 'Internal Server Error';
  res.status(errCode).type('txt').send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
