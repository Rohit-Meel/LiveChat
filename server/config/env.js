require('dotenv').config();

const PORT = Number(process.env.PORT) || 8000;

const MONGO_URI =
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/livechat';

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    'development-secret-change-me';

module.exports = {
    PORT,
    MONGO_URI,
    SESSION_SECRET
};