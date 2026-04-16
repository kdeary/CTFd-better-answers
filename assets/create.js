CTFd.plugin.challenge.create = function (event, cb) {
    const data = $('#challenge-create-form').serializeJSON(true);
    CTFd.api.post_challenge(data).then(response => {
        if (response.success) {
            cb();
        } else {
            console.error(response);
            CTFd.ui.toast.create({
                title: "Error Creating Challenge",
                body: "Check the console for more details.",
                icon: "danger"
            });
        }
    });
};
