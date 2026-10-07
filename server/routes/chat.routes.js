const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');

const {
    openConversation,
    getUnreadCounts,
    markConversationRead
} = require('../controllers/chat.controller');

const router = express.Router();

router.get(
    '/unread',
    requireAuth,
    getUnreadCounts
);

router.post(
    '/conversation/:conversationId/read',
    requireAuth,
    markConversationRead
);

router.get(
    '/conversation/:userId',
    requireAuth,
    openConversation
);

module.exports = router;
