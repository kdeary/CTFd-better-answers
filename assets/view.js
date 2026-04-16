CTFd._internal.challenge.postRender = function() {
    const $ = window.$ || CTFd.lib.$;
    
    // Fallback challenge ID detection
    const chalId = $('#ba-challenge-id').val() || $('#challenge-id').val() || window.CHALLENGE_ID;
    
    // Safely get data
    let data = CTFd._internal.challenge.data;

    function renderQuestions(questions) {
        const $modal = $('#challenge-window').length ? $('#challenge-window') : $(document);
        const $container = $modal.find('#ba-questions-container');
        const template = $modal.find('#ba-question-template').html();
        
        if (!$container.length || !template) return;
        
        $container.empty();
        questions.forEach(q => {
            const $row = $(template);
            $row.attr('data-question-id', q.id);
            if (q.category) {
                $row.addClass(q.category);
            }
            $row.find('.ba-metadata').text(`${q.title} - ${q.points} points`);
            
            const $inputWrapper = $row.find('.ba-input-wrapper');
            if (q.solved) {
                $inputWrapper.append(`
                    <input type="password" value="${q.provided || ''}" data-question-id="${q.id}" readonly disabled class="better-answer-input" style="background: #f9f9f9;">
                    <i aria-hidden="true" class="eye icon link toggle-answer-visibility" style="color: #2185d0;"></i>
                `);
            } else {
                $inputWrapper.append(`
                    <input type="text" placeholder="Answer..." data-question-id="${q.id}" class="better-answer-input">
                    <i aria-hidden="true" class="right arrow circular icon link better-answer-submit" style="color: #00af29;"></i>
                `);
            }
            $container.append($row);
        });
    }

    if (data && data.questions) {
        renderQuestions(data.questions);
    } else if (chalId) {
        CTFd.fetch(`/api/v1/challenges/${chalId}`)
            .then(r => r.json())
            .then(res => {
                if (res.success && res.data && res.data.questions) {
                    renderQuestions(res.data.questions);
                }
            });
    }

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
        const challengeId = $('#ba-challenge-id').val() || $('#challenge-id').val() || window.CHALLENGE_ID || (data && data.id);

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
