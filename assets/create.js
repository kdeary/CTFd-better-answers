CTFd.plugin.challenge.create = function (event, cb) {
    let data = $('#challenge-create-form').serializeJSON(true);
    
    // Validate flag_points sums to value
    if (data.flag_points && data.flag_points.trim() !== '') {
        const points = data.flag_points.split(',').map(p => parseInt(p.trim()) || 0);
        const sum = points.reduce((a, b) => a + b, 0);
        if (sum !== parseInt(data.value)) {
            alert(`Error: Flag points (${sum}) must add up to the initial value (${data.value}).`);
            return;
        }
    }
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
            alert("Error Creating Challenge: Check the console for more details.");
        }
    }).catch(err => {
        console.error("DEBUG: Exception while creating challenge:", err);
        alert("Error Creating Challenge: Check the console for more details.");
    });
};
