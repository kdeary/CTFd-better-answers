$(document).ready(function() {
    console.log("[BetterAnswers] Create JS loaded");

    // Helper to validate and sum CSV numbers
    function validateAndSumCSV(str, label) {
        if (!str || str.trim() === "") return { valid: true, sum: 0, count: 0 };
        const parts = str.split(',').map(p => p.trim());
        let sum = 0;
        for (let part of parts) {
            if (part === "") continue;
            const val = parseInt(part);
            if (isNaN(val)) return { valid: false, error: `Invalid number in ${label}: "${part}"` };
            sum += val;
        }
        return { valid: true, sum: sum, count: parts.filter(p => p !== "").length };
    }

    // Standard CTFd 3.x challenge creation usually posts via AJAX from the modal.
    $('#challenge-create-form').submit(function (e) {
        // Manual field extraction for consistency with update.js
        const name = $('input[name="name"]').val();
        const value = parseInt($('input[name="value"]').val()) || 0;
        const flagPointsRaw = $('input[name="flag_points"]').val() || "";
        const flagAttemptsRaw = $('input[name="flag_attempts"]').val() || "";
        
        // 1. Validate Flag Points Format & Sum
        const pointsRes = validateAndSumCSV(flagPointsRaw, "Flag Points");
        if (!pointsRes.valid) {
            alert(pointsRes.error);
            e.preventDefault();
            return false;
        }
        if (pointsRes.count > 0 && pointsRes.sum !== value) {
            alert(`Error: Flag points (${pointsRes.sum}) must add up to the initial value (${value}).`);
            e.preventDefault();
            return false;
        }

        // 2. Validate Flag Attempts Format
        const attemptsRes = validateAndSumCSV(flagAttemptsRaw, "Flag Attempts");
        if (!attemptsRes.valid) {
            alert(attemptsRes.error);
            e.preventDefault();
            return false;
        }
        
        console.log("[BetterAnswers] Validation passed for new challenge:", name);
        return true;
    });
});
