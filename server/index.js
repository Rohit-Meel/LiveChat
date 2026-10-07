require('dotenv').config();

const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const User = require('./models/User');
const Session = require('./models/Session');
const Message = require('./models/Message');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const chatRoutes = require('./routes/chat.routes');
const blockRoutes = require('./routes/block.routes');
const { PORT, MONGO_URI } = require('./config/env');

const {
    getOrCreateConversation,
    createMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    editMessage,
    addReaction,
    removeReaction,
    markConversationRead
} = require('./services/chat.service');

const { isBlocked } = require('./services/block.service');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const clientPath = path.join(__dirname, '../client');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(clientPath, { index: false }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/blocks', blockRoutes);

app.get('/health', (req, res) => {
    res.json({ success: true, message: 'LiveChat server is running' });
});

function getCookie(cookieHeader, name) {
    if (!cookieHeader) return null;

    for (const item of cookieHeader.split(';')) {
        const [key, ...parts] = item.trim().split('=');

        if (key === name) {
            return decodeURIComponent(parts.join('='));
        }
    }

    return null;
}

async function getSessionFromRequest(req) {
    const token = getCookie(req.headers.cookie, 'session_token');

    if (!token) return null;

    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    return Session.findOne({
        tokenHash,
        expiresAt: { $gt: new Date() }
    });
}

async function protectChatPage(req, res) {
    try {
        const session = await getSessionFromRequest(req);

        if (!session) {
            return res.redirect('/login.html');
        }

        return res.sendFile(
            path.join(clientPath, 'index.html')
        );
    } catch (error) {
        console.error('Page auth error:', error);
        return res.redirect('/login.html');
    }
}

app.get('/', protectChatPage);
app.get('/index.html', protectChatPage);

io.use(async (socket, next) => {
    try {
        const token = getCookie(
            socket.handshake.headers.cookie,
            'session_token'
        );

        if (!token) {
            return next(new Error('Unauthorized'));
        }

        const tokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const session = await Session.findOne({
            tokenHash,
            expiresAt: { $gt: new Date() }
        });

        if (!session) {
            return next(new Error('Unauthorized'));
        }

        const user = await User.findById(session.user)
            .select(
                '_id name username email profileImage bio isOnline lastSeen'
            );

        if (!user) {
            return next(new Error('User not found'));
        }

        socket.user = user;
        socket.userId = user._id.toString();

        next();
    } catch (error) {
        console.error('Socket auth error:', error);
        next(new Error('Unauthorized'));
    }
});

const connectedUsers = new Map();
const groupMessages = new Map();

function socketsForUser(userId) {
    return [...connectedUsers.entries()]
        .filter(([, id]) => id === String(userId))
        .map(([socketId]) => socketId);
}

/* ===== NEW: Mark undelivered messages as delivered when user comes online ===== */

async function markUndeliveredMessagesForUser(receiverId) {
    try {
        const undelivered = await Message.find({
            receiver: receiverId,
            deliveredAt: null,
            isDeletedForEveryone: false
        }).select('_id sender');

        if (!undelivered.length) return;

        const now = new Date();

        await Message.updateMany(
            {
                _id: { $in: undelivered.map(m => m._id) }
            },
            {
                $set: { deliveredAt: now }
            }
        );

        // Group by sender so we can notify each sender once per message
        const senderMap = new Map();

        undelivered.forEach(msg => {
            const senderId = String(msg.sender);
            if (!senderMap.has(senderId)) {
                senderMap.set(senderId, []);
            }
            senderMap.get(senderId).push(String(msg._id));
        });

        senderMap.forEach((messageIds, senderId) => {
            const senderSockets = socketsForUser(senderId);
            senderSockets.forEach(socketId => {
                messageIds.forEach(messageId => {
                    io.to(socketId).emit('message-delivery', {
                        messageId,
                        deliveredAt: now
                    });
                });
            });
        });
    } catch (error) {
        console.error('Mark undelivered error:', error);
    }
}

function groupPayload(groupMessage, viewerId) {
    const reactions = {};

    for (const [emoji, ids] of groupMessage.reactions.entries()) {
        reactions[emoji] = [...ids];
    }

    return {
        _id: groupMessage.id,
        message: groupMessage.message,
        senderId: groupMessage.senderId,
        senderName: groupMessage.senderName,
        senderUsername: groupMessage.senderUsername,
        isEdited: groupMessage.isEdited,
        editedAt: groupMessage.editedAt,
        deletedForEveryone: groupMessage.deletedForEveryone,
        createdAt: groupMessage.createdAt,
        replyTo: groupMessage.replyTo || null,
        reactions,
        viewerId: String(viewerId)
    };
}

function privatePayload(message) {
    return {
        _id: message._id,
        conversationId: message.conversation,
        senderId: message.sender,
        receiverId: message.receiver,
        message: message.message,
        messageType: message.messageType,
        isRead: message.isRead,
        readAt: message.readAt,
        deliveredAt: message.deliveredAt,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
        isDeletedForEveryone: message.isDeletedForEveryone,
        createdAt: message.createdAt,
        replyTo: message.replyTo || null,
        reactions: message.reactions || {}
    };
}

io.on('connection', async socket => {
    const user = socket.user;

    const alreadyConnected =
        socketsForUser(socket.userId).length > 0;

    connectedUsers.set(
        socket.id,
        socket.userId
    );

    await User.findByIdAndUpdate(user._id, {
        isOnline: true,
        lastSeen: null
    });

    io.emit('user-online', {
        userId: socket.userId,
        name: user.name,
        username: user.username,
        isOnline: true,
        lastSeen: null
    });

    /* ===== NEW: Jab user online aaye, uske saare undelivered messages ko delivered mark karo ===== */

    await markUndeliveredMessagesForUser(socket.userId);

    if (!alreadyConnected) {
        socket.broadcast.emit('user-joined', {
            userId: socket.userId,
            name: user.name,
            username: user.username
        });
    }

    socket.on('send', data => {
        const message =
            typeof data === 'string'
                ? data.trim()
                : (
                    typeof data?.message === 'string'
                        ? data.message.trim()
                        : ''
                );

        if (!message || message.length > 500) {
            return;
        }

        const id = `group_${crypto.randomUUID()}`;

        const groupMessage = {
            id,
            message,
            senderId: socket.userId,
            senderName: user.name,
            senderUsername: user.username,
            createdAt: new Date(),
            isEdited: false,
            editedAt: null,
            deletedForEveryone: false,
            deletedFor: new Set(),
            replyTo: null,
            reactions: new Map()
        };

        if (data && typeof data === 'object') {
            groupMessage.replyTo = data.replyTo || null;
        }

        groupMessages.set(id, groupMessage);

        io.emit(
            'receive',
            groupPayload(
                groupMessage,
                socket.userId
            )
        );
    });

    socket.on('group-typing', isTyping => {
        socket.broadcast.emit('group-typing', {
            userId: socket.userId,
            name: user.name,
            isTyping: Boolean(isTyping)
        });
    });

    socket.on('group-reaction', data => {
        const item = groupMessages.get(
            data?.messageId
        );

        if (!item || item.deletedForEveryone) {
            return;
        }

        const emoji = String(
            data?.emoji || ''
        ).trim();

        if (!emoji || emoji.length > 8) {
            return;
        }

        if (!item.reactions.has(emoji)) {
            item.reactions.set(
                emoji,
                new Set()
            );
        }

        const users = item.reactions.get(emoji);

        if (users.has(socket.userId)) {
            users.delete(socket.userId);
        } else {
            users.add(socket.userId);
        }

        io.emit('message-reaction', {
            messageId: item.id,
            reactions: Object.fromEntries(
                [...item.reactions.entries()].map(
                    ([key, set]) => [
                        key,
                        [...set]
                    ]
                )
            )
        });
    });

    socket.on('private-message', async data => {
        try {
            const receiverId = String(
                data?.receiverId || ''
            );

            const message =
                typeof data?.message === 'string'
                    ? data.message.trim()
                    : '';

            if (
                !mongoose.Types.ObjectId.isValid(receiverId) ||
                !message ||
                message.length > 500
            ) {
                return;
            }

            if (receiverId === socket.userId) {
                return;
            }

            if (
                await isBlocked(
                    socket.userId,
                    receiverId
                ) ||
                await isBlocked(
                    receiverId,
                    socket.userId
                )
            ) {
                socket.emit(
                    'private-message-error',
                    {
                        message:
                            'You cannot send messages to this user'
                    }
                );

                return;
            }

            const receiver = await User.findById(
                receiverId
            ).select(
                '_id name username profileImage isOnline lastSeen'
            );

            if (!receiver) {
                socket.emit(
                    'private-message-error',
                    {
                        message: 'User not found'
                    }
                );

                return;
            }

            const conversation =
                await getOrCreateConversation(
                    socket.userId,
                    receiverId
                );

            const created =
                await createMessage({
                    conversationId:
                        conversation._id,
                    senderId:
                        socket.userId,
                    receiverId,
                    message,
                    replyTo:
                        data?.replyTo || null
                });

            if (created.replyTo) {
                await created.populate({
                    path: 'replyTo',
                    select:
                        'message sender createdAt isDeletedForEveryone',
                    populate: {
                        path: 'sender',
                        select:
                            'name username'
                    }
                });
            }

            const payload =
                privatePayload(created);

            socket.emit(
                'private-message-sent',
                payload
            );

            const receiverSocketIds =
                socketsForUser(receiverId);

            if (receiverSocketIds.length) {
                const deliveredAt = new Date();

                await Message.findByIdAndUpdate(
                    created._id,
                    {
                        deliveredAt
                    }
                );

                payload.deliveredAt = deliveredAt;

                receiverSocketIds.forEach(
                    socketId => {
                        io.to(socketId).emit(
                            'private-message',
                            {
                                ...payload,
                                senderName:
                                    user.name,
                                senderUsername:
                                    user.username
                            }
                        );
                    }
                );

                socket.emit(
                    'message-delivery',
                    {
                        messageId:
                            String(created._id),
                        deliveredAt
                    }
                );
            }

            const unreadCount =
                await Message.countDocuments({
                    receiver: receiverId,
                    sender: socket.userId,
                    isRead: false,
                    isDeletedForEveryone: false,
                    deletedFor: {
                        $ne: receiverId
                    }
                });

            receiverSocketIds.forEach(
                socketId => {
                    io.to(socketId).emit(
                        'private-message-notification',
                        {
                            senderId:
                                socket.userId,
                            senderName:
                                user.name,
                            senderUsername:
                                user.username,
                            message,
                            unreadCount
                        }
                    );
                }
            );
        } catch (error) {
            console.error(
                'Private message error:',
                error
            );

            socket.emit(
                'private-message-error',
                {
                    message:
                        'Unable to send message'
                }
            );
        }
    });

    socket.on('private-typing', data => {
        const receiverId = String(
            data?.receiverId || ''
        );

        if (
            !mongoose.Types.ObjectId.isValid(
                receiverId
            )
        ) {
            return;
        }

        socketsForUser(receiverId).forEach(
            socketId => {
                io.to(socketId).emit(
                    'private-typing',
                    {
                        senderId:
                            socket.userId,
                        senderName:
                            user.name,
                        isTyping:
                            Boolean(
                                data?.isTyping
                            )
                    }
                );
            }
        );
    });

    socket.on('private-reaction', async data => {
        try {
            const messageId =
                data?.messageId;

            const emoji = String(
                data?.emoji || ''
            ).trim();

            if (
                !mongoose.Types.ObjectId.isValid(
                    messageId
                ) ||
                !emoji ||
                emoji.length > 8
            ) {
                return;
            }

            const result =
                await addReaction(
                    messageId,
                    socket.userId,
                    emoji
                );

            if (!result.success) {
                return;
            }

            const message =
                result.message;

            const payload = {
                messageId:
                    String(message._id),
                reactions:
                    message.reactions || {}
            };

            socketsForUser(
                message.sender
            ).forEach(id =>
                io.to(id).emit(
                    'message-reaction',
                    payload
                )
            );

            socketsForUser(
                message.receiver
            ).forEach(id =>
                io.to(id).emit(
                    'message-reaction',
                    payload
                )
            );
        } catch (error) {
            console.error(
                'Reaction error:',
                error
            );
        }
    });

    socket.on('reply-message', data => {
        socket.emit(
            'reply-ready',
            {
                messageId:
                    data?.messageId || null
            }
        );
    });

    socket.on('delete-message', async data => {
        try {
            const messageId = String(
                data?.messageId || ''
            );

            const deleteType =
                data?.deleteType;

            if (
                messageId.startsWith('group_')
            ) {
                const item =
                    groupMessages.get(
                        messageId
                    );

                if (!item) return;

                if (deleteType === 'me') {
                    item.deletedFor.add(
                        socket.userId
                    );

                    socket.emit(
                        'message-deleted',
                        {
                            messageId,
                            deleteType: 'me'
                        }
                    );

                    return;
                }

                if (
                    deleteType === 'everyone' &&
                    item.senderId === socket.userId
                ) {
                    item.deletedForEveryone =
                        true;

                    item.deletedAt =
                        new Date();

                    io.emit(
                        'message-deleted',
                        {
                            messageId,
                            deleteType:
                                'everyone'
                        }
                    );
                }

                return;
            }

            if (
                !mongoose.Types.ObjectId.isValid(
                    messageId
                )
            ) {
                return;
            }

            if (deleteType === 'me') {
                const result =
                    await deleteMessageForMe(
                        messageId,
                        socket.userId
                    );

                if (result.success) {
                    socket.emit(
                        'message-deleted',
                        {
                            messageId,
                            deleteType: 'me'
                        }
                    );
                }

                return;
            }

            if (
                deleteType === 'everyone'
            ) {
                const result =
                    await deleteMessageForEveryone(
                        messageId,
                        socket.userId
                    );

                if (!result.success) {
                    return;
                }

                const message =
                    result.message;

                [
                    message.sender,
                    message.receiver
                ].forEach(userId => {
                    socketsForUser(
                        userId
                    ).forEach(socketId => {
                        io.to(socketId).emit(
                            'message-deleted',
                            {
                                messageId,
                                deleteType:
                                    'everyone'
                            }
                        );
                    });
                });
            }
        } catch (error) {
            console.error(
                'Delete message error:',
                error
            );
        }
    });

    socket.on('edit-message', async data => {
        try {
            const messageId = String(
                data?.messageId || ''
            );

            const newMessage =
                data?.message;

            if (
                messageId.startsWith('group_')
            ) {
                const item =
                    groupMessages.get(
                        messageId
                    );

                if (
                    !item ||
                    item.senderId !== socket.userId ||
                    item.deletedForEveryone
                ) {
                    return;
                }

                const clean =
                    typeof newMessage === 'string'
                        ? newMessage.trim()
                        : '';

                if (
                    !clean ||
                    clean.length > 500
                ) {
                    return;
                }

                item.message = clean;
                item.isEdited = true;
                item.editedAt = new Date();

                io.emit(
                    'message-edited',
                    {
                        messageId,
                        message: clean,
                        isEdited: true
                    }
                );

                return;
            }

            const result =
                await editMessage(
                    messageId,
                    socket.userId,
                    newMessage
                );

            if (!result.success) {
                return;
            }

            const message =
                result.message;

            [
                message.sender,
                message.receiver
            ].forEach(userId => {
                socketsForUser(
                    userId
                ).forEach(socketId => {
                    io.to(socketId).emit(
                        'message-edited',
                        {
                            messageId,
                            message:
                                message.message,
                            isEdited: true
                        }
                    );
                });
            });
        } catch (error) {
            console.error(
                'Edit message error:',
                error
            );
        }
    });

    socket.on('mark-read', async data => {
        try {
            const conversationId =
                String(
                    data?.conversationId || ''
                );

            if (
                !mongoose.Types.ObjectId.isValid(
                    conversationId
                )
            ) {
                return;
            }

            const ids =
                await markConversationRead(
                    conversationId,
                    socket.userId
                );

            for (const message of ids) {
                socketsForUser(
                    message.sender
                ).forEach(socketId => {
                    io.to(socketId).emit(
                        'message-read',
                        {
                            messageId:
                                String(
                                    message._id
                                ),
                            readAt:
                                message.readAt
                        }
                    );
                });
            }
        } catch (error) {
            console.error(
                'Mark read error:',
                error
            );
        }
    });

    socket.on('disconnect', async () => {
        connectedUsers.delete(
            socket.id
        );

        if (
            !socketsForUser(
                socket.userId
            ).length
        ) {
            const lastSeen =
                new Date();

            await User.findByIdAndUpdate(
                socket.userId,
                {
                    isOnline: false,
                    lastSeen
                }
            );

            io.emit(
                'user-offline',
                {
                    userId:
                        socket.userId,
                    name:
                        user.name,
                    username:
                        user.username,
                    isOnline: false,
                    lastSeen
                }
            );

            io.emit(
                'user-left',
                {
                    userId: socket.userId,
                    name: user.name,
                    username: user.username
                }
            );
        }
    });
});

async function startServer() {
    try {
        await mongoose.connect(
            MONGO_URI
        );

        console.log(
            'MongoDB connected successfully'
        );

        // A server restart starts a completely new login session.
        await Session.deleteMany({});

        // Only update lastSeen for users who were actually online
        // when the server went down. Users who never logged in
        // (or were already offline) keep their original lastSeen.
        await User.updateMany(
            { isOnline: true },
            {
                isOnline: false,
                lastSeen: new Date()
            }
        );

        groupMessages.clear();

        server.listen(
            PORT,
            () => {
                console.log(
                    `Server running on http://localhost:${PORT}`
                );
            }
        );
    } catch (error) {
        console.error(
            'Server startup error:',
            error
        );

        process.exit(1);
    }
}
startServer();