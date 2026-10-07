/* =========================================================
   PROFILE
========================================================= */

const profileForm =
    document.getElementById('profile-form');

const profileName =
    document.getElementById('profile-name');

const profileUsername =
    document.getElementById('profile-username');

const profileEmail =
    document.getElementById('profile-email');

const profileBio =
    document.getElementById('profile-bio');

const profileAvatar =
    document.getElementById('profile-avatar');

const profileMessage =
    document.getElementById('profile-message');

const profileSaveButton =
    document.getElementById('profile-save-btn');

const profileBack =
    document.getElementById('profile-back');

const bioCount =
    document.getElementById('bio-count');


/* =========================================================
   SHOW MESSAGE
========================================================= */

function showProfileMessage(
    message,
    type = 'error'
) {

    if (!profileMessage) {
        return;
    }

    profileMessage.textContent =
        message;

    profileMessage.className =
        'profile-message';

    profileMessage.classList.add(type);
}


/* =========================================================
   CLEAR MESSAGE
========================================================= */

function clearProfileMessage() {

    if (!profileMessage) {
        return;
    }

    profileMessage.textContent = '';

    profileMessage.className =
        'profile-message';
}


/* =========================================================
   UPDATE AVATAR
========================================================= */

function updateProfileAvatar(name) {

    if (!profileAvatar) {
        return;
    }

    const cleanName =
        name ? name.trim() : '';

    if (!cleanName) {

        profileAvatar.textContent =
            '?';

        return;
    }

    profileAvatar.textContent =
        cleanName
            .charAt(0)
            .toUpperCase();
}


/* =========================================================
   BIO COUNTER
========================================================= */

function updateBioCount() {

    if (!profileBio || !bioCount) {
        return;
    }

    bioCount.textContent =
        profileBio.value.length;
}


if (profileBio) {

    profileBio.addEventListener(
        'input',
        updateBioCount
    );

}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfile() {

    try {

        const response =
            await fetch(
                '/api/users/profile',
                {
                    method: 'GET',
                    credentials: 'same-origin'
                }
            );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            window.location.href =
                '/login.html';

            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            showProfileMessage(
                data.message ||
                'Unable to load profile'
            );

            return;
        }


        const user =
            data.user;


        profileName.value =
            user.name || '';


        profileUsername.value =
            user.username
                ? '@' + user.username
                : '';


        profileEmail.value =
            user.email || '';


        profileBio.value =
            user.bio || '';


        updateProfileAvatar(
            user.name
        );


        updateBioCount();

    } catch (error) {

        console.error(
            'Load profile error:',
            error
        );


        showProfileMessage(
            'Unable to connect to the server'
        );
    }
}


/* =========================================================
   UPDATE PROFILE
========================================================= */

if (profileForm) {

    profileForm.addEventListener(
        'submit',
        async (event) => {

            event.preventDefault();

            clearProfileMessage();


            const name =
                profileName.value.trim();


            const bio =
                profileBio.value.trim();


            if (!name) {

                showProfileMessage(
                    'Name is required'
                );

                return;
            }


            if (
                name.length < 2 ||
                name.length > 50
            ) {

                showProfileMessage(
                    'Name must be between 2 and 50 characters'
                );

                return;
            }


            if (bio.length > 250) {

                showProfileMessage(
                    'Bio cannot exceed 250 characters'
                );

                return;
            }


            profileSaveButton.disabled =
                true;

            profileSaveButton.textContent =
                'Saving...';


            try {

                const response =
                    await fetch(
                        '/api/users/profile',
                        {
                            method: 'PUT',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            credentials:
                                'same-origin',

                            body:
                                JSON.stringify({
                                    name,
                                    bio
                                })
                        }
                    );


                const data =
                    await response.json();


                if (
                    response.status === 401 ||
                    response.status === 403
                ) {

                    window.location.href =
                        '/login.html';

                    return;
                }


                if (!response.ok) {

                    showProfileMessage(
                        data.message ||
                        'Unable to update profile'
                    );

                    return;
                }


                profileName.value =
                    data.user.name || '';

                profileBio.value =
                    data.user.bio || '';


                updateProfileAvatar(
                    data.user.name
                );

                updateBioCount();


                showProfileMessage(
                    data.message ||
                    'Profile updated successfully',
                    'success'
                );


            } catch (error) {

                console.error(
                    'Update profile error:',
                    error
                );


                showProfileMessage(
                    'Unable to connect to the server'
                );

            } finally {

                profileSaveButton.disabled =
                    false;

                profileSaveButton.textContent =
                    'Save Changes';

            }

        }
    );

}


/* =========================================================
   BACK TO CHAT
========================================================= */

if (profileBack) {

    profileBack.addEventListener(
        'click',
        () => {

            window.location.href =
                '/';

        }
    );

}


/* =========================================================
   INITIAL LOAD
========================================================= */

loadProfile();