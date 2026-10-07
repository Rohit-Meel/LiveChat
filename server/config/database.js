const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

async function connectDatabase() {

    try {

        await mongoose.connect(MONGO_URI);

        console.log('MongoDB connected successfully');

        console.log(
            `Database: ${mongoose.connection.name}`
        );

    } catch (error) {

        console.error(
            'MongoDB connection failed:',
            error.message
        );

        process.exit(1);
    }
}

module.exports = connectDatabase;