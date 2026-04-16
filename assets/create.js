CTFd.plugin.challenge.create = function (event, cb) {
    const data = $('#challenge-create-form').serializeJSON(true);
    CTFd.fetch('/api/v1/challenges', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(response => response.json()).then(response => {
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
    }).catch(err => {
        console.error("DEBUG: Exception while creating challenge:", err);
        CTFd.ui.toast.create({
            title: "Error Creating Challenge",
            body: "Check the console for more details.",
            icon: "danger"
        });
    });
};
