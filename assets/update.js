$(document).ready(function () {
    const $container = $('#questions-container');
    const template = $('#question-template').html();

    function addQuestion(data = {}) {
        const $row = $(template);
        if (data.id) $row.find('.question-id').val(data.id);
        $row.find('.question-title').val(data.title || '');
        $row.find('.question-points').val(data.points || '');
        $row.find('.question-attempts').val(data.max_attempts || 0);
        $row.find('.question-category').val(data.category || '');
        $row.find('.question-answer').val(data.answer || '');
        $container.append($row);
    }

    $('#add-question-btn').click(() => addQuestion());
    
    $container.on('click', '.remove-question-btn', function () {
        $(this).closest('.question-item').remove();
    });

    // Initial load of questions
    // Since this is the update page, window.CHALLENGE_ID is available
    CTFd.api.get_challenge(window.CHALLENGE_ID).then(response => {
        if (response.success) {
            const questions = response.data.questions || [];
            if (questions.length > 0) {
                questions.forEach(q => addQuestion(q));
            } else {
                addQuestion(); // Add one row by default if empty
            }
        }
    });
    $('#submit-better-answers-update').click(function(e) {
        e.preventDefault();
        
        const data = $('#challenge-update-container form').serializeJSON(true);
        data.questions = [];

        $('#questions-container .question-item').each(function () {
            const $el = $(this);
            data.questions.push({
                id: $el.find('.question-id').val() || null,
                title: $el.find('.question-title').val(),
                points: $el.find('.question-points').val(),
                max_attempts: $el.find('.question-attempts').val() || 0,
                category: $el.find('.question-category').val(),
                answer: $el.find('.question-answer').val()
            });
        });

        console.log("DEBUG: Updating challenge with data:", data);

        CTFd.api.patch_challenge(window.CHALLENGE_ID, data).then(response => {
            if (response.success) {
                console.log("DEBUG: Update successful.");
                CTFd.ui.toast.create({
                    title: "Update Successful",
                    body: "Challenge details and custom questions saved successfully.",
                    icon: "success"
                });
            } else {
                console.error(response);
                CTFd.ui.toast.create({
                    title: "Error Updating Challenge",
                    body: "Check the console for more details.",
                    icon: "danger"
                });
            }
        });
    });
});
