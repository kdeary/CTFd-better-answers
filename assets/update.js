$(document).ready(function () {
    $('#submit-better-answers-update').click(function(e) {
        e.preventDefault();
        
        let data = $(this).closest('form').serializeJSON(true);
        if (!data) data = {};

        // Validate flag_points
        if (data.flag_points && data.flag_points.trim() !== '') {
            const points = data.flag_points.split(',').map(p => parseInt(p.trim()) || 0);
            const sum = points.reduce((a, b) => a + b, 0);
            if (sum !== parseInt(data.value)) {
                alert(`Error: Flag points (${sum}) must add up to the total value (${data.value}).`);
                return;
            }
        }

        console.log("DEBUG: Updating challenge with data:", data);

        CTFd.fetch(`/api/v1/challenges/${window.CHALLENGE_ID}`, {
            method: 'PATCH',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(response => response.json()).then(response => {
            if (response.success) {
                console.log("DEBUG: Update successful.");
                alert("Challenge details and custom questions saved successfully.");
                window.location.reload();
            } else {
                console.error(response);
                alert("Error Updating Challenge: Check the console for more details.");
            }
        }).catch(err => {
            console.error("DEBUG: Exception while updating challenge:", err);
            alert("Error Updating Challenge: Check the console for more details.");
        });
    });
});
