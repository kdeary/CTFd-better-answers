$(document).ready(function () {
    const $container = $('.better-answers-container');
    
    // Toggle visibility for solved questions
    $('body').on('click', '.toggle-answer-visibility', function () {
        const $icon = $(this);
        const $input = $icon.siblings('.better-answer-input');
        if ($input.attr('type') === 'password') {
            $input.attr('type', 'text');
            $icon.removeClass('eye').addClass('eye slash');
        } else {
            $input.attr('type', 'password');
            $icon.removeClass('eye slash').addClass('eye');
        }
    });

    // Handle submission per question
    $('body').on('click', '.better-answer-submit', function () {
        const $btn = $(this);
        const $input = $btn.siblings('.better-answer-input');
        const questionId = $input.data('question-id');
        const submission = $input.val();
        
        // Find challenge ID from CTFd context
        // Usually CTFd sets a variable or we can find it in the modal
        const challengeId = $('#ba-challenge-id').val() || $('#challenge-id').val() || window.CHALLENGE_ID;

        if (!submission) return;

        $btn.addClass('disabled loading');
        
        // We use the standard attempt endpoint but include question_id
        $.ajax({
            url: CTFd.config.urlRoot + '/api/v1/challenges/attempt',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                challenge_id: challengeId,
                submission: submission,
                question_id: questionId
            }),
            headers: {
                'CSRF-Token': CTFd.config.csrfToken
            },
            success: function (response) {
                $btn.removeClass('disabled loading');
                if (response.success) {
                    if (response.data.status === "correct") {
                        // Success feedback
                        $input.parent().addClass('success');
                        setTimeout(() => {
                            // Reload to sync the full state (awards, solves, etc.)
                            location.reload();
                        }, 500);
                    } else {
                        // Error feedback
                        const $error = $('.better-answer-error');
                        $error.text(response.data.message || "Incorrect").show().delay(3000).fadeOut();
                        $input.parent().transition('shake');
                    }
                }
            },
            error: function(err) {
                $btn.removeClass('disabled loading');
                console.error("Submission error:", err);
            }
        });
    });
});
