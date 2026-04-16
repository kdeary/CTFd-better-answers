CTFd._internal.challenge.preRender = function() {};
CTFd._internal.challenge.postRender = function() {
    const $ = window.$ || CTFd.lib.$;
    
    // Fix native grid layout spacing
    const $modal = $('#challenge-window').length ? $('#challenge-window') : $(document);
    $modal.find('.submit-row > .col-sm-8').removeClass('col-sm-8').addClass('col-sm-12');
    $modal.find('.submit-row > .col-sm-4').hide();
    
    // Expand the modal width to give the custom multi-question table breathing room
    $modal.find('.modal-dialog').removeClass('modal-sm').addClass('modal-lg');
    
    // Fallback challenge ID detection
    const chalId = $('#ba-challenge-id').val() || $('#challenge-id').val() || window.CHALLENGE_ID;
    
    // Safely get data
    let data = CTFd._internal.challenge.data;

    console.log('post render fired',chalId, data)

    function renderQuestions(questions) {
        // Poll for the container because Alpine.js x-html DOM hydration is asynchronous
        let pollCount = 0;
        const checkExist = setInterval(function() {
            pollCount++;
            const $modal = $('#challenge-window').length ? $('#challenge-window') : $(document);
            const $container = $modal.find('#ba-questions-container');
            
            if ($container.length) {
                clearInterval(checkExist);
                
                $container.empty();
                questions.forEach(q => {
                    const templateStr = `
                        <tr data-question-id="${q.id}" class="${q.category ? q.category : ''}">
                            <td class="ten wide">
                                <div>
                                    <div class="metadata ba-metadata" style="margin-bottom: 0.5rem; font-weight: bold;">${q.title} - ${q.points} points</div>
                                </div>
                            </td>
                            <td class="six wide center aligned">
                                <div class="ui fluid input icon ba-input-wrapper" style="min-width: 200px;">
                                </div>
                            </td>
                        </tr>
                    `;
                    const $row = $(templateStr);
                    
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
            } else if (pollCount > 40) {
                // Timeout after ~2 seconds
                clearInterval(checkExist);
                console.error("BetterAnswers: Timeout waiting for #ba-questions-container to render.");
            }
        }, 50); // Check every 50ms
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
