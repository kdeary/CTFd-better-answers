(function() {
    // Better Answers Plugin - Build v14
    console.log("[BetterAnswers] view.js v14 loaded");

    const $ = window.$ || CTFd.lib.$;

    // Ensure CTFd interface objects are defined early to avoid "preRender is not a function" errors
    CTFd._internal.challenge.preRender = function() {};
    CTFd._internal.challenge.postRender = function() {
        const $ = window.$ || CTFd.lib.$;
        
        // Fallback challenge ID detection
        const chalId = $('#ba-challenge-id').val() || $('#challenge-id').val() || window.CHALLENGE_ID;
        
        // Safely get data
        let data = CTFd._internal.challenge.data;
        console.log('[BetterAnswers] postRender fired', chalId, data);

        if (data.solved) {
            console.log('[BetterAnswers] Challenge is solved, hiding question table.');
            $('#ba-questions-container').hide();
            return;
        }

        function renderQuestions(questions) {
            window.ba_renderQuestions = renderQuestions;
            const $modal = $('#challenge-window').length ? $('#challenge-window') : $(document);
            const $container = $modal.find('#ba-questions-container');
            
            if (!$container.length) {
                // Container not ready, try again in a moment
                setTimeout(() => renderQuestions(questions), 50);
                return;
            }

            // Save current input states before emptying
            const savedValues = {};
            $container.find('.better-answer-input').each(function() {
                const qid = $(this).data('question-id');
                const val = $(this).val();
                if (qid && val) savedValues[qid] = val;
            });

            console.log("[BetterAnswers] Rendering questions...", questions);
            
            // Fix native grid layout spacing
            $modal.find('.submit-row > .col-sm-8').removeClass('col-sm-8').addClass('col-sm-12');
            $modal.find('.submit-row > .col-sm-4').hide();
            $modal.find('.modal-dialog').removeClass('modal-sm').addClass('modal-lg');
            
            $container.empty();
            questions.forEach(q => {
                let statusMark = '';
                if (q.solved) {
                    statusMark = '<i class="fas fa-check-circle text-success mr-2"></i>';
                } else if (q.max_attempts > 0 && q.attempts >= q.max_attempts) {
                    statusMark = '<i class="fas fa-times-circle text-danger mr-2"></i>';
                }

                const attemptsLeft = Math.max(0, q.max_attempts - q.attempts);
                // escHtml() all numeric/string server values before HTML interpolation
                const attemptInfo = (q.max_attempts > 0 && !q.solved)
                    ? ` <small class="text-muted">(${escHtml(attemptsLeft)} attempts left)</small>`
                    : ` <small class="text-muted">(${escHtml(q.attempts)} attempts)</small>`;

                // Use safe numeric id directly (integers from server are safe)
                const safeId  = parseInt(q.id, 10);
                // category is used as a CSS class — strip anything that isn't word chars / hyphens
                const safeCat = String(q.category || '').replace(/[^\w-]/g, '');

                const templateStr = `
                    <tr data-question-id="${safeId}" class="${safeCat}">
                        <td class="w-25 align-middle">
                            <div class="d-flex align-items-center h-100">
                                <div class="metadata ba-metadata w-100" style="font-weight: bold;">
                                    ${statusMark} ${escHtml(q.title)} - ${escHtml(q.points)} pts
                                    ${attemptInfo}
                                </div>
                            </div>
                        </td>
                        <td class="w-75 align-middle">
                            <div class="input-group ba-input-wrapper">
                            </div>
                        </td>
                    </tr>
                `;
                const $row = $(templateStr);
                
                const $inputWrapper = $row.find('.ba-input-wrapper');
                if (q.solved) {
                    // Build the input via DOM to avoid HTML injection from stored answer
                    const $solvedInput = $('<input type="password" readonly class="form-control better-answer-input">')
                        .attr('data-question-id', safeId)
                        .val(q.provided || '')
                        .css({background: '#e7f3ef', color: '#212529', 'font-weight': 'bold', 'border-color': '#badbcc'});
                    const $toggleBtn = $('<button class="btn btn-outline-success toggle-answer-visibility" type="button" title="Toggle Visibility"><i class="fas fa-eye"></i></button>');
                    $inputWrapper.append($solvedInput).append($toggleBtn);
                } else {
                    const isLocked = q.max_attempts > 0 && q.attempts >= q.max_attempts;
                    const savedVal = savedValues[q.id] || '';
                    
                    if (isLocked) {
                        $inputWrapper.append('<div class="form-control text-center text-danger bg-light" style="font-weight: bold; border-style: dashed;">Max attempts reached</div>');
                    } else {
                        // Build input via DOM so savedVal is set as a value, never parsed as HTML
                        const $input = $('<input type="text" placeholder="Answer..." class="form-control better-answer-input">')
                            .attr('data-question-id', safeId)
                            .val(savedVal);
                        const $submitBtn = $('<button class="btn btn-success better-answer-submit" type="button" title="Submit Answer"><i class="fas fa-paper-plane"></i></button>');
                        $inputWrapper.append($input).append($submitBtn);
                    }
                }
                $container.append($row);
            });
        }

        if (data && data.questions) {
            renderQuestions(data.questions);
        } else {
            window.loadAndRender();
        }

        // Toggle visibility for solved questions
        $('body').off('click', '.toggle-answer-visibility').on('click', '.toggle-answer-visibility', function () {
            const $btn = $(this);
            const $icon = $btn.find('i');
            const $input = $btn.siblings('.better-answer-input');
            if ($input.attr('type') === 'password') {
                $input.attr('type', 'text');
                $icon.removeClass('fa-eye').addClass('fa-eye-slash');
            } else {
                $input.attr('type', 'password');
                $icon.removeClass('fa-eye-slash').addClass('fa-eye');
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
                        
                        // If it's the final solve, we still want a reload to update scores/navbar
                        if (response.data.message && response.data.message.indexOf("fully solved") !== -1) {
                             setTimeout(() => {
                                 window.location.reload();
                             }, 1000);
                        } else {
                            // Dynamic update for partial solves
                            setTimeout(() => {
                                loadAndRender();
                            }, 500);
                        }
                    } else {
                        const $error = $('.better-answer-error');
                        const msg = response.data.message || "Incorrect (Unknown Error)";
                        $error.text(msg).show();
                        setTimeout(() => {
                            $error.hide();
                        }, 3000);
                        
                        // Refresh count on incorrect attempts too - wait 1s for DB to commit
                        setTimeout(() => {
                            console.log("[BetterAnswers] Refreshing counts...");
                            loadAndRender();
                        }, 1000);
                    }
                }
            }).catch(err => {
                $btn.removeClass('disabled loading');
                console.error("[BetterAnswers] Submission error:", err);
            });
        });
    };

    // Helper functions
    function escHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    window.loadAndRender = function() {
        const id = $('#ba-challenge-id').val() || $('#challenge-id').val() || window.CHALLENGE_ID;
        console.log("[BetterAnswers] loadAndRender triggered. ID found:", id);
        if (!id) {
            console.error("[BetterAnswers] FAILED to find challenge ID for refresh.");
            return;
        }
        
        const url = `${CTFd.config.urlRoot}/api/v1/challenges/${id}?_=${Date.now()}`;
        console.log("[BetterAnswers] Fetching:", url);
        
        CTFd.fetch(url)
            .then(r => r.json())
            .then(res => {
                console.log("[BetterAnswers] API Refresh Response:", res);
                if (res.success && res.data && res.data.questions) {
                    // Update internal data
                    CTFd._internal.challenge.data.questions = res.data.questions;
                    if (window.ba_renderQuestions) {
                        window.ba_renderQuestions(res.data.questions);
                    } else {
                        console.log("[BetterAnswers] ba_renderQuestions not found, trying reload as fallback.");
                        window.location.reload();
                    }
                }
            }).catch(err => console.error("[BetterAnswers] Refresh fetch failed:", err));
    };

})();
