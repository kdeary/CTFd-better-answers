CTFd._internal.challenge.data = undefined;

CTFd._internal.challenge.preRender = function() {};

CTFd._internal.challenge.render = function(markdown) {
    return markdown;
};

CTFd._internal.challenge.postRender = function() {
    const $ = window.$ || CTFd.lib.$;

    // Toggle visibility for solved questions
    $('body').off('click', '.toggle-answer-visibility').on('click', '.toggle-answer-visibility', function () {
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
    $('body').off('click', '.better-answer-submit').on('click', '.better-answer-submit', function () {
        const $btn = $(this);
        const $input = $btn.siblings('.better-answer-input');
        const questionId = $input.data('question-id');
        const submission = $input.val();
        
        // Find challenge ID from CTFd context
        const challengeId = $('#ba-challenge-id').val() || $('#challenge-id').val() || window.CHALLENGE_ID || (CTFd._internal.challenge.data && CTFd._internal.challenge.data.id);

        if (!submission) return;

        $btn.addClass('disabled loading');
        
        CTFd.fetch(CTFd.config.urlRoot + '/api/v1/challenges/attempt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                challenge_id: challengeId,
                submission: submission,
                question_id: questionId
            })
        }).then(response => response.json()).then(response => {
            $btn.removeClass('disabled loading');
            if (response.success) {
                if (response.data.status === "correct") {
                    $input.parent().addClass('success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                } else {
                    const $error = $('.better-answer-error');
                    $error.text(response.data.message || "Incorrect").show().delay(3000).fadeOut();
                }
            }
        }).catch(err => {
            $btn.removeClass('disabled loading');
            console.error("Submission error:", err);
        });
    });
};

CTFd._internal.challenge.submit = function(preview) {
    // Custom challenge uses its own per-question submit logic above.
};
