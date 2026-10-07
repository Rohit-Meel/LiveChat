const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

async function getOrCreateConversation(userId, otherUserId) {
    let conversation = await Conversation.findOne({
        participants: { $all: [userId, otherUserId] }
    });

    if (!conversation) {
        conversation = await Conversation.create({
            participants: [userId, otherUserId]
        });
    }

    return conversation;
}

async function createMessage({
    conversationId,
    senderId,
    receiverId,
    message,
    replyTo = null
}) {
    const data = {
        conversation: conversationId,
        sender: senderId,
        receiver: receiverId,
        message: message.trim(),
        messageType: 'text'
    };

    if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
        data.replyTo = replyTo;
    }

    const newMessage = await Message.create(data);

    await Conversation.findByIdAndUpdate(
        conversationId,
        {
            lastMessage: newMessage._id,
            lastMessageAt: newMessage.createdAt
        }
    );

    return newMessage;
}

async function getConversationMessages(conversationId, userId) {
    const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
    });

    if (!conversation) return null;

    return Message.find({
        conversation: conversationId,
        deletedFor: { $ne: userId }
    })
        .populate('sender', 'name username profileImage bio isOnline lastSeen')
        .populate('receiver', 'name username profileImage bio isOnline lastSeen')
        .populate('replyTo', 'message sender createdAt isDeletedForEveryone')
        .sort({ createdAt: 1 });
}

async function getUnreadCounts(userId) {
    const objectUserId = new mongoose.Types.ObjectId(userId);

    const rows = await Message.aggregate([
        {
            $match: {
                receiver: objectUserId,
                isRead: false,
                isDeletedForEveryone: false,
                deletedFor: { $ne: objectUserId }
            }
        },
        {
            $group: {
                _id: '$sender',
                count: { $sum: 1 }
            }
        }
    ]);

    return rows.map(row => ({
        userId: row._id.toString(),
        count: row.count
    }));
}

async function markConversationRead(conversationId, userId) {
    const unread = await Message.find({
        conversation: conversationId,
        receiver: userId,
        isRead: false,
        isDeletedForEveryone: false,
        deletedFor: { $ne: userId }
    }).select('_id sender');

    if (!unread.length) return [];

    const readAt = new Date();

    await Message.updateMany(
        { _id: { $in: unread.map(item => item._id) } },
        { $set: { isRead: true, readAt } }
    );

    return unread.map(item => ({
        _id: item._id,
        sender: item.sender,
        readAt
    }));
}

async function deleteMessageForMe(messageId, userId) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return { success: false, reason: 'not_found' };
    }

    const message = await Message.findById(messageId);
    if (!message) return { success: false, reason: 'not_found' };

    const participant =
        message.sender.toString() === String(userId) ||
        message.receiver.toString() === String(userId);

    if (!participant) return { success: false, reason: 'not_participant' };

    await Message.updateOne(
        { _id: messageId },
        { $addToSet: { deletedFor: userId } }
    );

    return {
        success: true,
        message: await Message.findById(messageId)
    };
}

async function deleteMessageForEveryone(messageId, userId) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return { success: false, reason: 'not_found' };
    }

    const message = await Message.findById(messageId);
    if (!message) return { success: false, reason: 'not_found' };

    if (message.sender.toString() !== String(userId)) {
        return { success: false, reason: 'not_sender' };
    }

    if (!message.isDeletedForEveryone) {
        await Message.updateOne(
            { _id: messageId },
            {
                $set: {
                    isDeletedForEveryone: true,
                    deletedAt: new Date()
                }
            }
        );
    }

    return {
        success: true,
        message: await Message.findById(messageId)
    };
}

async function editMessage(messageId, userId, newMessage) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return { success: false, reason: 'not_found' };
    }

    const cleanMessage =
        typeof newMessage === 'string' ? newMessage.trim() : '';

    if (!cleanMessage || cleanMessage.length > 500) {
        return { success: false, reason: 'invalid_message' };
    }

    const message = await Message.findById(messageId);
    if (!message) return { success: false, reason: 'not_found' };

    if (message.sender.toString() !== String(userId)) {
        return { success: false, reason: 'not_sender' };
    }

    if (message.isDeletedForEveryone) {
        return { success: false, reason: 'deleted_message' };
    }

    await Message.updateOne(
        { _id: messageId },
        {
            $set: {
                message: cleanMessage,
                isEdited: true,
                editedAt: new Date()
            }
        }
    );

    return {
        success: true,
        message: await Message.findById(messageId)
    };
}

async function addReaction(messageId, userId, emoji) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return { success: false };
    }

    const message = await Message.findById(messageId);
    if (!message) return { success: false };

    const participant =
        message.sender.toString() === String(userId) ||
        message.receiver.toString() === String(userId);

    if (!participant || message.isDeletedForEveryone) {
        return { success: false };
    }

    const reactions = message.reactions || {};
    const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
    const index = users.findIndex(id => String(id) === String(userId));

    if (index >= 0) users.splice(index, 1);
    else users.push(userId);

    if (users.length) reactions[emoji] = users;
    else delete reactions[emoji];

    message.reactions = reactions;
    await message.save();

    return { success: true, message };
}

async function removeReaction(messageId, userId, emoji) {
    return addReaction(messageId, userId, emoji);
}

module.exports = {
    getOrCreateConversation,
    createMessage,
    getConversationMessages,
    getUnreadCounts,
    markConversationRead,
    deleteMessageForMe,
    deleteMessageForEveryone,
    editMessage,
    addReaction,
    removeReaction
};
