const express = require('express');


const {
    requireAuth
} = require('../middleware/auth.middleware');


const {
    getAllUsers,
    blockUser,
    unblockUser,
    getBlockStatus,
    getProfile,
    updateProfile
} = require('../controllers/user.controller');


const router =
    express.Router();


/*
|--------------------------------------------------------------------------
| Get All Users
|--------------------------------------------------------------------------
*/

router.get(
    '/',
    requireAuth,
    getAllUsers
);

router.get(
    '/profile',
    requireAuth,
    getProfile
);

router.put(
    '/profile',
    requireAuth,
    updateProfile
);


/*
|--------------------------------------------------------------------------
| Block User
|--------------------------------------------------------------------------
*/

router.post(
    '/block/:userId',
    requireAuth,
    blockUser
);


/*
|--------------------------------------------------------------------------
| Unblock User
|--------------------------------------------------------------------------
*/

router.delete(
    '/block/:userId',
    requireAuth,
    unblockUser
);


/*
|--------------------------------------------------------------------------
| Block Status
|--------------------------------------------------------------------------
*/

router.get(
    '/block/:userId',
    requireAuth,
    getBlockStatus
);


module.exports =
    router;