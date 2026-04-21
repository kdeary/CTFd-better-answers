$(document).ready(function () {
    console.log("[BetterAnswers] Update JS loaded");

    // Standard CTFd update page usually has form elements we can target
    $('body').on('click', '#submit-better-answers-update', function(e) {
        e.preventDefault();
        
        const $form = $(this).closest('form');

        // Validate flag_points
        const flagPoints = $('input[name="flag_points"]').val().split(',').map(x => x.trim()).filter(x => x);


        // Validation: Ensure flag_points sums to total value
        const totalValue = parseInt($('input[name="value"]').val()) || 0;
        const pointsArray = flagPoints.map(p => parseInt(p) || 0);
        const pointsSum = pointsArray.reduce((a, b) => a + b, 0);

        if (flagPoints.length > 0 && pointsSum !== totalValue) {
            alert(`Error: The sum of individual flag points (${pointsSum}) must equal the total challenge value (${totalValue}).`);
            return;
        }

        const params = $form.serializeJSON(true);
        // Ensure numeric fields are correctly typed
        params.value = totalValue;
        params.max_attempts = parseInt(params.max_attempts) || 0;

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
                const oldText = $btn.html();
                $btn.removeClass('btn-success').addClass('btn-outline-success').html('<i class="fas fa-check"></i> Saved!');
                setTimeout(() => {
                    $btn.removeClass('btn-outline-success').addClass('btn-success').html(oldText);
                }, 2000);
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
