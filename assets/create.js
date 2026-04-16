CTFd.plugin.challenge.create = function (success, error) {
    const data = $('#challenge-create-form').serializeJSON(true);
    CTFd.api.post_challenge(data).then(response => {
        if (response.success) {
            success();
        } else {
            error(response);
        }
    });
};
