const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');
const path = require('path');
const userRoutes = require('./routes/user');


dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/api/users', userRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  })
  .catch(err => console.error(err));
