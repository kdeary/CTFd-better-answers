$(document).ready(function() {
    console.log("BetterAnswers: Create JS loaded");

    // Standard CTFd 3.x challenge creation usually posts via AJAX from the modal.
    // We intercept the form submission for validation.
    $('#challenge-create-form').submit(function (e) {
        const $form = $(this);
        const data = $form.serializeJSON(true);
        
        // Validate flag_points sums to value
        if (data.flag_points && data.flag_points.trim() !== '') {
            const points = data.flag_points.split(',').map(p => parseInt(p.trim()) || 0);
            const sum = points.reduce((a, b) => a + b, 0);
            if (sum !== parseInt(data.value)) {
                alert(`Error: Flag points (${sum}) must add up to the initial value (${data.value}).`);
                e.preventDefault();
                return false;
            }
        }
        
        // If we got here, validation passed.
        // We let the standard CTFd creation logic proceed.
        return true;
    });
});
