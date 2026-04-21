$(document).ready(function () {
    console.log("BetterAnswers: Update JS loaded");

    // Standard CTFd update page usually has form elements we can target
    $('body').on('click', '#submit-better-answers-update', function(e) {
        e.preventDefault();
        
        const $form = $(this).closest('form');

        // Validate flag_points
        const flagPoints = $('input[name="flag_points"]').val().split(',').map(x => x.trim()).filter(x => x);
        const flagAttempts = $('input[name="flag_attempts"]').val().split(',').map(x => x.trim()).filter(x => x);
        const flagCount = parseInt($('#ba-flag-count').val()) || 0;

        if (flagCount > 0) {
            if (flagPoints.length > 0 && flagPoints.length !== flagCount) {
                 alert(`Warning: You have ${flagCount} flags but ${flagPoints.length} point values defined.`);
                 return;
            }
            if (flagAttempts.length > 0 && flagAttempts.length !== flagCount) {
                 alert(`Warning: You have ${flagCount} flags but ${flagAttempts.length} attempt limits defined.`);
                 return;
            }
        }

        // Prepare data
        const params = {
            name: $('input[name="name"]').val(),
            category: $('input[name="category"]').val(),
            description: $('textarea[name="description"]').val(),
            value: $('input[name="value"]').val(),
            state: $('select[name="state"]').val(),
            flag_points: $('input[name="flag_points"]').val(),
            flag_attempts: $('input[name="flag_attempts"]').val()
        };

        console.log("BetterAnswers: Updating challenge with params:", params);

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
