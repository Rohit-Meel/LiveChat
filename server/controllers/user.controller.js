const mongoose = require('mongoose');

const User = require('../models/User');
const Block = require('../models/Block');


/*
|--------------------------------------------------------------------------
| Get All Users
|--------------------------------------------------------------------------
*/

async function getAllUsers(req, res) {

    try {

        const currentUserId =
            req.user._id.toString();


        const users =
            await User.find({
                _id: {
                    $ne: currentUserId
                }
            })
            .select(
                '_id name username profileImage bio isOnline lastSeen'
            )
            .sort({
                name: 1
            });


        /*
         * Get blocks related to current user
         */

        const blocks =
            await Block.find({
                $or: [
                    {
                        blocker: req.user._id
                    },
                    {
                        blocked: req.user._id
                    }
                ]
            })
            .select(
                'blocker blocked'
            )
            .lean();


        const blockMap = {};


        blocks.forEach(
            block => {

                const blockerId =
                    String(
                        block.blocker
                    );

                const blockedId =
                    String(
                        block.blocked
                    );


                /*
                 * Current user blocked this user
                 */

                if (
                    blockerId ===
                    currentUserId
                ) {

                    blockMap[blockedId] = {
                        blockedByMe: true,
                        blockedByThem: false
                    };

                }


                /*
                 * This user blocked current user
                 */

                else if (
                    blockedId ===
                    currentUserId
                ) {

                    blockMap[blockerId] = {
                        blockedByMe: false,
                        blockedByThem: true
                    };

                }

            }
        );


        const formattedUsers =
            users.map(
                user => {

                    const userId =
                        String(
                            user._id
                        );


                    const blockInfo =
                        blockMap[userId] || {
                            blockedByMe: false,
                            blockedByThem: false
                        };


                    return {

                        ...user.toObject(),

                        blockedByMe:
                            blockInfo.blockedByMe,

                        blockedByThem:
                            blockInfo.blockedByThem

                    };

                }
            );


        return res.status(200).json({

            success: true,

            users:
                formattedUsers

        });

    }

    catch (error) {

        console.error(
            'Get users error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Unable to load users'

        });

    }
}


/*
|--------------------------------------------------------------------------
| Block User
|--------------------------------------------------------------------------
*/

async function blockUser(req, res) {

    try {

        const currentUserId =
            req.user._id.toString();


        const userId =
            req.params.userId;


        if (
            !mongoose.Types.ObjectId.isValid(
                userId
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid user ID'

            });

        }


        if (
            currentUserId ===
            userId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'You cannot block yourself'

            });

        }


        const user =
            await User.findById(
                userId
            )
            .select('_id');


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    'User not found'

            });

        }


        const existingBlock =
            await Block.findOne({

                blocker:
                    req.user._id,

                blocked:
                    userId

            });


        if (existingBlock) {

            return res.status(200).json({

                success: true,

                blocked: true,

                message:
                    'User is already blocked'

            });

        }


        await Block.create({

            blocker:
                req.user._id,

            blocked:
                userId

        });


        return res.status(201).json({

            success: true,

            blocked: true,

            message:
                'User blocked successfully'

        });

    }

    catch (error) {

        console.error(
            'Block user error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Unable to block user'

        });

    }
}


/*
|--------------------------------------------------------------------------
| Unblock User
|--------------------------------------------------------------------------
*/

async function unblockUser(req, res) {

    try {

        const currentUserId =
            req.user._id.toString();


        const userId =
            req.params.userId;


        if (
            !mongoose.Types.ObjectId.isValid(
                userId
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid user ID'

            });

        }


        const result =
            await Block.deleteOne({

                blocker:
                    req.user._id,

                blocked:
                    userId

            });


        if (
            result.deletedCount === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'User is not blocked'

            });

        }


        return res.status(200).json({

            success: true,

            blocked: false,

            message:
                'User unblocked successfully'

        });

    }

    catch (error) {

        console.error(
            'Unblock user error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Unable to unblock user'

        });

    }
}


/*
|--------------------------------------------------------------------------
| Check Block Status
|--------------------------------------------------------------------------
*/

async function getBlockStatus(req, res) {

    try {

        const currentUserId =
            req.user._id.toString();


        const userId =
            req.params.userId;


        if (
            !mongoose.Types.ObjectId.isValid(
                userId
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid user ID'

            });

        }


        const block =
            await Block.findOne({

                $or: [

                    {
                        blocker:
                            req.user._id,

                        blocked:
                            userId
                    },

                    {
                        blocker:
                            userId,

                        blocked:
                            req.user._id
                    }

                ]

            });


        if (!block) {

            return res.status(200).json({

                success: true,

                blocked: false,

                blockedByMe: false,

                blockedByThem: false

            });

        }


        const blockedByMe =
            String(
                block.blocker
            ) ===
            currentUserId;


        return res.status(200).json({

            success: true,

            blocked: true,

            blockedByMe,

            blockedByThem:
                !blockedByMe

        });

    }

    catch (error) {

        console.error(
            'Block status error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Unable to check block status'

        });

    }
}



/* =========================================================
   PROFILE
========================================================= */

async function getProfile(req, res) {
    try {
        const user = await User.findById(req.user._id)
            .select('_id name username email profileImage bio isOnline lastSeen');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to load profile'
        });
    }
}

async function updateProfile(req, res) {
    try {
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        const bio = typeof req.body.bio === 'string' ? req.body.bio.trim() : '';
        const username = typeof req.body.username === 'string'
            ? req.body.username.trim().toLowerCase()
            : '';

        if (name.length < 2 || name.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Name must be between 2 and 50 characters'
            });
        }

        if (bio.length > 250) {
            return res.status(400).json({
                success: false,
                message: 'Bio cannot exceed 250 characters'
            });
        }

        if (username) {
            if (!/^[a-z0-9_]{3,30}$/.test(username)) {
                return res.status(400).json({
                    success: false,
                    message: 'Username must be 3-30 chars (a-z, 0-9, _)'
                });
            }

            const existing = await User.findOne({
                username,
                _id: { $ne: req.user._id }
            });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: 'Username already taken'
                });
            }
        }

        const update = { name, bio };
        if (username) update.username = username;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: update },
            { new: true, runValidators: true }
        ).select('_id name username email profileImage bio isOnline lastSeen');

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to update profile'
        });
    }
}

module.exports = {

    getAllUsers,

    blockUser,

    unblockUser,

    getBlockStatus,
    getProfile,
    updateProfile

};