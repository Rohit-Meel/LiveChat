const mongoose =
    require('mongoose');

const User =
    require('../models/User');

const {
    isBlocked,
    blockUser,
    unblockUser,
    getBlockStatus
} =
    require('../services/block.service');


/*
|--------------------------------------------------------------------------
| Get Block Status
|--------------------------------------------------------------------------
*/

async function getStatus(
    req,
    res
) {

    try {

        const currentUserId =
            req.user._id.toString();


        const otherUserId =
            req.params.userId;


        if (
            !mongoose.Types.ObjectId.isValid(
                otherUserId
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
            otherUserId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid user'

            });

        }


        const user =
            await User.findById(
                otherUserId
            )
            .select('_id');


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    'User not found'

            });

        }


        const blockStatus =
            await getBlockStatus(
                currentUserId,
                otherUserId
            );


        return res.status(200).json({

            success: true,

            blockStatus

        });

    }

    catch (error) {

        console.error(
            'Get block status error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Unable to get block status'

        });

    }

}


/*
|--------------------------------------------------------------------------
| Block User
|--------------------------------------------------------------------------
*/

async function block(
    req,
    res
) {

    try {

        const currentUserId =
            req.user._id.toString();


        const otherUserId =
            req.params.userId;


        if (
            !mongoose.Types.ObjectId.isValid(
                otherUserId
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
            otherUserId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'You cannot block yourself'

            });

        }


        const user =
            await User.findById(
                otherUserId
            )
            .select('_id name username');


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    'User not found'

            });

        }


        await blockUser(
            currentUserId,
            otherUserId
        );


        const blockStatus =
            await getBlockStatus(
                currentUserId,
                otherUserId
            );


        return res.status(200).json({

            success: true,

            message:
                `${user.name} has been blocked`,

            blockStatus

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

async function unblock(
    req,
    res
) {

    try {

        const currentUserId =
            req.user._id.toString();


        const otherUserId =
            req.params.userId;


        if (
            !mongoose.Types.ObjectId.isValid(
                otherUserId
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid user ID'

            });

        }


        await unblockUser(
            currentUserId,
            otherUserId
        );


        const blockStatus =
            await getBlockStatus(
                currentUserId,
                otherUserId
            );


        return res.status(200).json({

            success: true,

            message:
                'User unblocked successfully',

            blockStatus

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


module.exports = {

    getStatus,

    block,

    unblock

};