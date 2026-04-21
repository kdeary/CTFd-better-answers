$(document).ready(function () {
    console.log("[BetterAnswers] Update JS loaded");

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

        // Validation: Ensure flag_points sums to total value
        const totalValue = parseInt($('input[name="value"]').val()) || 0;
        const pointsArray = flagPoints.map(p => parseInt(p) || 0);
        const pointsSum = pointsArray.reduce((a, b) => a + b, 0);

        if (flagPoints.length > 0 && pointsSum !== totalValue) {
            alert(`Error: The sum of individual flag points (${pointsSum}) must equal the total challenge value (${totalValue}).`);
            return;
        }

        const params = {
            name: $('input[name="name"]').val(),
            category: $('input[name="category"]').val(),
            description: $('textarea[name="description"]').val(),
            value: totalValue,
            state: $('select[name="state"]').val(),
            flag_points: $('input[name="flag_points"]').val(),
            flag_attempts: $('input[name="flag_attempts"]').val()
        };

        console.log("[BetterAnswers] Updating challenge with params:", params);

        // Standard CTFd uses window.CHALLENGE_ID or we pull from a hidden input
        const chalId = $('#ba-challenge-id').val() || window.CHALLENGE_ID;
        const $btn = $(this);

        $btn.addClass('disabled loading');

        CTFd.fetch(`${CTFd.config.urlRoot}/api/v1/challenges/${chalId}`, {
            method: 'PATCH',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        }).then(response => response.json()).then(response => {
            $btn.removeClass('disabled loading');
            if (response.success) {
                alert("Challenge updated successfully.");
                window.location.reload();
            } else {
                console.error("[BetterAnswers] Update Error:", response);
                alert("Error Updating Challenge: " + (response.message || "Check the console for more details."));
            }
        }).catch(err => {
            $btn.removeClass('disabled loading');
            console.error("[BetterAnswers] Update Exception:", err);
            alert("Error Updating Challenge: Connectivity issue or server error.");
        });
    });
});
