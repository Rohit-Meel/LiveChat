const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth.middleware');
const User = require('../models/User');
const Block = require('../models/Block');
const {
    getBlockStatus
} = require('../services/block.service');

const router = express.Router();

async function validateTarget(req, res, next) {
    const userId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid user ID'
        });
    }

    if (req.user._id.toString() === userId) {
        return res.status(400).json({
            success: false,
            message: 'You cannot block yourself'
        });
    }

    const user = await User.findById(userId).select('_id');

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    next();
}

router.get(
    '/:userId',
    requireAuth,
    validateTarget,
    async (req, res) => {
        try {
            const blockStatus = await getBlockStatus(
                req.user._id,
                req.params.userId
            );

            return res.status(200).json({
                success: true,
                blockStatus
            });
        }
        catch (error) {
            console.error('Get block status error:', error);

            return res.status(500).json({
                success: false,
                message: 'Unable to load block status'
            });
        }
    }
);

router.post(
    '/:userId',
    requireAuth,
    validateTarget,
    async (req, res) => {
        try {
            await Block.updateOne(
                {
                    blocker: req.user._id,
                    blocked: req.params.userId
                },
                {
                    $setOnInsert: {
                        blocker: req.user._id,
                        blocked: req.params.userId
                    }
                },
                { upsert: true }
            );

            const blockStatus = await getBlockStatus(
                req.user._id,
                req.params.userId
            );

            return res.status(200).json({
                success: true,
                message: 'User blocked successfully',
                blockStatus
            });
        }
        catch (error) {
            console.error('Block user error:', error);

            return res.status(500).json({
                success: false,
                message: 'Unable to block user'
            });
        }
    }
);

router.delete(
    '/:userId',
    requireAuth,
    validateTarget,
    async (req, res) => {
        try {
            await Block.deleteOne({
                blocker: req.user._id,
                blocked: req.params.userId
            });

            const blockStatus = await getBlockStatus(
                req.user._id,
                req.params.userId
            );

            return res.status(200).json({
                success: true,
                message: 'User unblocked successfully',
                blockStatus
            });
        }
        catch (error) {
            console.error('Unblock user error:', error);

            return res.status(500).json({
                success: false,
                message: 'Unable to unblock user'
            });
        }
    }
);

module.exports = router;
