$(document).ready(function () {
    console.log("BetterAnswers: Update JS loaded");

    // Standard CTFd update page usually has form elements we can target
    $('body').on('click', '#submit-better-answers-update', function(e) {
        e.preventDefault();
        
        const $form = $(this).closest('form');
        const data = $form.serializeJSON(true);

        // Validate flag_points
        if (data.flag_points && data.flag_points.trim() !== '') {
            const points = data.flag_points.split(',').map(p => parseInt(p.trim()) || 0);
            const sum = points.reduce((a, b) => a + b, 0);
            if (sum !== parseInt(data.value)) {
                alert(`Error: Flag points (${sum}) must add up to the total value (${data.value}).`);
                return;
            }
        }

        console.log("BetterAnswers: Updating challenge with data:", data);

        // Standard CTFd uses window.CHALLENGE_ID or we pull from a hidden input
        const chalId = $('#ba-challenge-id').val() || window.CHALLENGE_ID;

        CTFd.fetch(`${CTFd.config.urlRoot}/api/v1/challenges/${chalId}`, {
            method: 'PATCH',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(response => response.json()).then(response => {
            if (response.success) {
                alert("Challenge updated successfully.");
                window.location.reload();
            } else {
                console.error(response);
                alert("Error Updating Challenge: Check the console for more details.");
            }
        }).catch(err => {
            console.error("BetterAnswers: Update Exception:", err);
            alert("Error Updating Challenge: Check the console for more details.");
        });
    });
});
