from flask import Blueprint, request, jsonify
from CTFd.plugins import register_plugin_assets_directory
from CTFd.plugins.challenges import CHALLENGE_CLASSES, BaseChallenge
from CTFd.models import db, Solves, Awards, Challenges
from CTFd.utils.user import get_current_user, get_current_team
from CTFd.utils import user as user_utils
from .models import BetterAnswersChallenge, BetterAnswersQuestion, BetterAnswersSubmission

class BetterAnswersChallengeType(BaseChallenge):
    id = "better_answers"
    name = "better_answers"
    challenge_model = BetterAnswersChallenge

    templates = {
        "create": f"/plugins/better-answers/assets/create.html",
        "update": f"/plugins/better-answers/assets/update.html",
        "view": f"/plugins/better-answers/assets/view.html",
    }
    scripts = {
        "create": f"/plugins/better-answers/assets/create.js",
        "update": f"/plugins/better-answers/assets/update.js",
        "view": f"/plugins/better-answers/assets/view.js",
    }

    @classmethod
    def get_plugin_name(cls):
        return __name__.split('.')[-1]

    @staticmethod
    def create(request):
        data = request.form or request.get_json()
        challenge = BetterAnswersChallenge(**data)
        db.session.add(challenge)
        db.session.commit()
        return challenge

    @classmethod
    def read(cls, challenge):
        user = get_current_user()
        team = get_current_team()
        user_id = user.id if user else None
        team_id = team.id if team else None

        questions = BetterAnswersQuestion.query.filter_by(challenge_id=challenge.id).all()
        q_list = []
        for q in questions:
            # Check if this question is solved by the user/team
            solve = BetterAnswersSubmission.query.filter_by(
                question_id=q.id,
                user_id=user_id,
                team_id=team_id,
                correct=True
            ).first()
            
            q_list.append({
                "id": q.id,
                "title": q.title,
                "description": q.description,
                "points": q.points,
                "max_attempts": q.max_attempts,
                "category": q.category,
                "solved": solve is not None,
                "provided": solve.provided if solve else "",
                "answer": q.answer if user_utils.is_admin() else None
            })

        data = {
            "id": challenge.id,
            "name": challenge.name,
            "value": challenge.value,
            "description": challenge.description,
            "category": challenge.category,
            "state": challenge.state,
            "max_attempts": challenge.max_attempts,
            "type": challenge.type,
            "type_data": {
                "id": cls.id,
                "name": cls.name,
                "templates": cls.templates,
                "scripts": cls.scripts,
            },
            "questions": q_list,
        }
        return data

    @staticmethod
    def update(challenge, request):
        data = request.form or request.get_json()
        
        # Handle core challenge fields
        for key, value in data.items():
            if key == "questions":
                continue # Handled below
            setattr(challenge, key, value)

        # Handle questions if provided
        if "questions" in data:
            incoming_questions = data["questions"]
            print(f"DEBUG PLUGIN BetterAnswers: update routine fired for ID {challenge.id}. Updating questions: {incoming_questions}")
            existing_questions = {str(q.id): q for q in BetterAnswersQuestion.query.filter_by(challenge_id=challenge.id).all()}
            
            keep_ids = []
            for q_data in incoming_questions:
                q_id = str(q_data.get("id")) if q_data.get("id") else None
                
                # Sanitize ints
                try:
                    q_data["points"] = int(q_data.get("points") or 0)
                except:
                    q_data["points"] = 0
                try:
                    q_data["max_attempts"] = int(q_data.get("max_attempts") or 0)
                except:
                    q_data["max_attempts"] = 0

                if q_id and q_id in existing_questions:
                    q = existing_questions[q_id]
                    for k, v in q_data.items():
                        if k != "id":
                            setattr(q, k, v)
                    keep_ids.append(q_id)
                else:
                    if "id" in q_data:
                        del q_data["id"] # Never override autoincrement
                    new_q = BetterAnswersQuestion(challenge_id=challenge.id, **q_data)
                    db.session.add(new_q)
                    db.session.flush() # Get ID
                    keep_ids.append(str(new_q.id))
            
            # Delete questions not in keep_ids
            for eid in existing_questions:
                if eid not in keep_ids:
                    db.session.delete(existing_questions[eid])

        db.session.commit()
        return challenge

    @staticmethod
    def delete(challenge):
        BetterAnswersQuestion.query.filter_by(challenge_id=challenge.id).delete()
        BetterAnswersSubmission.query.filter_by(challenge_id=challenge.id).delete()
        BetterAnswersChallenge.query.filter_by(id=challenge.id).delete()
        Challenges.query.filter_by(id=challenge.id).delete()
        db.session.commit()

    @staticmethod
    def attempt(challenge, request):
        data = request.form or request.get_json()
        submission = data.get("submission", "").strip()
        question_id = data.get("question_id")
        
        if not question_id:
            return False, "Missing question ID"

        question = BetterAnswersQuestion.query.filter_by(id=question_id, challenge_id=challenge.id).first()
        if not question:
            return False, "Question not found"

        user = get_current_user()
        team = get_current_team()
        user_id = user.id if user else None
        team_id = team.id if team else None

        # Check for previous solves
        solved = BetterAnswersSubmission.query.filter_by(
            question_id=question_id,
            user_id=user_id,
            team_id=team_id,
            correct=True
        ).first()
        if solved:
            return False, "Question already solved"

        # Check attempt limit
        if question.max_attempts > 0:
            attempts = BetterAnswersSubmission.query.filter_by(
                question_id=question_id,
                user_id=user_id,
                team_id=team_id
            ).count()
            if attempts >= question.max_attempts:
                return False, "Attempt limit reached for this question"

        # Check answer
        if question.category == "regex":
            import re
            try:
                res = re.match(question.answer, submission)
                is_correct = bool(res and res.group() == submission)
            except re.error:
                is_correct = False
        else:
            is_correct = (submission == question.answer)
        
        # Log attempt
        sub = BetterAnswersSubmission(
            question_id=question_id,
            challenge_id=challenge.id,
            user_id=user_id,
            team_id=team_id,
            ip=request.remote_addr,
            provided=submission,
            correct=is_correct
        )
        db.session.add(sub)
        db.session.commit()

        if is_correct:
            # Award points for this question
            award = Awards(
                user_id=user_id,
                team_id=team_id,
                name=f"Partial Credit: {challenge.name} - {question.title}",
                value=question.points,
                category="Challenge",
                challenge_id=challenge.id
            )
            db.session.add(award)
            db.session.commit()

            # Check if all questions solved
            total_questions = BetterAnswersQuestion.query.filter_by(challenge_id=challenge.id).count()
            solved_questions_count = db.session.query(db.func.count(db.func.distinct(BetterAnswersSubmission.question_id))).filter_by(
                challenge_id=challenge.id,
                user_id=user_id,
                team_id=team_id,
                correct=True
            ).scalar()

            if solved_questions_count == total_questions:
                # Cleanup awards
                Awards.query.filter_by(
                    challenge_id=challenge.id,
                    user_id=user_id,
                    team_id=team_id
                ).delete()
                
                # Update challenge value to match total points temporarily for this solve
                # Note: In static scoring, all solves get challenge.value.
                # We should set challenge.value to sum(points)
                total_points = db.session.query(db.func.sum(BetterAnswersQuestion.points)).filter_by(challenge_id=challenge.id).scalar()
                challenge.value = total_points or 0
                db.session.commit()
                
                return True, "Correct! Challenge fully solved."

            return True, "Correct!"
        else:
            return False, "Incorrect"

    @staticmethod
    def solve(user, team, challenge, request):
        user_id = user.id if user else None
        team_id = team.id if team else None

        total_questions = BetterAnswersQuestion.query.filter_by(challenge_id=challenge.id).count()
        solved_questions_count = db.session.query(db.func.count(db.func.distinct(BetterAnswersSubmission.question_id))).filter_by(
            challenge_id=challenge.id,
            user_id=user_id,
            team_id=team_id,
            correct=True
        ).scalar()
        
        if solved_questions_count == total_questions:
            # Actually solved! Let core handle it.
            BaseChallenge.solve(user, team, challenge, request)
        else:
            # Partial solve, do not create a generic `Solves` record!
            pass

    @staticmethod
    def fail(user, team, challenge, request):
        BaseChallenge.fail(user, team, challenge, request)

def load(app):
    app.db.create_all()
    plugin_name = __name__.split('.')[-1]
    CHALLENGE_CLASSES["better_answers"] = BetterAnswersChallengeType
    register_plugin_assets_directory(app, base_path=f"/plugins/{plugin_name}/assets/")
