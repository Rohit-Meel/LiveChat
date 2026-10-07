const Block = require('../models/Block');

async function isBlocked(blockerId, blockedId) {
    const block = await Block.exists({
        blocker: blockerId,
        blocked: blockedId
    });

    return Boolean(block);
}

async function getBlockStatus(currentUserId, otherUserId) {
    const [blockedByMe, blockedByThem] =
        await Promise.all([
            isBlocked(currentUserId, otherUserId),
            isBlocked(otherUserId, currentUserId)
        ]);

    return {
        blockedByMe,
        blockedByThem,
        canMessage:
            !blockedByMe &&
            !blockedByThem
    };
}

module.exports = {
    isBlocked,
    getBlockStatus
};
