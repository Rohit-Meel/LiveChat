const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

const {
    getOrCreateConversation,
    getConversationMessages,
    getUnreadCounts: getUnreadCountsService,
    markConversationRead: markConversationReadService
} = require('../services/chat.service');

const {
    getBlockStatus
} = require('../services/block.service');

async function openConversation(req, res) {
    try {
        const currentUserId =
            req.user._id.toString();

        const otherUserId =
            req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        if (currentUserId === otherUserId) {
            return res.status(400).json({
                success: false,
                message: 'You cannot chat with yourself'
            });
        }

        const otherUser = await User.findById(otherUserId)
            .select('_id name username profileImage bio isOnline lastSeen');

        if (!otherUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const blockStatus = await getBlockStatus(
            currentUserId,
            otherUserId
        );

        const conversation = await getOrCreateConversation(
            currentUserId,
            otherUserId
        );

        const messages = await getConversationMessages(
            conversation._id,
            currentUserId
        );

        return res.status(200).json({
            success: true,
            conversation: {
                _id: conversation._id,
                participant: otherUser
            },
            blockStatus,
            messages: messages || []
        });
    }
    catch (error) {
        console.error('Open conversation error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to open conversation'
        });
    }
}

async function getUnreadCounts(req, res) {
    try {
        const unreadCounts =
            await getUnreadCountsService(
                req.user._id
            );

        return res.status(200).json({
            success: true,
            unreadCounts
        });
    }
    catch (error) {
        console.error('Get unread counts error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to load unread counts'
        });
    }
}

async function markConversationRead(req, res) {
    try {
        const conversationId =
            req.params.conversationId;

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid conversation ID'
            });
        }

        const conversation =
            await Conversation.findOne({
                _id: conversationId,
                participants: req.user._id
            });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        await markConversationReadService(
            conversationId,
            req.user._id
        );

        return res.status(200).json({
            success: true,
            message: 'Conversation marked as read'
        });
    }
    catch (error) {
        console.error('Mark conversation read error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to mark conversation as read'
        });
    }
}

module.exports = {
    openConversation,
    getUnreadCounts,
    markConversationRead
};
